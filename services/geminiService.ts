
import { GoogleGenAI, Type } from "@google/genai";
import { BacktestResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeStrategyPerformance(results: BacktestResult[], k: number) {
  const finalReturn = results[results.length - 1].hpr;
  const winRate = (results.filter(r => r.isBought && r.ror > 0).length / results.filter(r => r.isBought).length) * 100;
  
  const prompt = `
    퀀트 투자 전략(변동성 돌파) 분석 리포트를 작성해줘.
    - 현재 K값: ${k}
    - 누적 수익률: ${((finalReturn - 1) * 100).toFixed(2)}%
    - 승률(매수 시): ${winRate.toFixed(2)}%
    
    위 데이터를 바탕으로:
    1. 현재 전략의 강점과 약점을 요약해줘.
    2. 시장 상황에 따른 K값 조절 제안을 해줘.
    3. 의대생이 학업과 병행하며 리스크를 줄일 수 있는 운용 팁을 3가지만 제시해줘.
    
    한국어로 답변하고, 마크다운 형식을 사용해.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return "AI 분석을 불러오는 중 오류가 발생했습니다.";
  }
}

export async function optimizeKValue(data: any[]) {
  // Logic to find best K could be here, or just ask Gemini to suggest based on volatility
}
