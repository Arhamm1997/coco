import { MatchedURL } from '@/types';

// Common stop-words to ignore when extracting slug keywords
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was',
  'has', 'have', 'its', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'get', 'how', 'new', 'now',
  'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'she', 'too', 'use',
]);

// Extract meaningful keywords from a URL path/slug
function extractSlugKeywords(url: string): string[] {
  try {
    const { pathname } = new URL(url);
    // Strip leading/trailing slashes, split by hyphens and slashes
    const parts = pathname
      .replace(/^\/|\/$/g, '')
      .split(/[-\/]/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && /^[a-z]+$/.test(w));
    return [...new Set(parts)]; // deduplicate
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

  // Extra boost if primary keyword terms overlap with URL slug terms
  const pkWords = pkeyLower.split(/\s+/);
  const matchedPKWords = pkWords.filter((w) => urlKeywords.includes(w));
  score += matchedPKWords.length * 2;

  return score;
}

// Find an anchor text phrase that ACTUALLY EXISTS word-for-word in the content
// and semantically relates to the URL's topic.
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

  // Strategy 1: Try 4-word, 3-word, 2-word consecutive slug phrases
  for (let len = Math.min(4, slugWords.length); len >= 2; len--) {
    for (let i = 0; i <= slugWords.length - len; i++) {
      const phrase = slugWords.slice(i, i + len).join(' ');
      const idx = contentLower.indexOf(phrase);
      if (idx !== -1) {
        // Return the exact-case version from the original content
        return content.substring(idx, idx + phrase.length);
      }
    }
  }

  // Strategy 2: Single meaningful keyword — grab a 2-word phrase around it
  for (const keyword of slugWords) {
    if (keyword.length < 4 || STOP_WORDS.has(keyword)) continue;
    const idx = contentLower.indexOf(keyword);
    if (idx === -1) continue;

    // Try to form a 2-word phrase: word before or after
    const beforeSpace = contentLower.lastIndexOf(' ', idx - 1);
    const afterSpace = contentLower.indexOf(' ', idx + keyword.length);

    if (beforeSpace !== -1 && idx - beforeSpace > 1) {
      const twoWord = content.substring(beforeSpace + 1, idx + keyword.length);
      if (twoWord.split(' ').length === 2) return twoWord;
    }

    if (afterSpace !== -1) {
      const twoWord = content.substring(idx, afterSpace);
      const nextSpace = contentLower.indexOf(' ', afterSpace + 1);
      if (nextSpace !== -1) {
        const phrase = content.substring(idx, nextSpace);
        if (phrase.split(' ').length === 2) return phrase;
      }
    }

    // Fallback: single keyword
    return content.substring(idx, idx + keyword.length);
  }

  return null;
}

// Main export: rank all URLs by relevance to content & keyword, return top N
export function findBestMatchingURLs(
  content: string,
  urls: string[],
  primaryKeyword: string,
  topN: number = 30
): MatchedURL[] {
  const scored: MatchedURL[] = urls
    .map((url) => {
      const keywords = extractSlugKeywords(url);
      const relevanceScore = scoreRelevance(keywords, content, primaryKeyword);
      const anchorText = relevanceScore > 0 ? findAnchorText(url, content) : null;

      return {
        url,
        slug: url,
        keywords,
        anchorText,
        relevanceScore,
      };
    })
    // Only keep URLs with some relevance AND a confirmed anchor text in content
    .filter((u) => u.relevanceScore > 0 && u.anchorText !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scored.slice(0, topN);
}
