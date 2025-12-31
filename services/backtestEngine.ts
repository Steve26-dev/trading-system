
import { OHLCV, BacktestResult, StrategyParams } from '../types';

export function runBacktest(data: OHLCV[], params: StrategyParams): BacktestResult[] {
  const { k, fee } = params;
  let cumulativeReturn = 1;
  const results: BacktestResult[] = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    const range = prev.high - prev.low;
    const target = curr.open + range * k;
    
    const isBought = curr.high > target;
    const ror = isBought ? (curr.close / target) - (fee * 2) : 1;
    
    cumulativeReturn *= ror;

    results.push({
      date: new Date(curr.timestamp).toLocaleDateString(),
      price: curr.close,
      target: target,
      isBought: isBought,
      ror: (ror - 1) * 100,
      hpr: cumulativeReturn
    });
  }

  return results;
}
