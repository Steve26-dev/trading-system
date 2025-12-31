
import { AiReportRequest, AiReportResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function analyzeStrategyPerformance(payload: AiReportRequest): Promise<AiReportResponse | null> {
  if (!payload.metrics || payload.metrics.totalDays === 0) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/ai/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI report request failed (${response.status})`);
  }

  return response.json();
}
