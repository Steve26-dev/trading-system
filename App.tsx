
import React, { useState } from 'react';
import BacktestGuide from './components/BacktestGuide';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: 'backtest', label: 'Backtesting', icon: 'fa-flask' },
    { id: 'portfolio', label: 'Portfolio', icon: 'fa-wallet' },
    { id: 'settings', label: 'Settings', icon: 'fa-sliders' },
  ];
  const activeItem = navItems.find((item) => item.id === activeTab) || navItems[0];

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col fixed inset-y-0 z-50">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-bolt-lightning text-xl"></i>
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-none">QuantDash</h1>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Alpha v2.5</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === item.id
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-5`}></i>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-indigo-500/20 rounded-full blur-2xl"></div>
            <h4 className="text-xs font-bold mb-1">PRO Access</h4>
            <p className="text-[10px] text-slate-400 mb-3">Unlock all strategy parameters.</p>
            <button className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black rounded-lg transition-colors">
              Upgrade Now
            </button>
          </div>
          <p className="mt-4 text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest">
            &copy; 2024 QuantDash
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Overview</span>
            <i className="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">{activeItem.label}</span>
          </div>

          <div className="flex items-center gap-4">
            <button className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
              <i className="fa-solid fa-bell text-xs"></i>
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900 leading-none">Medical Student</p>
                <p className="text-[10px] text-slate-400 font-bold">Trading Mode</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-md">
                MS
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          {activeTab === 'backtest' ? <BacktestGuide /> : <Dashboard />}
        </main>
      </div>
    </div>
  );
};

export default App;
