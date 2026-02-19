import { CallProviderArgs, AICallResult } from '@/types';
import { callClaude } from './claude';
import { callOpenAI } from './openai';
import { callGemini } from './gemini';
import { callGrok } from './grok';

export async function callAIProvider({
  provider,
  apiKey,
  prompt,
  systemPrompt,
  model,
}: CallProviderArgs): Promise<AICallResult> {
  switch (provider) {
    case 'claude':
      return callClaude(apiKey, systemPrompt, prompt, model);
    case 'openai':
      return callOpenAI(apiKey, systemPrompt, prompt, model);
    case 'gemini':
      return callGemini(apiKey, systemPrompt, prompt, model);
    case 'grok':
      return callGrok(apiKey, systemPrompt, prompt, model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
