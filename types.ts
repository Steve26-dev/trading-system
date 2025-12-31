
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestResult {
  date: string;
  price: number;
  target: number;
  ma5: number;
  isBought: boolean;
  ror: number;
  hpr: number;
}

export interface Trade {
  date: string;
  entryPrice: number;
  exitPrice: number;
  ror: number;
}

export interface TradeSummary {
  tradeCount: number;
  winRate: number;
  avgReturn: number;
  bestReturn: number;
  worstReturn: number;
}

export interface BacktestMetrics {
  totalReturn: number;
  winRate: number;
  mdd: number;
  cagr: number;
  tradeCount: number;
  totalDays: number;
}

export interface StrategyParams {
  symbol: string;
  k: number;
  fee: number;
  slippage?: number;
  days: number;
  useMaFilter: boolean;
}

export interface MarketTicker {
  symbol: string;
  currentPrice: number;
  openingPrice: number;
  highPrice: number;
  lowPrice: number;
  targetPrice: number;
  ma5: number;
  changeRate: number;
}

export interface BacktestResponse {
  results: BacktestResult[];
  trades: Trade[];
  tradeSummary: TradeSummary;
  metrics: BacktestMetrics;
  ticker: MarketTicker | null;
}

export interface AiReport {
  summary: string;
  risks: string[];
  parameterSuggestions: string[];
  whatToWatch: string[];
}

export interface AiReportRequest {
  symbol: string;
  k: number;
  fee: number;
  days: number;
  useMaFilter: boolean;
  metrics: BacktestMetrics;
  tradeSummary: TradeSummary;
}

export interface AiReportResponse {
  report: AiReport;
  cached: boolean;
}
