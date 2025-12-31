
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
  isBought: boolean;
  ror: number;
  hpr: number;
}

export interface StrategyParams {
  symbol: string;
  k: number;
  fee: number;
  days: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  preferredCoins: string[];
  kValue: number;
}

export interface MarketTicker {
  symbol: string;
  currentPrice: number;
  openingPrice: number;
  highPrice: number;
  lowPrice: number;
  targetPrice: number;
  changeRate: number;
}
