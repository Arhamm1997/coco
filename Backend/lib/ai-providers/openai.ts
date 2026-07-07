import OpenAI from 'openai';
import { AICallResult } from '@/types';

export async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  modelId?: string
): Promise<AICallResult> {
  const client = new OpenAI({ apiKey });

  // No max_tokens — the model may use its full output budget, so the
  // response is never truncated mid-field.
  const response = await client.chat.completions.create({
    model: modelId || 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  const tokensUsed = response.usage?.total_tokens;

  return { text, tokensUsed };
}
