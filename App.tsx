
import React from 'react';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-chart-line text-xl"></i>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900">QuantDash</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Larry Williams Breakout</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <a href="#" className="text-sm font-bold text-slate-600 hover:text-indigo-600">Dashboard</a>
            <a href="#" className="text-sm font-bold text-slate-400 hover:text-indigo-600">Optimization</a>
            <a href="#" className="text-sm font-bold text-slate-400 hover:text-indigo-600">Reports</a>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 transition-all">
              <i className="fa-brands fa-google"></i> Login
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full flex-1">
        <Dashboard />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2 opacity-50 grayscale">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <span className="font-black">QuantDash</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              의대 학업과 병행 가능한 검증된 통계적 전략(Rule-based)을 자동으로 24시간 돌리는 가장 똑똑한 방법.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Resources</h4>
              <ul className="text-sm text-slate-500 space-y-2">
                <li><a href="#" className="hover:text-indigo-600">Backtesting Guide</a></li>
                <li><a href="#" className="hover:text-indigo-600">K-Value Optimization</a></li>
                <li><a href="#" className="hover:text-indigo-600">API Documentation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Support</h4>
              <ul className="text-sm text-slate-500 space-y-2">
                <li><a href="#" className="hover:text-indigo-600">Help Center</a></li>
                <li><a href="#" className="hover:text-indigo-600">Discord Community</a></li>
                <li><a href="#" className="hover:text-indigo-600">Telegram Bot</a></li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-2">Notice</h4>
            <p className="text-xs text-slate-500 leading-normal">
              이 대시보드는 투자 권유를 목적으로 하지 않으며, 모든 투자의 책임은 투자자 본인에게 있습니다. 과거의 수익률이 미래를 보장하지 않습니다.
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <span>&copy; 2024 QuantDash Engineering. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
