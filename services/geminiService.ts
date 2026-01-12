
import { GoogleGenAI } from "@google/genai";
import { AppData } from "../types";

export const analyzeDebtSituation = async (data: AppData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const loanSummary = data.loans.map(l => 
    `- ${l.name} (${l.type}): 原始金額 ${l.originalAmount.toLocaleString()}, 目前餘額 ${l.currentBalance.toLocaleString()}, 年利率 ${l.interestRate}%, 放款日期 ${l.startDate}, 寬限期 ${l.gracePeriod}期, 已繳期數 ${l.paidInstallments}, 總共期數 ${l.totalInstallments}`
  ).join('\n');

  const paymentCount = data.payments.length;

  const prompt = `
    你是一位專業的台灣房地產與個人財務分析師。
    以下是使用者的最新貸款與信貸資料（包含寬限期與還款進度）：
    ${loanSummary}
    
    最近已有 ${paymentCount} 筆還款記錄。
    
    請根據這些資料提供：
    1. 目前債務健康狀況簡評。
    2. 針對還款剩餘時間（總期數 vs 已繳期數）的財務壓力預測。
    3. 針對「寬限期」即將結束的風險評估（尤其是新青安與一般房貸）。
    4. 是否有債務整合建議（例如針對信貸的高還款壓力）。
    5. 提前還款策略：建議優先償還哪一筆？
    
    請用繁體中文回答，語氣專業且溫暖，多使用列表點出重點，並使用 Markdown 格式。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "無法取得 AI 分析結果。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI 分析服務暫時不可用，請稍後再試。";
  }
};
