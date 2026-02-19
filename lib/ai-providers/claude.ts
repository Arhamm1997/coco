import Anthropic from '@anthropic-ai/sdk';
import { AICallResult } from '@/types';

export async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  modelId?: string
): Promise<AICallResult> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: modelId || 'claude-sonnet-4-5-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');

  return {
    text,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}
