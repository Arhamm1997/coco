import { MatchedURL } from '@/types';

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
    .filter((w) => w.length > 3 && !CONTENT_STOP.has(w) && /^[a-z]+$/.test(w));

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

  // Strategy 2: single meaningful slug keyword → build 2–3 word phrase from content
  // Only use keywords that are MEANINGFUL (length ≥ 5, not a stop-word)
  for (const keyword of slugWords) {
    if (keyword.length < 5 || STOP_WORDS.has(keyword) || CONTENT_STOP.has(keyword)) continue;

    // Find whole-word occurrence in content
    let searchFrom = 0;
    let idx = -1;
    while (searchFrom < contentLower.length) {
      const found = contentLower.indexOf(keyword, searchFrom);
      if (found === -1) break;
      if (isWholeWord(contentLower, found, keyword)) { idx = found; break; }
      searchFrom = found + 1;
    }
    if (idx === -1) continue;

    const kwEnd = idx + keyword.length;
    const beforeSpace = contentLower.lastIndexOf(' ', idx - 1);
    const afterSpace  = contentLower.indexOf(' ', kwEnd);
    const afterSpace2 = afterSpace !== -1 ? contentLower.indexOf(' ', afterSpace + 1) : -1;

    // Try 3-word: prev + keyword + next
    if (beforeSpace !== -1 && afterSpace !== -1 && idx - beforeSpace > 1) {
      const three = content.substring(beforeSpace + 1, afterSpace);
      if (three.split(' ').length === 3 && hasMeaningfulWord(three)) return three;
    }

    // Try 2-word: keyword + next word
    if (afterSpace !== -1 && afterSpace2 !== -1) {
      const two = content.substring(idx, afterSpace2);
      if (two.split(' ').length === 2 && hasMeaningfulWord(two)) return two;
    }

    // Try 2-word: prev word + keyword
    if (beforeSpace !== -1 && idx - beforeSpace > 1) {
      const two = content.substring(beforeSpace + 1, kwEnd);
      if (two.split(' ').length === 2 && hasMeaningfulWord(two)) return two;
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
