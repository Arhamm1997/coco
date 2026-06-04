import { NextRequest, NextResponse } from 'next/server';
import { OptimizeRequest, OptimizeResponse } from '@/types';
import { callAIProvider } from '@/lib/ai-providers';
import { batchCheckURLs } from '@/lib/url-checker';
import { findBestMatchingURLs, findBestMatchingURLsRelaxed, anchorIsRelevantToURL } from '@/lib/url-matcher';
import { buildPrompt, buildSystemPrompt } from '@/lib/prompt-builder';
import { parseAIResponse } from '@/lib/response-parser';
import { validateOptimizeRequest } from '@/lib/validators';
import { connectDB } from '@/lib/db/connection';
import { GenerationResult } from '@/lib/db/models/GenerationResult';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body: unknown = await req.json();

    // ── 1. Validate input ──────────────────────────────────────────────────
    const validation = validateOptimizeRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.message } satisfies OptimizeResponse,
        { status: 400 }
      );
    }

    const { content, primaryKeyword, urls, provider, model } = body as OptimizeRequest;
    const rawApiKey = (body as OptimizeRequest).apiKey;

    // ── 1b. Resolve API key — use request key, else fall back to server env var ──
    const ENV_KEY_MAP: Record<string, string> = {
      claude:  'ANTHROPIC_API_KEY',
      openai:  'OPENAI_API_KEY',
      gemini:  'GEMINI_API_KEY',
      grok:    'GROK_API_KEY',
    };
    const apiKey = rawApiKey?.trim() || process.env[ENV_KEY_MAP[provider] ?? ''] || '';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `No API key provided and no ${ENV_KEY_MAP[provider]} environment variable is set on the server.` } satisfies OptimizeResponse,
        { status: 400 }
      );
    }

    // ── 2. Search the COMPLETE uploaded URL sheet for top candidates ────────
    // Strict search: requires pre-confirmed anchor text in content + relevance
    let candidateURLs = findBestMatchingURLs(content, urls, primaryKeyword, 50);

    // Fallback: if < 3 strict matches from the full sheet, relax anchor requirement
    // Claude will find the anchor text itself from the article
    if (candidateURLs.length < 3) {
      candidateURLs = findBestMatchingURLsRelaxed(content, urls, primaryKeyword, 50);
    }

    // ── 3. HEAD-check the top candidates for liveness ──────────────────────
    const urlCheckResults = await batchCheckURLs(
      candidateURLs.map((u) => u.url),
      { timeout: 5000, maxConcurrent: 10, retries: 1 }
    );

    const liveSet = new Set(
      urlCheckResults.filter((r) => r.isLive).map((r) => r.url)
    );

    let liveURLs = candidateURLs.filter((u) => liveSet.has(u.url));

    // ── 4. Second fallback: HEAD-check ALL remaining unchecked URLs ─────────
    if (liveURLs.length < 3) {
      const alreadyChecked = new Set(candidateURLs.map((u) => u.url));
      // Use every remaining URL from the full sheet — no artificial slice limit
      const remaining = urls.filter((u) => !alreadyChecked.has(u));

      if (remaining.length > 0) {
        const extraCandidates = findBestMatchingURLsRelaxed(
          content,
          remaining,
          primaryKeyword,
          50
        );
        const extraChecks = await batchCheckURLs(
          extraCandidates.map((u) => u.url),
          { timeout: 5000, maxConcurrent: 10, retries: 1 }
        );
        const extraLiveSet = new Set(
          extraChecks.filter((r) => r.isLive).map((r) => r.url)
        );
        const extraLive = extraCandidates.filter((u) => extraLiveSet.has(u.url));
        liveURLs = [...liveURLs, ...extraLive];
      }
    }

    // Last resort: use top candidates even without confirmed liveness
    if (liveURLs.length === 0) {
      liveURLs = candidateURLs.slice(0, 25);
    }

    const liveUrlCount = liveURLs.length;

    // ── 5. Build the AI prompt — pass top 25 live URLs ─────────────────────
    const prompt = buildPrompt({
      content,
      primaryKeyword,
      liveURLs: liveURLs.slice(0, 25),
    });

    // ── 6. Call the selected AI provider ──────────────────────────────────
    const aiResponse = await callAIProvider({
      provider,
      apiKey,
      prompt,
      systemPrompt: buildSystemPrompt(),
      model,
    });

    // ── 7. Parse the structured AI response ───────────────────────────────
    const parsed = parseAIResponse(aiResponse.text, content);

    // ── 8. Validate links: anchor must exist verbatim in content ──────────────
    // Strip any residual surrounding quotes before checking, in case the parser
    // missed edge cases (e.g. nested quotes or unusual Unicode variants).
    const validatedLinks = parsed.internalLinks.filter((link) => {
      const cleanAnchor = link.anchorText
        .replace(/^[""''«»"'`]+/, '')
        .replace(/[""''«»"'`]+$/, '')
        .trim();
      // Update the stored anchor text to the cleaned version
      link.anchorText = cleanAnchor;
      return content.toLowerCase().includes(cleanAnchor.toLowerCase());
    });

    const durationMs = Date.now() - startTime;

    // ── 9. Persist the generation result to MongoDB ────────────────────────
    try {
      await connectDB();
      await GenerationResult.create({
        provider,
        primaryKeyword:          primaryKeyword.trim(),
        contentSnippet:          content.slice(0, 300),
        urlCount:                urls.length,
        liveUrlCount,
        h2:                      parsed.h2,
        h3:                      parsed.h3,
        paragraph1:              parsed.paragraph1,
        paragraph2:              parsed.paragraph2,
        metaTitle:               parsed.metaTitle,
        metaDescription:         parsed.metaDescription,
        internalLinks:           validatedLinks,
        placementRecommendation: parsed.placementRecommendation,
        tokensUsed:              aiResponse.tokensUsed,
        durationMs,
      });
    } catch (dbErr: unknown) {
      console.error('[/api/optimize] MongoDB write failed:', dbErr);
    }

    // ── 10. Return success response ────────────────────────────────────────
    const response: OptimizeResponse = {
      success: true,
      data: {
        h2:                      parsed.h2,
        h3:                      parsed.h3,
        paragraph1:              parsed.paragraph1,
        paragraph2:              parsed.paragraph2,
        metaTitle:               parsed.metaTitle,
        metaDescription:         parsed.metaDescription,
        internalLinks:           validatedLinks,
        placementRecommendation: parsed.placementRecommendation,
        provider,
        tokensUsed:              aiResponse.tokensUsed,
      },
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error('[/api/optimize] Error:', err);

    if (typeof err === 'object' && err !== null && 'status' in err) {
      const status = (err as { status: number }).status;

      if (status === 401) {
        return NextResponse.json(
          { success: false, error: 'Invalid API key. Please check your credentials.' } satisfies OptimizeResponse,
          { status: 401 }
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { success: false, error: 'Rate limit reached. Please wait a moment and try again.' } satisfies OptimizeResponse,
          { status: 429 }
        );
      }
    }

    const message =
      err instanceof Error ? err.message : 'Optimization failed. Please try again.';

    return NextResponse.json(
      { success: false, error: message } satisfies OptimizeResponse,
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
