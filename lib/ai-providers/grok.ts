// Grok uses an OpenAI-compatible API
import OpenAI from 'openai';
import { AICallResult } from '@/types';

export async function callGrok(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  modelId?: string
): Promise<AICallResult> {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1',
  });

  const response = await client.chat.completions.create({
    model: modelId || 'grok-2',
    max_tokens: 2048,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  const tokensUsed = response.usage?.total_tokens;

  return { text, tokensUsed };
}
