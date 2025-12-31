
import { OHLCV, BacktestResult, StrategyParams } from '../types';

export function runBacktest(data: OHLCV[], params: StrategyParams): BacktestResult[] {
  const { k, fee, useMaFilter } = params;
  let cumulativeReturn = 1;
  const results: BacktestResult[] = [];

  // Need at least 5 days for MA5
  for (let i = 5; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    // Calculate MA5 of the previous 5 days (excluding current)
    const ma5 = data.slice(i - 5, i).reduce((sum, d) => sum + d.close, 0) / 5;
    
    const range = prev.high - prev.low;
    const target = curr.open + range * k;
    
    // Condition 1: Price breaks target
    // Condition 2: Current opening is above MA5 (Trend filter)
    let isBought = curr.high > target;
    if (useMaFilter) {
      isBought = isBought && (curr.open > ma5);
    }

    const ror = isBought ? (curr.close / target) - (fee * 2) : 1;
    cumulativeReturn *= ror;

    results.push({
      date: new Date(curr.timestamp).toLocaleDateString(),
      price: curr.close,
      target: target,
      ma5: ma5,
      isBought: isBought,
      ror: (ror - 1) * 100,
      hpr: cumulativeReturn
    });
  }

  return results;
}
