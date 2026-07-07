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
    model: modelId || 'claude-sonnet-4-6',
    // Anthropic requires max_tokens, so "unlimited" isn't possible — this is a
    // generous ceiling the output format never reaches, so nothing truncates.
    max_tokens: 8192,
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
