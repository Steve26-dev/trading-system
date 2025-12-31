
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

export interface StrategyParams {
  symbol: string;
  k: number;
  fee: number;
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
