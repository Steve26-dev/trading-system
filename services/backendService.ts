import { BacktestResult, MarketTicker, StrategyParams } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchBacktest(params: StrategyParams): Promise<{ results: BacktestResult[]; ticker: MarketTicker | null }> {
  const response = await fetch(`${API_BASE_URL}/api/backtest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Backtest request failed (${response.status})`);
  }

  return response.json();
}
