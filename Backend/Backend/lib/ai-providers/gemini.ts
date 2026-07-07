import { GoogleGenerativeAI } from '@google/generative-ai';
import { AICallResult } from '@/types';

export async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  modelId?: string
): Promise<AICallResult> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: modelId || 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  const tokensUsed = result.response.usageMetadata?.totalTokenCount;

  return { text, tokensUsed };
}
