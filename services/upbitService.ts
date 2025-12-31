
import { OHLCV, MarketTicker } from '../types';

/**
 * Fetches OHLCV data for backtesting.
 * In a real production app, this would call your Cloudflare Worker to avoid CORS 
 * and hide API keys if needed. For public data, we can try direct or proxy.
 */
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
      fetch(`https://api.upbit.com/v1/candles/days?market=${symbols[0]}&count=2`) // Simplified for one coin context
    ]);
    
    const tickerData = await tickerRes.json();
    // In a real loop, you'd fetch candles for all symbols. 
    // This is a simplified version for the dashboard.
    
    return tickerData.map((t: any) => ({
      symbol: t.market,
      currentPrice: t.trade_price,
      openingPrice: t.opening_price,
      highPrice: t.high_price,
      lowPrice: t.low_price,
      changeRate: t.signed_change_rate,
      targetPrice: 0 // Will be calculated in component
    }));
  } catch (error) {
    console.error("Failed to fetch tickers", error);
    return [];
  }
}
