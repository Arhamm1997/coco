import { NextResponse } from 'next/server';

/**
 * GET /api/config
 * Returns which AI providers have pre-configured server-side API keys.
 * The actual key values are never exposed — only a boolean per provider.
 */
export async function GET() {
  return NextResponse.json({
    preconfiguredProviders: {
      claude:  !!process.env.ANTHROPIC_API_KEY,
      openai:  !!process.env.OPENAI_API_KEY,
      gemini:  !!process.env.GEMINI_API_KEY,
      grok:    !!process.env.GROK_API_KEY,
    },
  });
}
