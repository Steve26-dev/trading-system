
import { GoogleGenAI, Type } from "@google/genai";
import { BacktestResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeStrategyPerformance(results: BacktestResult[], k: number) {
  if (results.length === 0) return "분석할 데이터가 충분하지 않습니다.";

  const finalReturn = results[results.length - 1].hpr;
  const tradeDays = results.filter(r => r.isBought);
  const winRate = tradeDays.length > 0 ? (tradeDays.filter(r => r.ror > 0).length / tradeDays.length) * 100 : 0;
  
  // Calculate MDD
  let maxHpr = 0;
  let maxDrawdown = 0;
  results.forEach(r => {
    if (r.hpr > maxHpr) maxHpr = r.hpr;
    const dd = (maxHpr - r.hpr) / maxHpr;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  const prompt = `
    퀀트 투자 전략(변동성 돌파 + MA5 필터) 정밀 분석 리포트:
    
    [통계 데이터]
    - 설정 K값: ${k}
    - 누적 수익률: ${((finalReturn - 1) * 100).toFixed(2)}%
    - 승률(매수 시): ${winRate.toFixed(2)}%
    - 최대 낙폭(MDD): ${(maxDrawdown * 100).toFixed(2)}%
    - 총 매매 횟수: ${tradeDays.length}회
    
    위 데이터를 바탕으로:
    1. 현재 시장 상황에서 이 전략이 '방어적'인지 '공격적'인지 평가해줘.
    2. MDD를 줄이기 위한 추가적인 리스크 관리 방안을 제안해줘.
    3. 의대생 사용자가 학업 집중 기간(시험 기간 등)에 이 봇을 계속 돌려도 될지, 아니면 일시 중지해야 할지에 대한 의견을 통계 근거로 제시해줘.
    
    한국어로 답변하고, 시니어 퀀트 애널리스트처럼 전문적이고 신뢰감 있는 말투로 작성해줘.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return "AI 분석을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}
