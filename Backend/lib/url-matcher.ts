import { MatchedURL } from '@/types';

// Common stop-words to ignore when extracting slug keywords
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was',
  'has', 'have', 'its', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'get', 'how', 'new', 'now',
  'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'she', 'too', 'use',
]);

// Stop-words for anchor relevance checks (broader set)
const ANCHOR_STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'of',
  'is', 'it', 'with', 'that', 'this', 'are', 'was', 'has', 'its',
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

// Score how relevant a URL is to the content and primary keyword
function scoreRelevance(
  urlKeywords: string[],
  content: string,
  primaryKeyword: string
): number {
  const contentLower = content.toLowerCase();
  const pkeyLower = primaryKeyword.toLowerCase();
  let score = 0;

  for (const keyword of urlKeywords) {
    if (contentLower.includes(keyword)) score += 3;
    if (pkeyLower.includes(keyword)) score += 2;
  }

  const pkWords = pkeyLower.split(/\s+/);
  const matchedPKWords = pkWords.filter((w) => urlKeywords.includes(w));
  score += matchedPKWords.length * 2;

  return score;
}

// Find an anchor text phrase that:
//   1. Exists verbatim (word-for-word) in the article content
//   2. Is semantically drawn from URL slug keywords
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

  // Strategy 1: Try 4-word, 3-word, 2-word consecutive slug phrases that exist in content
  for (let len = Math.min(4, slugWords.length); len >= 2; len--) {
    for (let i = 0; i <= slugWords.length - len; i++) {
      const phrase = slugWords.slice(i, i + len).join(' ');
      const idx = contentLower.indexOf(phrase);
      if (idx !== -1) {
        return content.substring(idx, idx + phrase.length);
      }
    }
  }

  // Strategy 2: Single meaningful slug keyword → find a 2–3 word phrase around it in content
  for (const keyword of slugWords) {
    if (keyword.length < 4 || STOP_WORDS.has(keyword)) continue;
    const idx = contentLower.indexOf(keyword);
    if (idx === -1) continue;

    // Try 3-word phrase: one word before + keyword + one word after
    const beforeSpace = contentLower.lastIndexOf(' ', idx - 1);
    const afterKwEnd = idx + keyword.length;
    const afterSpace = contentLower.indexOf(' ', afterKwEnd);
    const afterSpace2 = afterSpace !== -1 ? contentLower.indexOf(' ', afterSpace + 1) : -1;

    if (beforeSpace !== -1 && afterSpace !== -1 && idx - beforeSpace > 1) {
      const threeWord = content.substring(beforeSpace + 1, afterSpace);
      if (threeWord.split(' ').length === 3) return threeWord;
    }

    // Try 2-word: keyword + next word
    if (afterSpace !== -1 && afterSpace2 !== -1) {
      const twoWord = content.substring(idx, afterSpace2);
      if (twoWord.split(' ').length === 2) return twoWord;
    }

    // Try 2-word: prev word + keyword
    if (beforeSpace !== -1 && idx - beforeSpace > 1) {
      const twoWord = content.substring(beforeSpace + 1, afterKwEnd);
      if (twoWord.split(' ').length === 2) return twoWord;
    }
  }

  return null;
}

/**
 * Verify that at least one meaningful word from the anchor text
 * also appears in the URL slug. This enforces the HOC rule that
 * anchor text must be topically relevant to the linked URL.
 */
export function anchorIsRelevantToURL(anchor: string, url: string): boolean {
  let urlPath = '';
  try {
    urlPath = new URL(url).pathname.toLowerCase();
  } catch {
    urlPath = url.toLowerCase();
  }

  const words = anchor
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ANCHOR_STOP.has(w));

  if (words.length === 0) return false;
  return words.some((word) => urlPath.includes(word));
}

/**
 * Strict search — returns only URLs that have:
 *   - relevanceScore > 0 (keyword overlap with content/primary keyword)
 *   - a pre-confirmed anchor text verbatim in the content
 * Searches the COMPLETE urls array.
 */
export function findBestMatchingURLs(
  content: string,
  urls: string[],
  primaryKeyword: string,
  topN = 50
): MatchedURL[] {
  return urls
    .map((url) => {
      const keywords = extractSlugKeywords(url);
      const relevanceScore = scoreRelevance(keywords, content, primaryKeyword);
      const anchorText = relevanceScore > 0 ? findAnchorText(url, content) : null;
      return { url, slug: url, keywords, anchorText, relevanceScore };
    })
    .filter((u) => u.relevanceScore > 0 && u.anchorText !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topN);
}

/**
 * Relaxed search — returns URLs with any relevance score > 0,
 * even if no pre-computed anchor text was found (Claude will find it).
 * Searches the COMPLETE urls array.
 */
export function findBestMatchingURLsRelaxed(
  content: string,
  urls: string[],
  primaryKeyword: string,
  topN = 50
): MatchedURL[] {
  return urls
    .map((url) => {
      const keywords = extractSlugKeywords(url);
      const relevanceScore = scoreRelevance(keywords, content, primaryKeyword);
      const anchorText = relevanceScore > 0 ? findAnchorText(url, content) : null;
      return { url, slug: url, keywords, anchorText, relevanceScore };
    })
    .filter((u) => u.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topN);
}
