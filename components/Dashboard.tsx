
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend 
} from 'recharts';
import { SUPPORTED_COINS, DEFAULT_K, DEFAULT_FEE } from '../constants';
import { fetchOHLCV, fetchTickers } from '../services/upbitService';
import { runBacktest } from '../services/backtestEngine';
import { analyzeStrategyPerformance } from '../services/geminiService';
import { BacktestResult, MarketTicker } from '../types';

const Dashboard: React.FC = () => {
  const [symbol, setSymbol] = useState(SUPPORTED_COINS[0].symbol);
  const [k, setK] = useState(DEFAULT_K);
  const [days, setDays] = useState(100);
  const [ohlcv, setOhlcv] = useState<any[]>([]);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const data = await fetchOHLCV(symbol, days);
    setOhlcv(data);
    
    const backtestRes = runBacktest(data, { symbol, k, fee: DEFAULT_FEE, days });
    setResults(backtestRes);

    const tickers = await fetchTickers([symbol]);
    if (tickers.length > 0) {
      // Calculate real-time target for display
      const prevDay = data[data.length - 1];
      const range = prevDay.high - prevDay.low;
      const target = tickers[0].openingPrice + (range * k);
      setTicker({ ...tickers[0], targetPrice: target });
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [symbol, k, days]);

  const handleAiAnalysis = async () => {
    if (results.length === 0) return;
    setIsAnalyzing(true);
    const report = await analyzeStrategyPerformance(results, k);
    setAiReport(report || "분석 실패");
    setIsAnalyzing(false);
  };

  const finalReturn = useMemo(() => {
    if (results.length === 0) return 0;
    return ((results[results.length - 1].hpr - 1) * 100).toFixed(2);
  }, [results]);

  const mdd = useMemo(() => {
    if (results.length === 0) return 0;
    let maxHpr = 0;
    let maxDrawdown = 0;
    results.forEach(r => {
      if (r.hpr > maxHpr) maxHpr = r.hpr;
      const dd = (maxHpr - r.hpr) / maxHpr;
      if (dd > maxDrawdown) maxDrawdown = dd;
    });
    return (maxDrawdown * 100).toFixed(2);
  }, [results]);

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Target Asset</label>
          <select 
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SUPPORTED_COINS.map(c => <option key={c.symbol} value={c.symbol}>{c.name} ({c.symbol})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Sensitivity (K-Value)</label>
          <div className="flex items-center gap-3">
            <input 
              type="range" min="0.1" max="1.0" step="0.05"
              value={k}
              onChange={(e) => setK(parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="mono text-sm font-bold w-12">{k.toFixed(2)}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Lookback Days</label>
          <select 
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm"
          >
            <option value={30}>Last 30 Days</option>
            <option value={100}>Last 100 Days</option>
            <option value={200}>Last 200 Days</option>
            <option value={500}>Last 500 Days</option>
          </select>
        </div>
        <div className="flex items-end">
          <button 
            onClick={fetchData}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg p-3 text-sm font-bold transition-all shadow-md active:scale-95"
          >
            <i className="fa-solid fa-rotate mr-2"></i> Refresh Data
          </button>
        </div>
      </div>

      {/* Live Market Card */}
      {ticker && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">
              <i className="fa-brands fa-bitcoin"></i>
            </div>
            <h3 className="text-slate-500 text-xs font-bold uppercase mb-1">Current Price</h3>
            <p className="text-2xl font-black mono text-slate-900">
              ₩{ticker.currentPrice.toLocaleString()}
            </p>
            <span className={`text-xs font-bold ${ticker.changeRate >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {ticker.changeRate >= 0 ? '+' : ''}{(ticker.changeRate * 100).toFixed(2)}%
            </span>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-indigo-500">
            <h3 className="text-slate-500 text-xs font-bold uppercase mb-1">Buy Target (HPR)</h3>
            <p className="text-2xl font-black mono text-indigo-600">
              ₩{Math.round(ticker.targetPrice).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Distance: <span className="font-bold text-slate-600">
                {(((ticker.targetPrice / ticker.currentPrice) - 1) * 100).toFixed(2)}%
              </span>
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-slate-500 text-xs font-bold uppercase mb-1">Cumulative Return</h3>
            <p className={`text-2xl font-black mono ${Number(finalReturn) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {finalReturn}%
            </p>
            <p className="text-xs text-slate-400 mt-1 italic">Based on {days} days backtest</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-slate-500 text-xs font-bold uppercase mb-1">Max Drawdown (MDD)</h3>
            <p className="text-2xl font-black mono text-rose-500">
              -{mdd}%
            </p>
            <p className="text-xs text-slate-400 mt-1 italic">Risk stability indicator</p>
          </div>
        </div>
      )}

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[450px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-slate-800">Strategy Yield Curve</h2>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Strategy
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span> Asset Price
              </span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-300">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl"></i>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={results}>
                  <defs>
                    <linearGradient id="colorHpr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [parseFloat(value).toFixed(4), "Multiplier"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="hpr" 
                    stroke="#6366f1" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorHpr)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* AI Analysis Panel */}
        <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Gemini AI Insights</h2>
            <i className="fa-solid fa-sparkles text-indigo-400"></i>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed scrollbar-hide">
            {aiReport ? (
              <div className="prose prose-invert prose-sm">
                {aiReport.split('\n').map((line, i) => (
                   <p key={i}>{line}</p>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                <i className="fa-solid fa-brain text-4xl"></i>
                <p className="text-center">Click analyze to get personalized strategy feedback from Gemini.</p>
              </div>
            )}
          </div>

          <button 
            disabled={isAnalyzing || loading}
            onClick={handleAiAnalysis}
            className="mt-6 w-full py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center disabled:opacity-50"
          >
            {isAnalyzing ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-bolt mr-2"></i>}
            Analyze Strategy
          </button>
        </div>
      </div>
      
      {/* Bottom Table */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <h2 className="text-lg font-black text-slate-800 mb-6">Recent Backtest Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Date</th>
                <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Closing Price</th>
                <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Buy Target</th>
                <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Signal</th>
                <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Daily PnL</th>
                <th className="pb-4 font-bold text-slate-400 uppercase text-[10px]">Cum. HPR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {results.slice(-10).reverse().map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 text-slate-500 mono">{r.date}</td>
                  <td className="py-4 font-bold">₩{Math.round(r.price).toLocaleString()}</td>
                  <td className="py-4 text-slate-500">₩{Math.round(r.target).toLocaleString()}</td>
                  <td className="py-4">
                    {r.isBought ? (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase">BUY</span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-100 text-slate-400 rounded-full text-[10px] font-black uppercase">WAIT</span>
                    )}
                  </td>
                  <td className={`py-4 font-bold ${r.ror > 0 ? 'text-emerald-500' : r.ror < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                    {r.ror > 0 ? '+' : ''}{r.ror.toFixed(2)}%
                  </td>
                  <td className="py-4 font-bold text-slate-900">{r.hpr.toFixed(4)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
