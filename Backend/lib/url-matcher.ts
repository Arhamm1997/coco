import { MatchedURL, InternalLink } from '@/types';

// Stop-words for URL slug parsing
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was',
  'has', 'have', 'its', 'but', 'not', 'you', 'all', 'can', 'her',
  'one', 'our', 'out', 'day', 'get', 'how', 'new', 'now',
  'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'she', 'too', 'use',
]);

// Broader stop-words for content keyword extraction
const CONTENT_STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was',
  'has', 'have', 'its', 'but', 'not', 'you', 'all', 'can', 'her',
  'one', 'our', 'out', 'day', 'get', 'how', 'new', 'now', 'old',
  'see', 'two', 'way', 'who', 'did', 'she', 'too', 'use', 'also',
  'more', 'into', 'than', 'then', 'when', 'where', 'which', 'while',
  'been', 'will', 'just', 'like', 'very', 'over', 'such', 'here',
  'they', 'them', 'their', 'what', 'your', 'some', 'each', 'there',
]);

// Generic SEO / filler words that show up across EVERY topic and so prove
// nothing about what a page is actually about. Excluded from topic-keyword
// extraction so a shared "best" / "ultimate guide" / "ideas" can never confirm
// an off-topic page: a pets article must match on pet words (dog, puppy, breed),
// not on filler. NOT added to the anchor stop sets — "best pet food" is still a
// fine anchor; this only governs topic relevance.
const GENERIC_TOPIC_WORDS = new Set([
  'best', 'guide', 'guides', 'tips', 'idea', 'ideas', 'ultimate', 'thing',
  'things', 'ways', 'great', 'good', 'made', 'today', 'perfect', 'amazing',
  'essential', 'favourite', 'favorite', 'must', 'help', 'helps', 'look',
  'looks', 'really', 'around', 'everyday', 'simple', 'easy', 'complete',
  'review', 'reviews', 'expect',
]);

// Words too weak to START or END an anchor. An anchor bounded by these reads as
// a sentence fragment ("can help you look", "your youthful", "more advanced",
// "Consider facelift") instead of a meaningful noun phrase. Built on the stop
// sets plus modals, auxiliaries, light/imperative verbs, and loose pronouns —
// kept deliberately conservative so real phrases ("look younger", "spa day")
// still pass.
const WEAK_EDGE_WORDS = new Set<string>([
  ...STOP_WORDS,
  ...CONTENT_STOP,
  // modals / auxiliaries
  'could', 'would', 'should', 'shall', 'may', 'might', 'must',
  'do', 'does', 'is', 'am', 'be', 'being', 'were',
  // light / imperative verbs that make awkward anchor edges
  'consider', 'considers', 'make', 'makes', 'need', 'needs', 'want', 'wants',
  'keep', 'keeps', 'take', 'takes', 'give', 'gives', 'using', 'add', 'adds',
  // loose pronouns / particles
  'his', 'him', 'my', 'me', 'we', 'it', 'as', 'so', 'if', 'an',
  'to', 'at', 'by', 'up', 'via', 'off',
  // generic quantifiers / fillers that make vague, non-descriptive anchor edges
  // ("about everything", "around every", "really good") and carry no noun
  'about', 'everything', 'anything', 'something', 'someone', 'everyone',
  'really', 'always', 'never', 'often', 'every', 'around', 'everywhere',
  'anywhere', 'whatever', 'whenever', 'wherever', 'whoever',
]);

// Tail words of very common multi-word proper nouns. They essentially never
// stand alone, so an anchor that STARTS with one is a broken slice that dropped
// its leading word ("New York City" → "York City", "Los Angeles" → "Angeles").
// Travel-heavy content makes these the common failure, so we reject such starts.
// (A tail is still fine at the END of an anchor: "New York" is correct.)
const PROPER_NOUN_TAILS = new Set([
  'york', 'angeles', 'vegas', 'francisco', 'diego', 'zealand', 'kong',
  'rico', 'lanka', 'arabia', 'jersey', 'orleans', 'hampshire', 'mexico',
  'delhi', 'guinea', 'palma', 'gomera',
]);

// Words that must NEVER sit at an anchor edge, even when capitalised at the
// start of a sentence or heading (articles, conjunctions, core prepositions).
const CORE_FUNCTION_EDGE = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'for', 'in', 'on', 'at',
  'with', 'this', 'that', 'these', 'those', 'your', 'our', 'its', 'their',
  'his', 'her', 'my', 'from', 'by', 'as', 'is', 'are', 'was', 'were',
]);

// Decide whether a word is a bad anchor EDGE. A capitalised word is treated as a
// proper noun and allowed, so "New York" / "Los Angeles" keep their leading word
// — UNLESS it is a core function word ("The Best" is still rejected). A lowercase
// word is rejected when it is weak/function ("around every", "the geothermal").
function isBadAnchorEdge(rawWord: string): boolean {
  const lower = rawWord.toLowerCase().replace(/[^a-z'’-]/g, '');
  if (!lower) return true;
  if (CORE_FUNCTION_EDGE.has(lower)) return true;
  if (/^[A-Z]/.test(rawWord)) return false;
  return WEAK_EDGE_WORDS.has(lower);
}

/**
 * True when an anchor reads as a meaningful 2–4 word phrase rather than a
 * sentence fragment. Rejects anchors that begin or end with a weak/function
 * word, or that carry no substantial content word. Exported so both the AI's
 * suggested anchors and the deterministic ones are held to the same bar.
 */
export function isQualityAnchor(anchor: string): boolean {
  // A space-delimited single-letter edge token is almost always a sliced
  // possessive/contraction fragment ("s first" from "Day's first", "t know"
  // from "don't know") rather than a real word — reject the whole anchor.
  // Genuine possessives ("London's best") survive because the apostrophe keeps
  // them as one space-delimited token here.
  const spaceTokens = anchor.trim().split(/\s+/).filter(Boolean);
  if (spaceTokens.length < 2 || spaceTokens.length > 4) return false;
  const letters = (t: string) => t.replace(/[^A-Za-z]/g, '').length;
  if (letters(spaceTokens[0]) < 2 || letters(spaceTokens[spaceTokens.length - 1]) < 2) return false;

  const words = anchor.toLowerCase().split(/[\s'‘’\-]+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  // Case-aware edge check: a capitalised proper noun ("New York") is allowed; a
  // weak/function word at the edge ("around every", "the best") is not.
  if (isBadAnchorEdge(spaceTokens[0]) || isBadAnchorEdge(spaceTokens[spaceTokens.length - 1])) return false;
  // Reject anchors that START with the tail of a multi-word proper noun — a
  // broken slice that dropped its leading word ("New York City" → "York City").
  if (PROPER_NOUN_TAILS.has(words[0])) return false;
  // Needs at least one substantial content word so we never accept an anchor
  // built entirely from short function words.
  return words.some((w) => w.length >= 4 && !WEAK_EDGE_WORDS.has(w));
}

// Extract meaningful keywords from a URL path/slug
function extractSlugKeywords(url: string): string[] {
  try {
    const { pathname } = new URL(url);
    const parts = pathname
      .replace(/^\/|\/$/g, '')
      .split(/[-\/]/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && /^[a-z]+$/.test(w));
    return [...new Set(parts)];
  } catch {
    return [];
  }
}

/**
 * Extract the most meaningful keywords from article content.
 * Returns the top 40 words by frequency, excluding stop-words.
 * Used for bidirectional matching: content → URL slugs.
 */
function extractContentKeywords(content: string): string[] {
  const words = content
    .toLowerCase()
    .split(/\W+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !CONTENT_STOP.has(w) &&
        !GENERIC_TOPIC_WORDS.has(w) &&
        /^[a-z]+$/.test(w)
    );

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([w]) => w);
}

/**
 * Score a URL's relevance to the content and primary keyword.
 * Uses BIDIRECTIONAL matching:
 *   Direction A: URL slug keywords found in content (existing logic)
 *   Direction B: Content keywords found in URL slug (new — catches topic matches
 *                where content uses different phrasing than the URL slug)
 */
function scoreRelevance(
  urlKeywords: string[],
  content: string,
  primaryKeyword: string,
  contentKeywords: string[]
): number {
  const contentLower = content.toLowerCase();
  const pkeyLower = primaryKeyword.toLowerCase();
  let score = 0;

  // Direction A — URL slug keywords present in content
  for (const kw of urlKeywords) {
    if (contentLower.includes(kw)) score += 3;
  }

  // Primary keyword overlap with URL slug
  for (const pkWord of pkeyLower.split(/\s+/)) {
    if (pkWord.length > 2 && urlKeywords.includes(pkWord)) score += 4;
  }

  // Direction B — Content keywords present in URL slug
  for (const ck of contentKeywords) {
    if (urlKeywords.includes(ck)) score += 2;
    // Partial match: content keyword starts with a URL keyword or vice versa
    else if (urlKeywords.some((uk) => uk.length > 4 && ck.startsWith(uk))) score += 1;
    else if (urlKeywords.some((uk) => uk.length > 4 && uk.startsWith(ck))) score += 1;
  }

  return score;
}

// Check that keyword at position idx is a WHOLE WORD (not inside a longer word)
function isWholeWord(text: string, idx: number, kw: string): boolean {
  const before = idx > 0 ? text[idx - 1] : ' ';
  const after = idx + kw.length < text.length ? text[idx + kw.length] : ' ';
  return !/[a-z]/.test(before) && !/[a-z]/.test(after);
}

// A phrase is only useful as anchor text if it contains at least one
// meaningful word (length ≥ 4, not a stop-word)
function hasMeaningfulWord(phrase: string): boolean {
  return phrase.toLowerCase().split(/\s+/).some(
    (w) => w.length >= 4 && !STOP_WORDS.has(w) && !CONTENT_STOP.has(w)
  );
}

// Find an anchor text phrase that BOTH:
//   1. Exists verbatim in the article content (whole-word match)
//   2. Is drawn from URL slug keywords
//   3. Contains at least one meaningful (non-stop) word
function findAnchorText(url: string, content: string): string | null {
  const contentLower = content.toLowerCase();

  let pathname = '';
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }

  const slugWords = pathname
    .replace(/^\/|\/$/g, '')
    .split(/[-\/]/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && /^[a-z]+$/.test(w));

  if (slugWords.length === 0) return null;

  // Strategy 1: 4-word, 3-word, 2-word consecutive slug phrases verbatim in content
  for (let len = Math.min(4, slugWords.length); len >= 2; len--) {
    for (let i = 0; i <= slugWords.length - len; i++) {
      const phrase = slugWords.slice(i, i + len).join(' ');
      const idx = contentLower.indexOf(phrase);
      // Require whole-word boundary at start and end of phrase
      if (idx !== -1 && isWholeWord(contentLower, idx, phrase) && hasMeaningfulWord(phrase)) {
        return content.substring(idx, idx + phrase.length);
      }
    }
  }

  // Strategy 2: token-based — find a 2–4 word phrase in the article that contains
  // a meaningful slug keyword. Uses word-only tokens so punctuation is excluded
  // from the extracted phrase (e.g. "luxury spa, retreat" → "luxury spa").
  const meaningfulSlugs = slugWords.filter(
    (w) => w.length >= 4 && !STOP_WORDS.has(w) && !CONTENT_STOP.has(w)
  );

  // Tokenize content into pure-letter tokens with their positions
  const TOKEN_RX = /[a-zA-Z]+(?:[''][a-zA-Z]+)*/g;
  const allTokens: Array<{ text: string; start: number; end: number }> = [];
  let tok: RegExpExecArray | null;
  while ((tok = TOKEN_RX.exec(content)) !== null) {
    allTokens.push({ text: tok[0], start: tok.index, end: tok.index + tok[0].length });
  }

  for (const slugKw of meaningfulSlugs) {
    for (let ti = 0; ti < allTokens.length; ti++) {
      if (allTokens[ti].text.toLowerCase() !== slugKw) continue;

      // Try window sizes 2, 3, 4 centred around the matching token
      for (let windowSize = 2; windowSize <= 4; windowSize++) {
        for (let start = Math.max(0, ti - windowSize + 1); start <= ti; start++) {
          const end = start + windowSize;
          if (end > allTokens.length) continue;

          const phraseStart = allTokens[start].start;
          const phraseEnd   = allTokens[end - 1].end;
          const phrase      = content.substring(phraseStart, phraseEnd);

          // Reject if the extracted substring contains punctuation (comma, period, etc.)
          if (/[^a-zA-Z '‘’-]/.test(phrase)) continue;
          if (!hasMeaningfulWord(phrase)) continue;

          // Verify it exists verbatim in content with whole-word boundaries
          const phraseLower = phrase.toLowerCase();
          const idx = contentLower.indexOf(phraseLower);
          if (idx !== -1 && isWholeWord(contentLower, idx, phraseLower)) {
            return phrase;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Strict search — requires relevance score > 0 AND a pre-confirmed verbatim
 * anchor text in the content. Searches the COMPLETE urls array.
 */
export function findBestMatchingURLs(
  content: string,
  urls: string[],
  primaryKeyword: string,
  topN = 60
): MatchedURL[] {
  const contentKeywords = extractContentKeywords(content);

  return urls
    .map((url) => {
      const keywords = extractSlugKeywords(url);
      const relevanceScore = scoreRelevance(keywords, content, primaryKeyword, contentKeywords);
      const anchorText = relevanceScore > 0 ? findAnchorText(url, content) : null;
      return { url, slug: url, keywords, anchorText, relevanceScore };
    })
    .filter((u) => u.relevanceScore > 0 && u.anchorText !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topN);
}

/**
 * Relaxed search — requires only relevance score > 0.
 * No anchorText requirement — Claude will find the anchor text itself.
 * Searches the COMPLETE urls array.
 */
export function findBestMatchingURLsRelaxed(
  content: string,
  urls: string[],
  primaryKeyword: string,
  topN = 60
): MatchedURL[] {
  const contentKeywords = extractContentKeywords(content);

  return urls
    .map((url) => {
      const keywords = extractSlugKeywords(url);
      const relevanceScore = scoreRelevance(keywords, content, primaryKeyword, contentKeywords);
      const anchorText = relevanceScore > 0 ? findAnchorText(url, content) : null;
      return { url, slug: url, keywords, anchorText, relevanceScore };
    })
    .filter((u) => u.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topN);
}

/**
 * Find the SINGLE BEST 2–3 word anchor phrase in the content for a given URL.
 *
 * Unlike findAnchorText (which returns the first acceptable phrase), this scans
 * the WHOLE article and returns the phrase most strongly tied to the URL's
 * topic — i.e. the phrase whose words overlap the URL slug the most, with a
 * bonus when it also contains the primary keyword. The phrase is guaranteed to
 * exist verbatim in the content (it is sliced straight out of it), so it always
 * passes the downstream verbatim check.
 *
 * @param relaxed  When true, widens the window to 4 words and counts partial
 *                 (prefix) slug matches — used only as a fallback to reach the
 *                 minimum link count.
 * @returns { anchor, anchorScore } or null when no slug-tied phrase exists.
 */
function findBestAnchor(
  url: string,
  content: string,
  primaryKeyword: string,
  relaxed = false
): { anchor: string; anchorScore: number } | null {
  let pathname = '';
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }

  // Only MEANINGFUL slug words count as topical hits — stop-words in the slug
  // (e.g. "around-the-world" → "the", "around") must not inflate the score or
  // we end up picking anchors like "The geothermal pools" over "geothermal pools".
  const slugWords = pathname
    .replace(/^\/|\/$/g, '')
    .split(/[-\/]/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && /^[a-z]+$/.test(w) && !STOP_WORDS.has(w) && !CONTENT_STOP.has(w));

  const slugSet = new Set(slugWords);
  if (slugSet.size === 0) return null;

  const pkWords = new Set(
    primaryKeyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );

  // Tokenize content into pure-letter tokens with their character positions.
  const TOKEN_RX = /[a-zA-Z]+(?:[''][a-zA-Z]+)*/g;
  const tokens: Array<{ text: string; start: number; end: number }> = [];
  let tok: RegExpExecArray | null;
  while ((tok = TOKEN_RX.exec(content)) !== null) {
    tokens.push({ text: tok[0], start: tok.index, end: tok.index + tok[0].length });
  }

  const maxLen = relaxed ? 4 : 3;
  let best: { anchor: string; anchorScore: number } | null = null;

  for (let i = 0; i < tokens.length; i++) {
    for (let len = 2; len <= maxLen; len++) {
      const end = i + len;
      if (end > tokens.length) break;

      const phrase = content.substring(tokens[i].start, tokens[end - 1].end);

      // Reject phrases that span punctuation (comma, period, etc.) — keep only
      // letters, spaces, apostrophes and hyphens so the anchor reads naturally.
      if (/[^a-zA-Z '‘’\-]/.test(phrase)) continue;
      if (!hasMeaningfulWord(phrase)) continue;

      const words = phrase.toLowerCase().split(/[\s'‘’\-]+/).filter(Boolean);

      // Anchors must not begin or end with a weak/function word — keeps them
      // clean ("geothermal pools", not "the geothermal", "spa in" or
      // "Consider facelift").
      const rawWords = phrase.split(/[\s'‘’\-]+/).filter(Boolean);
      if (isBadAnchorEdge(rawWords[0]) || isBadAnchorEdge(rawWords[rawWords.length - 1])) continue;
      // Never start an anchor on the tail of a multi-word proper noun
      // ("New York City" must not be sliced into "York City").
      if (PROPER_NOUN_TAILS.has(words[0])) continue;

      let slugHits = 0;
      let pkHits = 0;
      for (const w of words) {
        if (slugSet.has(w)) slugHits++;
        else if (relaxed && w.length > 4 && [...slugSet].some((s) => s.length > 4 && (w.startsWith(s) || s.startsWith(w)))) {
          slugHits++;
        }
        if (pkWords.has(w)) pkHits++;
      }

      // The anchor MUST tie back to the URL topic — at least one slug word.
      if (slugHits === 0) continue;

      // Prefer the most slug coverage (topical tie), then primary-keyword
      // presence, then the most CONCISE phrase — so we get "geothermal pools",
      // not "geothermal pools steam" padded with an unrelated word.
      const score = slugHits * 100 + pkHits * 10 - len * 3;
      if (!best || score > best.anchorScore) {
        best = { anchor: phrase.trim(), anchorScore: score };
      }
    }
  }

  return best;
}

/**
 * Deterministically build internal links from the article content and the
 * uploaded URL sheet — NO AI involved, so the result is always valid:
 *   • every anchor exists verbatim in the content (sliced out of it)
 *   • every URL is an exact string from the sheet
 *   • anchors and URLs are distinct across the link set
 *
 * For each URL we score topical relevance (slug ↔ content overlap + primary
 * keyword signal) and find the best content phrase tied to that URL, then
 * greedily pick the strongest matches. A relaxed second pass runs only if the
 * strict pass cannot reach `minLinks`, so we honour "at least 3 links" while
 * still leading with the most relevant matches.
 */
export function buildInternalLinks(
  content: string,
  urls: string[],
  primaryKeyword: string,
  minLinks = 3,
  maxLinks = 3
): InternalLink[] {
  const contentKeywords = extractContentKeywords(content);

  const collect = (relaxed: boolean, excludeUrls: Set<string>, excludeAnchors: Set<string>) => {
    const seenUrls = new Set<string>();
    const out: Array<{ url: string; anchorText: string; relevanceScore: number; anchorScore: number }> = [];

    for (const url of urls) {
      if (seenUrls.has(url) || excludeUrls.has(url)) continue;
      seenUrls.add(url);

      const slugKeywords = extractSlugKeywords(url);
      if (slugKeywords.length === 0) continue;

      const relevanceScore = scoreRelevance(slugKeywords, content, primaryKeyword, contentKeywords);
      if (relevanceScore <= 0) continue;

      const best = findBestAnchor(url, content, primaryKeyword, relaxed);
      if (!best) continue;
      if (excludeAnchors.has(best.anchor.toLowerCase())) continue;

      out.push({ url, anchorText: best.anchor, relevanceScore, anchorScore: best.anchorScore });
    }

    // Strongest topical relevance first, then anchor quality.
    out.sort(
      (a, b) => b.relevanceScore - a.relevanceScore || b.anchorScore - a.anchorScore
    );
    return out;
  };

  const links: InternalLink[] = [];
  const usedUrls = new Set<string>();
  const usedAnchors = new Set<string>();

  const take = (candidates: Array<{ url: string; anchorText: string }>) => {
    for (const c of candidates) {
      if (links.length >= maxLinks) break;
      const anchorKey = c.anchorText.toLowerCase();
      if (usedUrls.has(c.url) || usedAnchors.has(anchorKey)) continue;
      usedUrls.add(c.url);
      usedAnchors.add(anchorKey);
      links.push({ anchorText: c.anchorText, url: c.url, isLive: true });
    }
  };

  // Pass 1 — strict, slug-tied 2–3 word anchors.
  take(collect(false, usedUrls, usedAnchors));

  // Pass 2 — relaxed (4-word window + partial slug matches) only if still short.
  if (links.length < minLinks) {
    take(collect(true, usedUrls, usedAnchors));
  }

  return links;
}

export interface PageRelevance {
  score: number;          // overall topical-overlap score
  strongMatches: number;  // article topics found in the page's title/description/headings
  pkInPage: boolean;      // full primary keyword appears in the page's title/description
}

/**
 * Score how relevant a FETCHED page actually is to the article — based on the
 * page's real title, meta description, headings and body text, not its URL.
 * A slug keyword proves nothing; this reads what the page is genuinely about.
 *
 * Signals (strong → weak):
 *   • article topic word in page TITLE        +5
 *   • article topic word in page DESCRIPTION  +3
 *   • article topic word in page HEADINGS     +2
 *   • article topic word only in body text    +1 (capped at 6 — body text on a
 *     magazine page includes related-article widgets, so it's a weak signal)
 *   • full primary keyword in title/desc     +12
 */
export function scorePageRelevance(
  page: { title: string; description: string; headings: string[]; bodyText: string },
  content: string,
  primaryKeyword: string
): PageRelevance {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3 && !CONTENT_STOP.has(w) && /^[a-z]+$/.test(w))
    );

  const contentKw = new Set(extractContentKeywords(content));
  const titleSet = tokenize(page.title);
  const descSet = tokenize(page.description);
  const headSet = tokenize(page.headings.join(' '));
  const bodySet = tokenize(page.bodyText);

  let score = 0;
  let strongMatches = 0;
  let bodyOnly = 0;

  for (const w of contentKw) {
    if (titleSet.has(w)) {
      score += 5;
      strongMatches++;
    } else if (descSet.has(w)) {
      score += 3;
      strongMatches++;
    } else if (headSet.has(w)) {
      score += 2;
      strongMatches++;
    } else if (bodySet.has(w)) {
      bodyOnly++;
    }
  }
  score += Math.min(bodyOnly, 6);

  const pageHeadText = `${page.title} ${page.description}`.toLowerCase();
  const pkLower = primaryKeyword.toLowerCase().trim();
  const pkInPage = pkLower.length > 0 && pageHeadText.includes(pkLower);
  if (pkInPage) {
    score += 12;
  } else {
    for (const w of pkLower.split(/\s+/)) {
      if (w.length > 3 && pageHeadText.includes(w)) score += 3;
    }
  }

  return { score, strongMatches, pkInPage };
}

/**
 * Exported for use in validation layers.
 * Checks whether at least one meaningful word from the anchor text
 * appears in the URL slug.
 */
export function anchorIsRelevantToURL(anchor: string, url: string): boolean {
  let urlPath = '';
  try {
    urlPath = new URL(url).pathname.toLowerCase();
  } catch {
    urlPath = url.toLowerCase();
  }
  const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'of', 'is', 'it', 'with', 'that', 'this']);
  const words = anchor.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (words.length === 0) return false;
  return words.some((word) => urlPath.includes(word));
}

/**
 * STRONG anchor↔destination check for SEO internal links. True only when the
 * anchor genuinely NAMES what the destination page is about: at least one
 * substantial anchor word (≥4 letters, not a stop-word) matches the page's REAL
 * fetched title + meta description as a whole word — or is contained in one of
 * those words when the shared part is ≥5 letters (so "Yellow" matches a page
 * titled "Yellowdays", "hotel" matches "hotels", but "days" never matches
 * "Yellowdays" and short/function words never qualify).
 *
 * This is what makes a link "1000% relevant": relevance is judged by the page's
 * own content, never the URL slug, and a mere shared short word is not enough.
 */
export function anchorMatchesPageText(anchor: string, pageText: string): boolean {
  const pageWords = [
    ...new Set(
      pageText
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3 && !CONTENT_STOP.has(w))
    ),
  ];
  if (pageWords.length === 0) return false;

  const anchorWords = anchor
    .toLowerCase()
    .split(/[\s'‘’\-]+/)
    .filter((w) => w.length > 3 && !CONTENT_STOP.has(w));
  if (anchorWords.length === 0) return false;

  return anchorWords.some((a) =>
    pageWords.some(
      (p) =>
        a === p ||
        (a.length >= 5 && p.includes(a)) ||
        (p.length >= 5 && a.includes(p))
    )
  );
}

/**
 * True when a candidate page looks like the ARTICLE ITSELF rather than a related
 * page — its title's content words are essentially the primary keyword (the
 * article's own subject), so linking to it would be a self-reference (e.g. a
 * "Best Souvenirs from New Zealand" article linking the words "Best Souvenirs"
 * back to its own page). Conservative: only fires when the primary keyword has
 * ≥3 content words and the title's content-word set differs from it by at most
 * one word, so a genuinely different page that merely shares the keyword (a
 * richer listicle, a sub-topic) is never dropped.
 */
export function isLikelySelfLink(pageTitle: string, primaryKeyword: string): boolean {
  const toSet = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/\W+/)
        .filter(
          (w) => w.length > 3 && !CONTENT_STOP.has(w) && !GENERIC_TOPIC_WORDS.has(w)
        )
    );
  const pk = toSet(primaryKeyword);
  const title = toSet(pageTitle);
  if (pk.size < 3 || title.size === 0) return false;

  let diff = 0;
  for (const w of pk) if (!title.has(w)) diff++;
  for (const w of title) if (!pk.has(w)) diff++;
  return diff <= 1;
}

/**
 * Robust self-link detection that does NOT depend on the primary keyword's
 * length: a candidate page IS this article when its real fetched body text
 * reproduces most of the article's own subject words. Catches the case the
 * title check misses — e.g. an "NYC Nightlife" article whose primary keyword is
 * too short for isLikelySelfLink, but whose own published page is in the sheet.
 *
 * Compares the article's top subject keywords against the page body; ≥60 %
 * coverage means it is the same article. A genuinely different page on the same
 * topic shares far fewer of THIS article's specific words, so it is never
 * dropped.
 */
export function isSameArticlePage(
  content: string,
  page: { bodyText: string }
): boolean {
  const articleKw = extractContentKeywords(content);
  if (articleKw.length < 8) return false;
  const bodyWords = new Set(
    page.bodyText.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  );
  let hit = 0;
  for (const w of articleKw) if (bodyWords.has(w)) hit++;
  return hit / articleKw.length >= 0.6;
}
