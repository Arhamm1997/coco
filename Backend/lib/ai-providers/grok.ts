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

  // No max_tokens — the model may use its full output budget, so the
  // response is never truncated mid-field.
  const response = await client.chat.completions.create({
    model: modelId || 'grok-2',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  const tokensUsed = response.usage?.total_tokens;

  return { text, tokensUsed };
}
