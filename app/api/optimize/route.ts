import { NextRequest, NextResponse } from 'next/server';
import { OptimizeRequest, OptimizeResponse } from '@/types';
import { callAIProvider } from '@/lib/ai-providers';
import { batchCheckURLs } from '@/lib/url-checker';
import { findBestMatchingURLs } from '@/lib/url-matcher';
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

    const { content, primaryKeyword, urls, provider, apiKey, model } =
      body as OptimizeRequest;

    // ── 2. Pre-filter: find top 30 most relevant URLs using slug matching ──
    let candidateURLs = findBestMatchingURLs(content, urls, primaryKeyword, 30);

    // Fallback: if fewer than 3 relevant URLs found, widen the search
    if (candidateURLs.length < 3) {
      candidateURLs = findBestMatchingURLs(content, urls.slice(0, 100), primaryKeyword, 30);
    }

    // ── 3. HEAD-check the candidate URLs for liveness ──────────────────────
    const urlCheckResults = await batchCheckURLs(
      candidateURLs.map((u) => u.url),
      { timeout: 5000, maxConcurrent: 10, retries: 1 }
    );

    const liveSet = new Set(
      urlCheckResults.filter((r) => r.isLive).map((r) => r.url)
    );

    let liveURLs = candidateURLs.filter((u) => liveSet.has(u.url));

    // ── 4. Second fallback: if <3 live, check next 50 unchecked URLs ──────
    if (liveURLs.length < 3) {
      const alreadyChecked = new Set(candidateURLs.map((u) => u.url));
      const remaining = urls.filter((u) => !alreadyChecked.has(u)).slice(0, 50);

      if (remaining.length > 0) {
        const extraCandidates = findBestMatchingURLs(content, remaining, primaryKeyword, 20);
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

    // Last resort: use candidates without confirmed liveness
    if (liveURLs.length === 0) {
      liveURLs = candidateURLs.slice(0, 15);
    }

    const liveUrlCount = liveURLs.length;

    // ── 5. Build the AI prompt ─────────────────────────────────────────────
    const prompt = buildPrompt({
      content,
      primaryKeyword,
      liveURLs: liveURLs.slice(0, 15),
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

    // ── 8. Final validation: anchor texts must exist in original content ───
    const validatedLinks = parsed.internalLinks.filter((link) =>
      content.toLowerCase().includes(link.anchorText.toLowerCase())
    );

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
      // DB write failure must NOT break the response to the user
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

    // Surface specific HTTP error codes from AI provider SDKs
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
