import { NextRequest, NextResponse } from 'next/server';
import { OptimizeRequest, OptimizeResponse } from '@/types';
import { callAIProvider } from '@/lib/ai-providers';
import { findBestMatchingURLs, findBestMatchingURLsRelaxed, buildInternalLinks } from '@/lib/url-matcher';
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

    // ── 2. Find the most relevant URLs from the spreadsheet ────────────────
    // The spreadsheet is the authority — no HTTP liveness check needed.
    // Strict search first: requires pre-confirmed anchor text in content + relevance.
    let candidateURLs = findBestMatchingURLs(content, urls, primaryKeyword, 50);

    // Relaxed fallback: relevance score only — no pre-confirmed anchor required.
    if (candidateURLs.length < 3) {
      candidateURLs = findBestMatchingURLsRelaxed(content, urls, primaryKeyword, 50);
    }

    // Final fallback: if still under 10 candidates, pad with more relaxed matches
    // from the remaining pool so the AI always has enough URLs to choose from.
    if (candidateURLs.length < 10) {
      const seen = new Set(candidateURLs.map((u) => u.url));
      const extras = findBestMatchingURLsRelaxed(
        content,
        urls.filter((u) => !seen.has(u)),
        primaryKeyword,
        50
      );
      candidateURLs = [...candidateURLs, ...extras].slice(0, 50);
    }

    const topCandidates = candidateURLs.slice(0, 25);
    const liveUrlCount = topCandidates.length;

    // ── 3. Build the AI prompt — pass top 25 candidates ───────────────────
    const prompt = buildPrompt({
      content,
      primaryKeyword,
      liveURLs: topCandidates,
    });

    // ── 4. Call the selected AI provider ──────────────────────────────────
    const aiResponse = await callAIProvider({
      provider,
      apiKey,
      prompt,
      systemPrompt: buildSystemPrompt(),
      model,
    });

    // ── 5. Parse the structured AI response ───────────────────────────────
    const parsed = parseAIResponse(aiResponse.text, content);

    // ── 6. Build internal links ────────────────────────────────────────────
    // Internal links are built DETERMINISTICALLY from the article content and
    // the uploaded sheet — not left to the AI, which used to paraphrase anchors
    // or pick URLs that failed validation (the recurring "0/3 links" bug).
    // buildInternalLinks reads the content, picks a sensible 2–3 word keyword
    // phrase, and matches it to the most topically relevant sheet URL. Anchors
    // are sliced verbatim from the content and URLs are exact sheet strings, so
    // these always pass validation. We guarantee at least 3 where possible.
    const deterministicLinks = buildInternalLinks(content, urls, primaryKeyword, 3, 3);

    // The AI's own link suggestions act only as a backup to top up to 3 if the
    // deterministic pass came up short. They are validated the same strict way.
    const searchableContent = [
      content,
      parsed.paragraph1,
      parsed.paragraph2,
    ].join('\n').toLowerCase();

    // Build lookup set from the original spreadsheet URLs for O(1) validation
    const urlSet = new Set(urls);
    const usedUrls = new Set(deterministicLinks.map((l) => l.url));
    const usedAnchors = new Set(deterministicLinks.map((l) => l.anchorText.toLowerCase()));

    const validatedAILinks = parsed.internalLinks.filter((link) => {
      // Strip residual bold markers and quotes the AI sometimes adds
      const cleanAnchor = link.anchorText
        .replace(/\*\*/g, '')
        .replace(/^[""''«»"'`]+/, '')
        .replace(/[""''«»"'`]+$/, '')
        .trim();
      link.anchorText = cleanAnchor;

      if (cleanAnchor.length < 2) return false;

      // Rule (c): 2–4 words
      const wordCount = cleanAnchor.split(/\s+/).filter(Boolean).length;
      if (wordCount < 2 || wordCount > 4) return false;

      // Rule (a): anchor must exist verbatim in article or generated paragraphs
      if (!searchableContent.includes(cleanAnchor.toLowerCase())) return false;

      // Rule (b): URL must be an exact match in the spreadsheet database
      if (!urlSet.has(link.url)) return false;

      // Skip anything the deterministic pass already covered (dedupe url + anchor)
      if (usedUrls.has(link.url) || usedAnchors.has(cleanAnchor.toLowerCase())) return false;
      usedUrls.add(link.url);
      usedAnchors.add(cleanAnchor.toLowerCase());

      return true;
    });

    // Deterministic links lead; AI links only fill remaining slots up to 3.
    const validatedLinks = [...deterministicLinks, ...validatedAILinks].slice(0, 3);

    const durationMs = Date.now() - startTime;

    // ── 7. Persist the generation result to MongoDB ────────────────────────
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

    // ── 8. Return success response ─────────────────────────────────────────
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
