
import { OHLCV, MarketTicker } from '../types';

export async function fetchOHLCV(symbol: string, count: number = 200): Promise<OHLCV[]> {
  try {
    const response = await fetch(`https://api.upbit.com/v1/candles/days?market=${symbol}&count=${count}`);
    const data = await response.json();
    return data.map((item: any) => ({
      timestamp: item.candle_date_time_kst,
      open: item.opening_price,
      high: item.high_price,
      low: item.low_price,
      close: item.trade_price,
      volume: item.candle_acc_trade_volume
    })).reverse();
  } catch (error) {
    console.error("Failed to fetch OHLCV", error);
    return [];
  }
}

export async function fetchTickers(symbols: string[]): Promise<MarketTicker[]> {
  try {
    const markets = symbols.join(',');
    const [tickerRes, candleRes] = await Promise.all([
      fetch(`https://api.upbit.com/v1/ticker?markets=${markets}`),
      fetch(`https://api.upbit.com/v1/candles/days?market=${symbols[0]}&count=6`) // Fetch 6 to get MA5 of last 5 days
    ]);
    
    const tickerData = await tickerRes.json();
    const candleData = await candleRes.json();
    
    // Calculate MA5 from the most recent 5 closed candles
    const ma5 = candleData.slice(1, 6).reduce((sum: number, c: any) => sum + c.trade_price, 0) / 5;
    
    return tickerData.map((t: any) => ({
      symbol: t.market,
      currentPrice: t.trade_price,
      openingPrice: t.opening_price,
      highPrice: t.high_price,
      lowPrice: t.low_price,
      changeRate: t.signed_change_rate,
      ma5: ma5,
      targetPrice: 0 
    }));
  } catch (error) {
    console.error("Failed to fetch tickers", error);
    return [];
  }
}
