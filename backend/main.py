import asyncio
from dataclasses import dataclass
from datetime import datetime
import hashlib
import json
import logging
import os
import random
import time
from typing import Dict, List, Optional, Set, Tuple

import httpx
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from zoneinfo import ZoneInfo

UPBIT_BASE_URL = "https://api.upbit.com/v1"
UPBIT_WS_URL = "wss://api.upbit.com/websocket/v1"

DEFAULT_MARKETS = ["KRW-BTC", "KRW-ETH", "KRW-SOL", "KRW-XRP", "KRW-DOGE"]

CACHE_TTL_OHLCV = int(os.getenv("CACHE_TTL_OHLCV", "60"))
CACHE_TTL_TICKER = int(os.getenv("CACHE_TTL_TICKER", "5"))
CACHE_TTL_AI = int(os.getenv("CACHE_TTL_AI", "86400"))

RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "30"))
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))

UPBIT_MAX_RETRIES = int(os.getenv("UPBIT_MAX_RETRIES", "3"))
UPBIT_RETRY_BASE = float(os.getenv("UPBIT_RETRY_BASE", "0.5"))
UPBIT_CIRCUIT_FAILURES = int(os.getenv("UPBIT_CIRCUIT_FAILURES", "5"))
UPBIT_CIRCUIT_COOLDOWN = int(os.getenv("UPBIT_CIRCUIT_COOLDOWN", "30"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")

logger = logging.getLogger("quantdash")
logging.basicConfig(level=logging.INFO)


@dataclass
class CacheEntry:
    expires_at: float
    data: object


@dataclass
class CircuitState:
    failure_count: int = 0
    opened_until: float = 0.0


@dataclass
class RateLimitState:
    window_start: float
    count: int


class ApiException(Exception):
    def __init__(self, status_code: int, code: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable


class BacktestRequest(BaseModel):
    symbol: str
    k: float = Field(ge=0)
    fee: float = Field(ge=0)
    slippage: float = Field(ge=0, default=0.0)
    days: int = Field(ge=10, le=2000)
    useMaFilter: bool


class BacktestResult(BaseModel):
    date: str
    price: float
    target: float
    ma5: float
    isBought: bool
    ror: float
    hpr: float


class MarketTicker(BaseModel):
    symbol: str
    currentPrice: float
    openingPrice: float
    highPrice: float
    lowPrice: float
    targetPrice: float
    ma5: float
    changeRate: float


class Trade(BaseModel):
    date: str
    entryPrice: float
    exitPrice: float
    ror: float


class TradeSummary(BaseModel):
    tradeCount: int
    winRate: float
    avgReturn: float
    bestReturn: float
    worstReturn: float


class MetricSummary(BaseModel):
    totalReturn: float
    winRate: float
    mdd: float
    cagr: float
    tradeCount: int
    totalDays: int


class BacktestResponse(BaseModel):
    results: List[BacktestResult]
    trades: List[Trade]
    tradeSummary: TradeSummary
    metrics: MetricSummary
    ticker: Optional[MarketTicker]


class AiReport(BaseModel):
    summary: str
    risks: List[str]
    parameterSuggestions: List[str]
    whatToWatch: List[str]


class AiReportRequest(BaseModel):
    symbol: str
    k: float
    fee: float
    days: int
    useMaFilter: bool
    metrics: MetricSummary
    tradeSummary: TradeSummary


class AiReportResponse(BaseModel):
    report: AiReport
    cached: bool


app = FastAPI()

raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
if raw_origins.strip() == "*":
    allow_origins = ["*"]
    allow_credentials = False
else:
    allow_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

http_client: Optional[httpx.AsyncClient] = None
cache: Dict[str, CacheEntry] = {}
cache_lock = asyncio.Lock()
rate_limits: Dict[str, RateLimitState] = {}
rate_lock = asyncio.Lock()
circuit_states: Dict[str, CircuitState] = {}

ai_cache: Dict[str, CacheEntry] = {}
ai_cache_lock = asyncio.Lock()

live_tickers: Dict[str, dict] = {}
live_lock = asyncio.Lock()


class TickerBroadcaster:
    def __init__(self) -> None:
        self._connections: Dict[WebSocket, Set[str]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, symbols: Set[str]) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[websocket] = symbols

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.pop(websocket, None)

    async def broadcast(self, payload: dict) -> None:
        async with self._lock:
            targets = list(self._connections.items())
        for websocket, symbols in targets:
            if symbols and payload.get("symbol") not in symbols:
                continue
            try:
                await websocket.send_json(payload)
            except Exception:
                await self.disconnect(websocket)


broadcaster = TickerBroadcaster()


@app.on_event("startup")
async def on_startup() -> None:
    global http_client
    http_client = httpx.AsyncClient(timeout=10)
    markets = os.getenv("STREAM_MARKETS")
    if markets:
        market_list = [m.strip() for m in markets.split(",") if m.strip()]
    else:
        market_list = DEFAULT_MARKETS
    if market_list:
        asyncio.create_task(run_upbit_ws(market_list))


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if http_client:
        await http_client.aclose()


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    if path in {"/api/backtest", "/api/ai/report"}:
        ip = request.client.host if request.client else "unknown"
        allowed, retry_after = await check_rate_limit(ip)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
                        "retryable": True,
                    }
                },
                headers={"Retry-After": str(retry_after)},
            )
    return await call_next(request)


@app.exception_handler(ApiException)
async def api_exception_handler(request: Request, exc: ApiException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "retryable": exc.retryable}},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        payload = detail
    else:
        payload = {
            "code": f"HTTP_{exc.status_code}",
            "message": str(detail),
            "retryable": exc.status_code >= 500,
        }
    return JSONResponse(status_code=exc.status_code, content={"error": payload})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "서버 오류가 발생했습니다.",
                "retryable": True,
            }
        },
    )


def _format_date(timestamp: str) -> str:
    try:
        return datetime.fromisoformat(timestamp).date().isoformat()
    except ValueError:
        return timestamp.split("T")[0] if "T" in timestamp else timestamp


def _cache_key(path: str, params: dict) -> str:
    params_key = json.dumps(params, sort_keys=True, separators=(",", ":"))
    return f"{path}:{params_key}"


def _get_circuit_state(path: str) -> CircuitState:
    state = circuit_states.get(path)
    if not state:
        state = CircuitState()
        circuit_states[path] = state
    return state


def _circuit_allows(path: str) -> bool:
    state = _get_circuit_state(path)
    return time.time() >= state.opened_until


def _record_success(path: str) -> None:
    state = _get_circuit_state(path)
    state.failure_count = 0
    state.opened_until = 0.0


def _record_failure(path: str) -> None:
    state = _get_circuit_state(path)
    state.failure_count += 1
    if state.failure_count >= UPBIT_CIRCUIT_FAILURES:
        state.opened_until = time.time() + UPBIT_CIRCUIT_COOLDOWN


def _get_ttl(path: str) -> int:
    if path == "/ticker":
        return CACHE_TTL_TICKER
    if path == "/candles/days":
        return CACHE_TTL_OHLCV
    return 0


async def _get_cache(key: str) -> Optional[list]:
    async with cache_lock:
        entry = cache.get(key)
        if not entry:
            return None
        if entry.expires_at < time.time():
            cache.pop(key, None)
            return None
        return entry.data


async def _set_cache(key: str, data: list, ttl: int) -> None:
    if ttl <= 0:
        return
    async with cache_lock:
        cache[key] = CacheEntry(expires_at=time.time() + ttl, data=data)


async def _fetch_json(path: str, params: dict) -> list:
    if not http_client:
        raise ApiException(500, "CLIENT_NOT_READY", "HTTP 클라이언트가 준비되지 않았습니다.", True)

    if not _circuit_allows(path):
        raise ApiException(503, "UPBIT_CIRCUIT_OPEN", "Upbit 응답이 불안정합니다.", True)

    cache_key = _cache_key(path, params)
    ttl = _get_ttl(path)
    cached = await _get_cache(cache_key)
    if cached is not None:
        return cached

    url = f"{UPBIT_BASE_URL}{path}"
    for attempt in range(UPBIT_MAX_RETRIES):
        try:
            response = await http_client.get(url, params=params)
        except httpx.RequestError:
            _record_failure(path)
            logger.warning("Upbit network error path=%s attempt=%s", path, attempt + 1)
            if attempt == UPBIT_MAX_RETRIES - 1:
                raise ApiException(502, "UPBIT_NETWORK", "Upbit 네트워크 오류", True)
        else:
            if response.status_code == 200:
                data = response.json()
                if not isinstance(data, list):
                    raise ApiException(502, "UPBIT_BAD_RESPONSE", "Upbit 응답 포맷 오류", True)
                await _set_cache(cache_key, data, ttl)
                _record_success(path)
                return data
            if response.status_code == 429 or response.status_code >= 500:
                _record_failure(path)
                logger.warning(
                    "Upbit API retry path=%s status=%s attempt=%s",
                    path,
                    response.status_code,
                    attempt + 1,
                )
                if attempt == UPBIT_MAX_RETRIES - 1:
                    raise ApiException(
                        502,
                        "UPBIT_RATE_LIMIT",
                        f"Upbit API 응답 실패: {response.status_code}",
                        True,
                    )
            else:
                logger.warning(
                    "Upbit API error path=%s status=%s params=%s",
                    path,
                    response.status_code,
                    params,
                )
                raise ApiException(
                    502,
                    "UPBIT_BAD_STATUS",
                    f"Upbit API 응답 실패: {response.status_code}",
                    False,
                )

        backoff = UPBIT_RETRY_BASE * (2 ** attempt)
        jitter = random.uniform(0, backoff * 0.1)
        await asyncio.sleep(backoff + jitter)

    raise ApiException(502, "UPBIT_UNKNOWN", "Upbit 응답 실패", True)


async def check_rate_limit(ip: str) -> Tuple[bool, int]:
    now = time.time()
    async with rate_lock:
        state = rate_limits.get(ip)
        if not state or now - state.window_start >= RATE_LIMIT_WINDOW:
            state = RateLimitState(window_start=now, count=1)
            rate_limits[ip] = state
            return True, 0
        state.count += 1
        if state.count > RATE_LIMIT_PER_MIN:
            retry_after = int(state.window_start + RATE_LIMIT_WINDOW - now)
            return False, max(1, retry_after)
        return True, 0


async def fetch_ohlcv(symbol: str, count: int) -> List[dict]:
    raw: List[dict] = []
    target_count = count + 1
    remaining = target_count
    to_param = None

    while remaining > 0:
        batch_count = min(200, remaining)
        params = {"market": symbol, "count": batch_count}
        if to_param:
            params["to"] = to_param
        batch = await _fetch_json("/candles/days", params)
        if not batch:
            break
        raw.extend(batch)
        remaining -= len(batch)
        to_param = batch[-1].get("candle_date_time_utc")
        if len(batch) < batch_count:
            break

    if not raw:
        return []

    raw = raw[:target_count]
    raw.reverse()
    today_kst = datetime.now(ZoneInfo("Asia/Seoul")).date()
    raw = [
        item
        for item in raw
        if datetime.fromisoformat(item["candle_date_time_kst"]).date() != today_kst
    ]
    if len(raw) > count:
        raw = raw[-count:]
    return [
        {
            "timestamp": item["candle_date_time_kst"],
            "open": item["opening_price"],
            "high": item["high_price"],
            "low": item["low_price"],
            "close": item["trade_price"],
            "volume": item["candle_acc_trade_volume"],
        }
        for item in raw
    ]


def run_backtest(
    data: List[dict], k: float, fee: float, slippage: float, use_ma_filter: bool
) -> List[BacktestResult]:
    cumulative_return = 1.0
    results: List[BacktestResult] = []
    effective_fee = min(1.0, fee + slippage)
    fee_multiplier = max(0.0, 1 - effective_fee)
    fee_factor = fee_multiplier * fee_multiplier

    for i in range(5, len(data)):
        prev = data[i - 1]
        curr = data[i]
        ma5 = sum(day["close"] for day in data[i - 5:i]) / 5

        price_range = prev["high"] - prev["low"]
        target = curr["open"] + price_range * k
        is_bought = curr["high"] > target
        if use_ma_filter:
            is_bought = is_bought and (curr["open"] > ma5)

        ror = (curr["close"] / target) * fee_factor if is_bought else 1
        cumulative_return *= ror

        results.append(
            BacktestResult(
                date=_format_date(curr["timestamp"]),
                price=curr["close"],
                target=target,
                ma5=ma5,
                isBought=is_bought,
                ror=(ror - 1) * 100,
                hpr=cumulative_return,
            )
        )

    return results


def build_trades(results: List[BacktestResult]) -> List[Trade]:
    trades: List[Trade] = []
    for result in results:
        if result.isBought:
            trades.append(
                Trade(
                    date=result.date,
                    entryPrice=result.target,
                    exitPrice=result.price,
                    ror=result.ror,
                )
            )
    return trades


def build_trade_summary(trades: List[Trade]) -> TradeSummary:
    if not trades:
        return TradeSummary(
            tradeCount=0,
            winRate=0.0,
            avgReturn=0.0,
            bestReturn=0.0,
            worstReturn=0.0,
        )
    returns = [trade.ror for trade in trades]
    trade_count = len(trades)
    wins = sum(1 for value in returns if value > 0)
    return TradeSummary(
        tradeCount=trade_count,
        winRate=(wins / trade_count) * 100,
        avgReturn=sum(returns) / trade_count,
        bestReturn=max(returns),
        worstReturn=min(returns),
    )


def build_metrics(results: List[BacktestResult], trades: List[Trade]) -> MetricSummary:
    if not results:
        return MetricSummary(
            totalReturn=0.0,
            winRate=0.0,
            mdd=0.0,
            cagr=0.0,
            tradeCount=0,
            totalDays=0,
        )

    final_hpr = results[-1].hpr
    max_hpr = results[0].hpr
    max_drawdown = 0.0
    for result in results:
        if result.hpr > max_hpr:
            max_hpr = result.hpr
        drawdown = (max_hpr - result.hpr) / max_hpr if max_hpr else 0.0
        if drawdown > max_drawdown:
            max_drawdown = drawdown

    trade_count = len(trades)
    wins = sum(1 for trade in trades if trade.ror > 0)
    win_rate = (wins / trade_count) * 100 if trade_count else 0.0

    total_days = len(results)
    years = total_days / 365 if total_days else 0.0
    cagr = (final_hpr ** (1 / years) - 1) * 100 if years > 0 and final_hpr > 0 else 0.0

    return MetricSummary(
        totalReturn=(final_hpr - 1) * 100,
        winRate=win_rate,
        mdd=max_drawdown * 100,
        cagr=cagr,
        tradeCount=trade_count,
        totalDays=total_days,
    )


async def fetch_ticker(symbol: str, k: float) -> Optional[MarketTicker]:
    ticker_data = await _fetch_json("/ticker", {"markets": symbol})
    if not ticker_data:
        return None
    ticker = ticker_data[0]

    candle_data = await fetch_ohlcv(symbol, 6)
    if len(candle_data) < 6:
        return None

    ma_source = candle_data[-5:]
    ma5 = sum(item["close"] for item in ma_source) / len(ma_source)

    prev_day = candle_data[-1]
    price_range = prev_day["high"] - prev_day["low"]
    target = ticker["opening_price"] + price_range * k

    return MarketTicker(
        symbol=ticker["market"],
        currentPrice=ticker["trade_price"],
        openingPrice=ticker["opening_price"],
        highPrice=ticker["high_price"],
        lowPrice=ticker["low_price"],
        targetPrice=target,
        ma5=ma5,
        changeRate=ticker["signed_change_rate"],
    )


def _extract_ws_ticker(payload: dict) -> Optional[dict]:
    symbol = payload.get("code") or payload.get("market")
    current_price = payload.get("trade_price") or payload.get("tp")
    change_rate = payload.get("signed_change_rate") or payload.get("scr")
    if not symbol or current_price is None or change_rate is None:
        return None
    return {
        "symbol": symbol,
        "currentPrice": float(current_price),
        "changeRate": float(change_rate),
        "timestamp": payload.get("timestamp"),
    }


async def run_upbit_ws(markets: List[str]) -> None:
    try:
        import websockets
    except ImportError:
        logger.warning("websockets 패키지가 없어 실시간 스트림을 비활성화합니다.")
        return

    backoff = 1.0
    while True:
        try:
            async with websockets.connect(UPBIT_WS_URL, ping_interval=20) as websocket:
                subscribe = [
                    {"ticket": "quantdash"},
                    {"type": "ticker", "codes": markets},
                ]
                await websocket.send(json.dumps(subscribe))
                backoff = 1.0

                async for message in websocket:
                    if isinstance(message, bytes):
                        message = message.decode("utf-8")
                    payload = json.loads(message)
                    update = _extract_ws_ticker(payload)
                    if not update:
                        continue
                    async with live_lock:
                        live_tickers[update["symbol"]] = update
                    await broadcaster.broadcast(update)
        except Exception as exc:
            logger.warning("Upbit WS error: %s", exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)


async def _get_ai_cache(cache_key: str) -> Optional[AiReportResponse]:
    async with ai_cache_lock:
        entry = ai_cache.get(cache_key)
        if not entry:
            return None
        if entry.expires_at < time.time():
            ai_cache.pop(cache_key, None)
            return None
        return AiReportResponse(**entry.data)


async def _set_ai_cache(cache_key: str, response: AiReportResponse) -> None:
    async with ai_cache_lock:
        ai_cache[cache_key] = CacheEntry(
            expires_at=time.time() + CACHE_TTL_AI,
            data=response.model_dump(),
        )


def _build_ai_prompt(payload: AiReportRequest) -> str:
    metrics = payload.metrics
    trades = payload.tradeSummary
    return (
        "당신은 시니어 퀀트 애널리스트입니다. 아래 데이터 기반으로 한국어로 분석 리포트를 작성하세요.\n"
        "반드시 JSON만 출력하고, 다음 스키마를 지키세요:\n"
        '{"summary":"...","risks":["..."],"parameterSuggestions":["..."],"whatToWatch":["..."]}\n\n'
        f"[전략] symbol={payload.symbol}, K={payload.k}, fee={payload.fee}, days={payload.days}, useMaFilter={payload.useMaFilter}\n"
        f"[성과] totalReturn={metrics.totalReturn:.2f}%, winRate={metrics.winRate:.2f}%, MDD={metrics.mdd:.2f}%, CAGR={metrics.cagr:.2f}%, trades={metrics.tradeCount}\n"
        f"[거래요약] avgReturn={trades.avgReturn:.2f}%, bestReturn={trades.bestReturn:.2f}%, worstReturn={trades.worstReturn:.2f}%\n"
        "요구사항:\n"
        "- summary는 2~3문장\n"
        "- risks는 3개 이내\n"
        "- parameterSuggestions는 3개 이내 (K, MA, 기간/필터 중심)\n"
        "- whatToWatch는 3개 이내 (시장 국면/변동성/추세)\n"
    )


def _safe_json_parse(text: str) -> Optional[dict]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


async def generate_ai_report(payload: AiReportRequest) -> AiReportResponse:
    if not http_client:
        raise ApiException(500, "CLIENT_NOT_READY", "HTTP 클라이언트가 준비되지 않았습니다.", True)

    if not GEMINI_API_KEY:
        return AiReportResponse(
            report=AiReport(
                summary="Gemini API 키가 설정되지 않았습니다. 서버 환경변수 GEMINI_API_KEY를 설정하세요.",
                risks=[],
                parameterSuggestions=[],
                whatToWatch=[],
            ),
            cached=False,
        )

    prompt = _build_ai_prompt(payload)
    url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent"
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}

    try:
        response = await http_client.post(url, params=params, headers=headers, json=body)
    except httpx.RequestError as exc:
        raise ApiException(502, "GEMINI_NETWORK", "Gemini 네트워크 오류", True) from exc

    if response.status_code != 200:
        raise ApiException(502, "GEMINI_ERROR", "Gemini 응답 오류", True)

    data = response.json()
    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    parsed = _safe_json_parse(text)
    if not parsed:
        report = AiReport(
            summary=text.strip() or "AI 분석 결과를 파싱하지 못했습니다.",
            risks=[],
            parameterSuggestions=[],
            whatToWatch=[],
        )
        return AiReportResponse(report=report, cached=False)

    report = AiReport(
        summary=str(parsed.get("summary", "")),
        risks=[str(item) for item in parsed.get("risks", [])],
        parameterSuggestions=[str(item) for item in parsed.get("parameterSuggestions", [])],
        whatToWatch=[str(item) for item in parsed.get("whatToWatch", [])],
    )
    return AiReportResponse(report=report, cached=False)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/backtest", response_model=BacktestResponse)
async def backtest(payload: BacktestRequest):
    start_time = time.perf_counter()
    count = payload.days + 5
    data = await fetch_ohlcv(payload.symbol, count)
    if len(data) < 6:
        raise HTTPException(status_code=400, detail="Not enough OHLCV data")
    results = await asyncio.to_thread(
        run_backtest, data, payload.k, payload.fee, payload.slippage, payload.useMaFilter
    )
    trades = build_trades(results)
    trade_summary = build_trade_summary(trades)
    metrics = build_metrics(results, trades)
    ticker = await fetch_ticker(payload.symbol, payload.k)
    elapsed_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        "Backtest symbol=%s k=%.3f days=%s ma=%s slippage=%.4f trades=%s duration_ms=%.1f",
        payload.symbol,
        payload.k,
        payload.days,
        payload.useMaFilter,
        payload.slippage,
        metrics.tradeCount,
        elapsed_ms,
    )
    return {
        "results": results,
        "trades": trades,
        "tradeSummary": trade_summary,
        "metrics": metrics,
        "ticker": ticker,
    }


@app.post("/api/ai/report", response_model=AiReportResponse)
async def ai_report(payload: AiReportRequest):
    cache_key = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    cached = await _get_ai_cache(cache_key)
    if cached:
        return AiReportResponse(report=cached.report, cached=True)

    logger.info(
        "AI report symbol=%s k=%.3f days=%s trades=%s",
        payload.symbol,
        payload.k,
        payload.days,
        payload.metrics.tradeCount,
    )
    report = await generate_ai_report(payload)
    await _set_ai_cache(cache_key, report)
    return report


@app.websocket("/ws/ticker")
async def ticker_stream(websocket: WebSocket):
    symbols_param = websocket.query_params.get("symbols")
    symbols = {s.strip() for s in symbols_param.split(",") if s.strip()} if symbols_param else set()
    await broadcaster.connect(websocket, symbols)

    async with live_lock:
        initial = [value for key, value in live_tickers.items() if not symbols or key in symbols]

    for payload in initial:
        await websocket.send_json(payload)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await broadcaster.disconnect(websocket)
