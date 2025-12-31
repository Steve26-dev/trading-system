
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine, BarChart, Bar
} from 'recharts';
import { SUPPORTED_COINS, DEFAULT_K, DEFAULT_FEE } from '../constants';
import { fetchBacktest } from '../services/backendService';
import { analyzeStrategyPerformance } from '../services/geminiService';
import { AiReport, MarketTicker } from '../types';

const Dashboard: React.FC = () => {
  const [symbol, setSymbol] = useState(SUPPORTED_COINS[0].symbol);
  const [k, setK] = useState(DEFAULT_K);
  const [days, setDays] = useState(100);
  const [useMaFilter, setUseMaFilter] = useState(true);
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [aiCached, setAiCached] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { data, isFetching, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['backtest', symbol, k, days, useMaFilter],
    queryFn: () => fetchBacktest({ symbol, k, fee: DEFAULT_FEE, days, useMaFilter }),
    staleTime: 30000,
    retry: 2,
    placeholderData: (previous) => previous,
  });

  const results = data?.results ?? [];
  const tradeSummary = data?.tradeSummary ?? null;
  const metrics = data?.metrics ?? null;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;
  const errorMessage = isError ? "백엔드 응답에 실패했습니다. 잠시 후 다시 시도하세요." : null;

  const winRateValue = metrics ? metrics.winRate : 0;
  const totalReturnValue = metrics ? metrics.totalReturn : 0;
  const mddValue = metrics ? metrics.mdd : 0;

  useEffect(() => {
    if (data?.ticker) {
      setTicker(data.ticker);
    }
  }, [data?.ticker, dataUpdatedAt]);

  useEffect(() => {
    setAiReport(null);
    setAiCached(false);
  }, [symbol, k, days, useMaFilter]);

  const buildWsUrl = (path: string) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    if (baseUrl) {
      const wsBase = baseUrl.replace(/^http/, 'ws');
      return `${wsBase}${path}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}${path}`;
  };

  useEffect(() => {
    if (!symbol) return;
    const wsUrl = buildWsUrl(`/ws/ticker?symbols=${encodeURIComponent(symbol)}`);
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.symbol !== symbol) return;
        setTicker((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentPrice: payload.currentPrice ?? prev.currentPrice,
            changeRate: payload.changeRate ?? prev.changeRate,
          };
        });
      } catch (err) {
        console.error('Ticker stream parse failed', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol]);

  const handleAiAnalysis = async () => {
    if (!metrics || !tradeSummary) return;
    setIsAnalyzing(true);
    try {
      const response = await analyzeStrategyPerformance({
        symbol,
        k,
        fee: DEFAULT_FEE,
        days,
        useMaFilter,
        metrics,
        tradeSummary,
      });
      if (response?.report) {
        setAiReport(response.report);
        setAiCached(response.cached);
      } else {
        setAiReport({
          summary: '분석할 데이터가 충분하지 않습니다.',
          risks: [],
          parameterSuggestions: [],
          whatToWatch: [],
        });
        setAiCached(false);
      }
    } catch (error) {
      console.error('AI analysis failed', error);
      setAiReport({
        summary: 'AI 분석을 불러오는 중 오류가 발생했습니다.',
        risks: [],
        parameterSuggestions: [],
        whatToWatch: [],
      });
      setAiCached(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-6 space-y-8 fade-in">
      {/* Simulation Setup Bar */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center bg-white border border-slate-200 p-4 rounded-2xl neo-shadow">
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Symbol</label>
            <select 
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none cursor-pointer"
            >
              {SUPPORTED_COINS.map(c => <option key={c.symbol} value={c.symbol}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sensitivity K</label>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 h-10">
              <input type="range" min="0.3" max="0.7" step="0.05" value={k} onChange={(e) => setK(parseFloat(e.target.value))} className="flex-1 accent-indigo-600 h-1.5" />
              <span className="mono text-xs font-black text-slate-700 w-8">{k.toFixed(2)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Strategy</label>
            <button 
              onClick={() => setUseMaFilter(!useMaFilter)}
              className={`w-full h-10 flex items-center justify-center gap-2 rounded-xl text-xs font-black transition-all border ${useMaFilter ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
            >
              <i className={`fa-solid ${useMaFilter ? 'fa-check-circle' : 'fa-circle-xmark'}`}></i>
              MA5 Trend
            </button>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Timeline</label>
            <select 
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none appearance-none cursor-pointer"
            >
              <option value={100}>100 Days</option>
              <option value={365}>1 Year</option>
            </select>
          </div>
        </div>
        <div className="xl:w-48 flex items-end">
          <button 
            onClick={() => refetch()}
            className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <i className="fa-solid fa-play"></i> Run Analytics
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      {errorMessage ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-xs font-bold flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation"></i>
          {errorMessage}
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-2xl premium-card flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Market Price</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><i className="fa-solid fa-coins"></i></div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black mono text-slate-900 leading-none">₩{ticker ? ticker.currentPrice.toLocaleString() : '---'}</p>
            <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${ticker && ticker.changeRate >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <i className={`fa-solid fa-caret-${ticker && ticker.changeRate >= 0 ? 'up' : 'down'}`}></i>
              {ticker ? (ticker.changeRate * 100).toFixed(2) : '0.00'}%
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl premium-card border-l-4 border-l-indigo-600 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Target</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><i className="fa-solid fa-crosshairs"></i></div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black mono text-indigo-600 leading-none">₩{Math.round(ticker?.targetPrice || 0).toLocaleString()}</p>
            <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {ticker && ticker.currentPrice >= ticker.targetPrice ? '🎯 Breach Confirmed' : 'Waiting for Volatility'}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl premium-card flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Win Probability</span>
            <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center"><i className="fa-solid fa-percent"></i></div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black mono text-slate-900 leading-none">{winRateValue.toFixed(1)}%</p>
            <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-indigo-500" style={{ width: `${winRateValue}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl shadow-indigo-100 text-white flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Net Yield</span>
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center"><i className="fa-solid fa-chart-line"></i></div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-black mono leading-none">
              {totalReturnValue >= 0 ? '+' : ''}
              {totalReturnValue.toFixed(2)}%
            </p>
            <p className="mt-2 text-[10px] font-bold text-indigo-100">
              Across {metrics ? metrics.totalDays : 0} Sessions {lastUpdated ? `• ${lastUpdated}` : ''}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl premium-card flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max Drawdown</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><i className="fa-solid fa-shield-halved"></i></div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-black mono text-rose-500 leading-none">-{mddValue.toFixed(2)}%</p>
            <p className={`mt-2 text-[10px] font-bold ${mddValue < 10 ? 'text-emerald-500' : 'text-slate-400'} uppercase`}>
              Risk Status: {mddValue < 10 ? 'Elite' : 'Moderate'}
            </p>
          </div>
        </div>
      </div>

      {/* Charts & AI Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Main Chart Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 neo-shadow min-h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">Equity Curve Projection</h2>
                <p className="text-xs text-slate-400 font-medium">Visualizing compounded historical performance</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-500"></div><span className="text-[10px] font-black text-slate-400 uppercase">Strategy</span></div>
                <div className="h-4 w-px bg-slate-200"></div>
                <button className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"><i className="fa-solid fa-download mr-1"></i> Data</button>
              </div>
            </div>
            
            <div className="flex-1 w-full">
              {isFetching ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-black text-slate-400 animate-pulse">Analyzing Candle Patterns...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={results} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" hide />
                    <YAxis domain={['auto', 'auto']} stroke="#94A3B8" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', background: '#1E293B', color: '#fff' }}
                      itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <ReferenceLine y={1} stroke="#E2E8F0" strokeWidth={2} strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="hpr" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#curveGradient)" animationDuration={2000} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Daily Distribution Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 neo-shadow">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Execution Distribution</h2>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.slice(-30)}>
                  <Bar 
                    dataKey="ror" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                    background={{ fill: '#F8FAFC' }} 
                  />
                  <XAxis dataKey="date" hide />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} labelStyle={{ display: 'none' }} itemStyle={{ fontWeight: 'black', fontSize: '10px' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Sidebar Area */}
        <div className="lg:col-span-4 space-y-8">
          {/* System Status */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 neo-shadow">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">System Status</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-900">Backtest API</p>
                <p className="text-[10px] text-slate-400 font-bold">/api/backtest</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-black ${errorMessage ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {errorMessage ? 'DEGRADED' : 'OK'}
              </span>
            </div>
            <div className="mt-4 text-[10px] text-slate-400 font-bold flex items-center justify-between">
              <span>Last Update</span>
              <span className="mono text-slate-600">{lastUpdated || '--:--:--'}</span>
            </div>
          </div>

          {/* AI Terminal Card */}
          <div className="bg-[#111827] rounded-3xl p-6 shadow-2xl relative overflow-hidden group min-h-[400px] flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
            
            <div className="flex items-center justify-between mb-8 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                  <i className="fa-solid fa-microchip text-indigo-400 text-sm"></i>
                </div>
                <h3 className="text-white font-bold text-sm tracking-tight">AI Strategy Advisor</h3>
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto z-10 space-y-6 scrollbar-hide text-slate-400 text-xs leading-relaxed pr-2">
              {aiReport ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Summary</p>
                    <p className="mt-2 text-slate-200">{aiReport.summary}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Risks</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {aiReport.risks.length > 0 ? (
                        aiReport.risks.map((item, i) => <li key={i}>• {item}</li>)
                      ) : (
                        <li className="text-slate-500">없음</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Parameter Suggestions</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {aiReport.parameterSuggestions.length > 0 ? (
                        aiReport.parameterSuggestions.map((item, i) => <li key={i}>• {item}</li>)
                      ) : (
                        <li className="text-slate-500">없음</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">What To Watch</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {aiReport.whatToWatch.length > 0 ? (
                        aiReport.whatToWatch.map((item, i) => <li key={i}>• {item}</li>)
                      ) : (
                        <li className="text-slate-500">없음</li>
                      )}
                    </ul>
                  </div>
                  {aiCached ? (
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cached Result</p>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <i className="fa-solid fa-brain text-slate-600 text-2xl"></i>
                  </div>
                  <p className="text-slate-500 font-medium px-4">Ready to perform deep-learning optimization on current metrics.</p>
                </div>
              )}
            </div>

            <button 
              disabled={isAnalyzing || isFetching || !metrics || !tradeSummary}
              onClick={handleAiAnalysis}
              className="mt-6 w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-950/50 disabled:opacity-50 z-10"
            >
              {isAnalyzing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
              {isAnalyzing ? 'SYNCHRONIZING...' : 'GENERATE INSIGHTS'}
            </button>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 neo-shadow">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Recent Execution Flow</h3>
            <div className="space-y-4">
              {results.slice(-5).reverse().map((r, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${r.isBought ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                    {r.isBought ? 'B' : 'S'}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-slate-900 leading-none">{r.date}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{r.isBought ? 'Signal Executed' : 'Threshold not met'}</p>
                  </div>
                  <div className={`text-xs font-black mono ${r.ror > 0 ? 'text-emerald-500' : r.ror < 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                    {r.isBought ? (r.ror > 0 ? '+' : '') + r.ror.toFixed(2) + '%' : '0.00%'}
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:bg-slate-50 transition-colors uppercase tracking-widest">
              View Full Audit Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
