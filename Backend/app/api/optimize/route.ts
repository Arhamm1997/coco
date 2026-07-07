import { NextRequest, NextResponse } from 'next/server';
import { OptimizeRequest, OptimizeResponse } from '@/types';
import { callAIProvider } from '@/lib/ai-providers';
import { findBestMatchingURLsRelaxed, buildInternalLinksFromPages, findAnchorForPage, scorePageRelevance, isQualityAnchor, anchorMatchesPageText, isLikelySelfLink, isSameArticlePage } from '@/lib/url-matcher';
import { fetchPageSummaries } from '@/lib/page-fetcher';
import { finalizeMetaTitle, finalizeMetaDescription } from '@/lib/meta';
import { buildPrompt, buildSystemPrompt } from '@/lib/prompt-builder';
import { parseAIResponse } from '@/lib/response-parser';
import { validateOptimizeRequest } from '@/lib/validators';
import { connectDB } from '@/lib/db/connection';
import { GenerationResult } from '@/lib/db/models/GenerationResult';

// ── Placement helpers ──────────────────────────────────────────────────────
// The AI must quote the opening words of a real paragraph so the editor can
// Ctrl+F the spot. If the quote can't be found verbatim in the article, the
// note is useless — replace it with a deterministic, always-sensible fallback.

function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackPlacement(content: string): string {
  const paras = content
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Prefer the last real paragraph (6+ words) over trailing one-liners/CTAs.
  const lastReal =
    [...paras].reverse().find((p) => p.split(/\s+/).length >= 6) ||
    paras[paras.length - 1] ||
    '';
  const opening = lastReal.split(/\s+/).slice(0, 10).join(' ');
  return `Insert this section immediately before the paragraph that begins: "${opening}". WHY: placing it just before the article's closing paragraph keeps the writer's flow intact — the section reads as a natural lead-in to the conclusion.`;
}

function ensureSensiblePlacement(aiPlacement: string, content: string): string {
  const quoted = aiPlacement.match(/["“”]([^"“”]{10,200})["“”]/);
  if (quoted) {
    const q = normalizeForSearch(quoted[1]);
    // The quote must be the OPENING of a real paragraph — a mid-paragraph
    // sentence would tell the editor to paste the section into the middle of
    // a paragraph. And it must not be the article's FIRST block: inserting
    // above the intro is never editorially sensible.
    const paras = content
      .split(/\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const idx = paras.findIndex((p) => {
      if (normalizeForSearch(p).startsWith(q)) return true;
      // Tolerate markdown/list markers the AI rightly leaves out of its quote
      const unmarked = p.replace(/^[#>*•\-\s]+|^\d+[.)]\s+/g, '');
      return normalizeForSearch(unmarked).startsWith(q);
    });
    if (idx > 0) return aiPlacement;
  }
  return fallbackPlacement(content);
}

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

    // ── 2. Pre-filter by slug, then READ each candidate page ──────────────
    // A keyword in the URL slug is NOT evidence of relevance — the page must
    // actually be about the article's topic. So:
    //   a) narrow the sheet to the top slug-relevant candidates (cheap filter),
    //   b) fetch each candidate and read its REAL title/description/headings/body,
    //   c) keep only pages whose actual content overlaps this article.
    // Small sheets are read in FULL — slug wording must never hide a relevant
    // page, so the slug pre-filter only kicks in when the sheet is too big to
    // fetch whole.
    const uniqueUrls = [...new Set(urls)];
    const READ_POOL = 60;
    const slugCandidates = findBestMatchingURLsRelaxed(content, uniqueUrls, primaryKeyword, READ_POOL);
    if (uniqueUrls.length <= READ_POOL && slugCandidates.length < uniqueUrls.length) {
      const seen = new Set(slugCandidates.map((c) => c.url));
      for (const url of uniqueUrls) {
        if (!seen.has(url)) {
          slugCandidates.push({ url, slug: url, keywords: [], anchorText: null, relevanceScore: 0 });
        }
      }
    }

    const summaries = await fetchPageSummaries(slugCandidates.map((c) => c.url), 10);

    const enriched = slugCandidates.map((c) => {
      const page = summaries.get(c.url) ?? null;
      const rel = page ? scorePageRelevance(page, content, primaryKeyword) : null;
      // Self-link = this same article (title ≈ primary keyword, OR the page body
      // reproduces most of the article). Either way we must never link to it.
      const isSelf = page
        ? isLikelySelfLink(page.title, primaryKeyword) || isSameArticlePage(content, page)
        : false;
      return {
        ...c,
        pageTitle: page?.title || '',
        pageDescription: page?.description || '',
        pageScore: rel?.score ?? 0,
        strongMatches: rel?.strongMatches ?? 0,
        pkInPage: rel?.pkInPage ?? false,
        wasRead: page !== null,
        isSelf,
      };
    });

    // Confirmed relevant = we READ the page and its real content matches:
    // either the primary keyword appears in its title/description, or at
    // least 2 of the article's topics appear in title/description/headings
    // AND the overall overlap score clears the bar.
    const confirmed = enriched
      .filter((e) => e.wasRead && (e.pkInPage || e.strongMatches >= 2) && e.pageScore >= 12)
      // Never link the article to its OWN page (self-reference).
      .filter((e) => !e.isSelf)
      .sort((a, b) => b.pageScore - a.pageScore);

    // Links are ONLY ever drawn from pages we actually READ and confirmed are
    // about this topic. We never fall back to slug-keyword matches: a shared
    // word like "ideas" / "start" / "features" in a URL is not relevance, and
    // padding to a target count with such matches is precisely the failure we
    // must avoid. Returning 2 genuinely relevant links (or 0) is correct —
    // padding to 7 with irrelevant pages is not.
    const readCount = enriched.filter((e) => e.wasRead).length;
    const topCandidates = confirmed.slice(0, 25);
    const liveUrlCount = topCandidates.length;

    // Replace the slug-derived suggested anchor with a PAGE-AWARE one: the best
    // verbatim article phrase that names each page's real fetched title/
    // description, held to the same quality bar as the validators below — so
    // the anchor the AI is steered towards never bounces off validation.
    for (const c of topCandidates) {
      c.anchorText = findAnchorForPage(content, c, primaryKeyword);
    }

    // Surfaced in Render logs so we can tell *why* a run produced few links:
    // a fetch/network problem (low readCount) vs. a sheet that simply lacks
    // pages on this topic (high readCount, low confirmed).
    console.log(
      `[optimize] internal-links: ${slugCandidates.length} slug candidates → ` +
      `${readCount} pages read → ${confirmed.length} confirmed relevant`
    );

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

    // Placement must point at a findable, sensible spot — validate the AI's
    // quoted paragraph opening against the article, else use the fallback.
    const placementRecommendation = ensureSensiblePlacement(
      parsed.placementRecommendation,
      content
    );

    // Meta fields are finalised deterministically: brand suffixes stripped,
    // word-boundary length trimming (never a mid-word chop), and the meta
    // description MUST contain the exact primary keyword and describe THIS
    // article — repaired from the keyword + the article's own opening if the
    // AI's version fails either bar.
    const metaTitle = finalizeMetaTitle(parsed.metaTitle);
    const metaDescription = finalizeMetaDescription(
      parsed.metaDescription,
      content,
      primaryKeyword
    );

    // ── 6. Validate + assemble internal links (3–7, all page-verified) ─────
    // The AI chose links using each page's REAL fetched title/description, so
    // its picks lead. Every link must still pass the hard rules:
    //   a) anchor exists verbatim in original article OR generated paragraphs
    //   b) URL is one of the READ-AND-CONFIRMED relevant candidates — being in
    //      the sheet is not enough, the page content must match the article
    //   c) anchor is a sensible 2–4 word phrase
    const searchableContent = [
      content,
      parsed.paragraph1,
      parsed.paragraph2,
    ].join('\n').toLowerCase();

    const confirmedUrlSet = new Set(topCandidates.map((u) => u.url));
    // Real fetched title/description per confirmed URL — used to verify the
    // anchor↔destination pairing against what the page is actually about,
    // not just its slug.
    const destTextByUrl = new Map(
      topCandidates.map((u): [string, string] => [
        u.url,
        `${u.pageTitle} ${u.pageDescription}`.toLowerCase(),
      ])
    );
    const usedUrls = new Set<string>();
    const usedAnchors = new Set<string>();

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

      // Rule (b): URL must be a read-and-confirmed relevant page
      if (!confirmedUrlSet.has(link.url)) return false;

      // Rule (d): anchor must read as a meaningful phrase, not a sentence
      // fragment ("can help you look", "your youthful", "Consider facelift").
      // Rejected here, the URL stays unused and the deterministic top-up
      // re-anchors it with a clean phrase from the same confirmed page.
      if (!isQualityAnchor(cleanAnchor)) return false;

      // Rule (e): the anchor must genuinely NAME what the destination page is
      // about — a substantial anchor word must match the page's REAL fetched
      // title/description as a whole word (or a ≥5-letter containment). Judged
      // by the page's own content, never the URL slug, and a shared short word
      // is not enough. This is the "1000% relevant" rule: the AI sometimes pins
      // a verbatim phrase to the wrong confirmed page, and this stops it.
      // Rejected here, the URL returns to the pool for the deterministic top-up.
      if (!anchorMatchesPageText(cleanAnchor, destTextByUrl.get(link.url) || '')) {
        return false;
      }

      // Dedupe — each URL and each anchor used at most once
      if (usedUrls.has(link.url) || usedAnchors.has(cleanAnchor.toLowerCase())) return false;
      usedUrls.add(link.url);
      usedAnchors.add(cleanAnchor.toLowerCase());

      return true;
    });

    // Deterministic top-up — drawn ONLY from the confirmed-relevant pool,
    // ranked by how relevant each FETCHED page actually is (pageScore), with
    // anchors sliced verbatim from the article and chosen to NAME the page's
    // real title/description (findAnchorForPage applies the full quality bar
    // internally). We aim for up to 7 links, but if fewer confirmed pages have
    // a genuine naming phrase in the article we return fewer — never pad.
    let finalLinks = [...validatedAILinks];
    const targetCount = 7;
    if (finalLinks.length < targetCount) {
      const remaining = topCandidates.filter((u) => !usedUrls.has(u.url));
      const need = targetCount - finalLinks.length;
      const extras = buildInternalLinksFromPages(content, remaining, primaryKeyword, need, usedAnchors);
      finalLinks = [...finalLinks, ...extras];
    }

    const validatedLinks = finalLinks.slice(0, 7);

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
        metaTitle,
        metaDescription,
        internalLinks:           validatedLinks,
        placementRecommendation,
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
        metaTitle,
        metaDescription,
        internalLinks:           validatedLinks,
        placementRecommendation,
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
