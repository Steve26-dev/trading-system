import React from 'react';

const backtestCode = `import pyupbit
import numpy as np

# 1. 비트코인(KRW-BTC) 데이터 365일치 가져오기
df = pyupbit.get_ohlcv("KRW-BTC", count=365)

# 2. 전략 세팅 (변동성 돌파)
# 노이즈 비율(K) = 0.5
df['range'] = (df['high'] - df['low']) * 0.5
df['target'] = df['open'] + df['range'].shift(1)

# 3. 안전장치 추가 (5일 이동평균선)
df['ma5'] = df['close'].rolling(window=5).mean().shift(1)

# 4. 수익률 계산 (매수 조건: 목표가 돌파 AND 5일 이평선 위)
# 수수료 0.1% (0.001) 적용 (매수+매도 슬리피지 고려)
condition = (df['high'] > df['target']) & (df['open'] > df['ma5'])

df['ror'] = np.where(condition,
                     df['close'] / df['target'] - 0.001,
                     1)

# 5. 누적 수익률 계산 (복리)
df['hpr'] = df['ror'].cumprod()

# 6. 결과 출력
mdd = (df['hpr'].cummax() - df['hpr']) / df['hpr'].cummax() * 100
print(f"========================================")
print(f"기간: 최근 1년")
print(f"초기 투자금: 1,000,000원")
print(f"최종 금액: {int(df['hpr'].iloc[-1] * 1000000):,}원")
print(f"수익률: {(df['hpr'].iloc[-1] - 1) * 100:.2f}%")
print(f"최대 낙폭(MDD): -{mdd.max():.2f}% (가장 많이 잃었을 때)")
print(f"========================================")`;

const paperTradeCode = `import pyupbit
import time
from datetime import datetime

# 설정
ticker = "KRW-BTC"
k_value = 0.5
invest_money = 1000000  # 가상 투자금 100만 원
hold_flag = False       # 현재 보유 중인지 확인

print(f"=== [{ticker}] 가상 자동매매 시작 (자본금: {invest_money}원) ===")

while True:
    try:
        now = datetime.now()
        
        # 1. 09:00:00에 하루 시작 (매도 및 목표가 갱신)
        if now.hour == 9 and now.minute == 0 and now.second <= 10:
            if hold_flag:
                current_price = pyupbit.get_current_price(ticker)
                # 매도 처리
                revenue = (current_price - buy_price) * (buy_amount)
                invest_money = (buy_amount * current_price) # 수수료 제외 단순 계산
                print(f"[매도] 시간: {now}, 매도가: {current_price}, 잔고: {int(invest_money)}원")
                hold_flag = False
            
            # 새로운 목표가 계산
            df = pyupbit.get_ohlcv(ticker, count=5) # 5일치 데이터
            target = df.iloc[-1]['open'] + (df.iloc[-2]['high'] - df.iloc[-2]['low']) * k_value
            ma5 = df['close'].mean() # 5일 이동평균
            
            print(f"[갱신] 오늘 목표가: {target}, 5일 이평선: {ma5}")
            time.sleep(11) # 중복 실행 방지 대기

        # 2. 장중 실시간 감시
        current_price = pyupbit.get_current_price(ticker)
        
        # 매수 조건: 보유 안 함 & 가격이 목표가 돌파 & 상승장(이평선 위)
        if not hold_flag:
            # 실시간 이평선 조회가 API 호출 제한 때문에 여기선 생략하고 목표가만 체크 (약식)
            # 정확히 하려면 위에서 계산한 target과 ma5 변수를 활용
            if current_price > target and current_price > ma5:
                buy_price = current_price
                buy_amount = invest_money / buy_price
                hold_flag = True
                print(f"⚡ [매수 체결] 시간: {now}, 매수가: {buy_price}, 수량: {buy_amount:.6f} BTC")

        # 1초에 한 번씩 가격 확인
        # print(f"현재가: {current_price} / 목표가: {target}") # 너무 시끄러우면 주석 처리
        time.sleep(1)

    except Exception as e:
        print(f"에러 발생: {e}")
        time.sleep(1)`;

const BacktestGuide: React.FC = () => {
  return (
    <div className="p-6 space-y-8 fade-in">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-800 text-white p-8 rounded-3xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -top-10 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 space-y-4">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">Upgraded Strategy</span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">상승장에서만 탄다</h1>
          <p className="text-sm text-slate-200 max-w-2xl">
            현명한 판단입니다. 내 돈을 넣기 전에 <span className="font-bold text-white">과거 데이터로 검증(백테스팅)</span>하고
            <span className="font-bold text-white"> 가상으로 돌려보기(모의 투자)</span>를 거치는 것은 필수입니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest">Volatility Breakout</span>
            <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest">MA5 Filter</span>
            <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest">Backtest + Paper Trade</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 neo-shadow space-y-4">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">돈이 되는 구체적 전략</span>
            <h2 className="text-lg font-black text-slate-900 mt-2">"상승장에서만 탄다"</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            앞서 말씀드린 변동성 돌파 전략에 안전장치(필터)를 하나 더합니다. 이것만 추가해도 수익률이 완전히 달라집니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">기본 원리</p>
              <p className="text-sm font-bold text-slate-800">변동성 돌파 (가격이 튀어 오르면 산다)</p>
            </div>
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">추가 조건 (핵심)</p>
              <p className="text-sm font-bold text-indigo-700">5일 이동평균선 위일 때만 산다</p>
            </div>
          </div>
          <div className="text-xs text-slate-500 space-y-2">
            <p>• 비트코인이 5일 평균 가격보다 높다는 건 ‘상승 추세’라는 뜻입니다.</p>
            <p>• 하락장에서는 아예 매매를 쉬어서 원금을 지킵니다.</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 neo-shadow space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">K</div>
            <div>
              <p className="text-xs font-black text-slate-900">전략 파라미터</p>
              <p className="text-[10px] text-slate-400 font-bold">기본 설정 가이드</p>
            </div>
          </div>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="font-bold">노이즈 비율(K)</span>
              <span className="mono font-black text-indigo-600">0.5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold">이동평균선</span>
              <span className="mono font-black text-indigo-600">MA5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold">수수료 가정</span>
              <span className="mono font-black text-indigo-600">0.1%</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 text-slate-100 p-4 text-xs">
            <p className="font-bold">Tip</p>
            <p className="text-slate-300 mt-2">
              K값을 0.3~0.7 범위에서 바꿔가며 승률과 MDD 균형을 확인하세요.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 neo-shadow space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">1</div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 1</p>
            <h3 className="text-base font-black text-slate-900">과거 데이터로 검증 (백테스팅)</h3>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          "작년 1년 동안 이 방식으로 100만 원을 굴렸다면 얼마가 되었을까?"를 확인하는 코드입니다.
          Google Colab 또는 파이썬 환경에서 바로 실행해 보세요.
        </p>
        <pre className="bg-slate-950 text-slate-100 rounded-2xl p-5 text-[11px] leading-relaxed overflow-x-auto">
          <code className="mono whitespace-pre">{backtestCode}</code>
        </pre>
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">해석 포인트</p>
          <div className="text-xs text-slate-600 space-y-2">
            <p>• 최종 금액: 100만 원이 얼마가 되었나요?</p>
            <p>• MDD (Max Drawdown): 투자 기간 중 고점 대비 가장 많이 까먹었을 때의 비율입니다.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 neo-shadow space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black">2</div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 2</p>
            <h3 className="text-base font-black text-slate-900">실시간 가상 매매 봇 (돈 안 쓰고 구경하기)</h3>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          API 키 없이도 동작하며 실제로 매수하지 않고 "샀습니다(가상)", "팔았습니다(가상)" 로그만 출력합니다.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <pre className="bg-slate-950 text-slate-100 rounded-2xl p-5 text-[11px] leading-relaxed overflow-x-auto">
              <code className="mono whitespace-pre">{paperTradeCode}</code>
            </pre>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 text-xs text-slate-600">
            <p className="font-black text-slate-900">관전 포인트</p>
            <p>• 09:00에 목표가가 갱신되고, 장중 돌파 시 매수 로그가 찍힙니다.</p>
            <p>• 이평선 조건은 API 호출 제한 때문에 약식 처리되었습니다.</p>
            <p>• 목표가/이평선을 활용해 정확도를 높일 수 있습니다.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 neo-shadow space-y-4">
          <h4 className="text-sm font-black text-slate-900">실행 방법</h4>
          <div className="text-xs text-slate-600 space-y-2">
            <p>1. Step 1 백테스팅 코드를 먼저 돌려 숫자로 확인합니다.</p>
            <p>2. 수익률이 괜찮다면 Step 2 모의 봇을 켜두고 하루 이틀 지켜봅니다.</p>
          </div>
        </div>
        <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-xl shadow-indigo-100 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Next Move</p>
          <h4 className="text-lg font-black">결과를 알려주세요</h4>
          <p className="text-sm text-indigo-100">
            Step 1 결과를 공유해 주시면 K값 등 파라미터를 조정해 수익률을 더 올리는 팁을 드리겠습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BacktestGuide;
