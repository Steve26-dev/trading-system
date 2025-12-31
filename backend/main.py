from datetime import datetime
import os
from typing import List, Optional

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

UPBIT_BASE_URL = "https://api.upbit.com/v1"


class BacktestRequest(BaseModel):
    symbol: str
    k: float = Field(ge=0)
    fee: float = Field(ge=0)
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


class BacktestResponse(BaseModel):
    results: List[BacktestResult]
    ticker: Optional[MarketTicker]


app = FastAPI()

raw_origins = os.getenv("CORS_ORIGINS", "*")
if raw_origins == "*":
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


def _format_date(timestamp: str) -> str:
    try:
        return datetime.fromisoformat(timestamp).date().isoformat()
    except ValueError:
        return timestamp.split("T")[0] if "T" in timestamp else timestamp


def _fetch_json(path: str, params: dict) -> list:
    url = f"{UPBIT_BASE_URL}{path}"
    response = requests.get(url, params=params, timeout=10)
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Upbit API error: {response.status_code}")
    data = response.json()
    if not isinstance(data, list):
        raise HTTPException(status_code=502, detail="Unexpected Upbit response")
    return data


def fetch_ohlcv(symbol: str, count: int) -> List[dict]:
    raw: List[dict] = []
    remaining = count
    to_param = None

    while remaining > 0:
        batch_count = min(200, remaining)
        params = {"market": symbol, "count": batch_count}
        if to_param:
            params["to"] = to_param
        batch = _fetch_json("/candles/days", params)
        if not batch:
            break
        raw.extend(batch)
        remaining -= len(batch)
        to_param = batch[-1].get("candle_date_time_utc")
        if len(batch) < batch_count:
            break

    if not raw:
        return []

    raw = raw[:count]
    raw.reverse()
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


def run_backtest(data: List[dict], k: float, fee: float, use_ma_filter: bool) -> List[BacktestResult]:
    cumulative_return = 1.0
    results: List[BacktestResult] = []

    for i in range(5, len(data)):
        prev = data[i - 1]
        curr = data[i]
        ma5 = sum(day["close"] for day in data[i - 5:i]) / 5

        price_range = prev["high"] - prev["low"]
        target = curr["open"] + price_range * k
        is_bought = curr["high"] > target
        if use_ma_filter:
            is_bought = is_bought and (curr["open"] > ma5)

        ror = (curr["close"] / target) - (fee * 2) if is_bought else 1
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


def fetch_ticker(symbol: str, k: float) -> Optional[MarketTicker]:
    ticker_data = _fetch_json("/ticker", {"markets": symbol})
    if not ticker_data:
        return None
    ticker = ticker_data[0]

    candle_data = _fetch_json("/candles/days", {"market": symbol, "count": 6})
    ma_source = candle_data[1:6] if len(candle_data) >= 6 else candle_data[1:] or candle_data
    ma5 = sum(item["trade_price"] for item in ma_source) / len(ma_source)

    prev_day = candle_data[1] if len(candle_data) > 1 else candle_data[0]
    price_range = prev_day["high_price"] - prev_day["low_price"]
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


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/backtest", response_model=BacktestResponse)
def backtest(payload: BacktestRequest):
    count = payload.days + 5
    data = fetch_ohlcv(payload.symbol, count)
    if len(data) < 6:
        raise HTTPException(status_code=400, detail="Not enough OHLCV data")
    results = run_backtest(data, payload.k, payload.fee, payload.useMaFilter)
    ticker = fetch_ticker(payload.symbol, payload.k)
    return {"results": results, "ticker": ticker}
