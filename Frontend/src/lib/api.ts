import { AIProvider, SEOResult } from './types';

export interface ModelUsageStat {
  model: string;
  requests: number;
  totalTokens: number;
}

export interface ProviderUsageStat {
  provider: AIProvider;
  requests: number;
  totalTokens: number;
  models: ModelUsageStat[];
}

export interface UsageStats {
  providers: ProviderUsageStat[];
  totalRequests: number;
  totalTokens: number;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export async function callAI(
  provider: AIProvider,
  apiKey: string,
  content: string,
  keyword: string,
  urls: string[],
  model?: string
): Promise<SEOResult> {
  const response = await fetch(`${BACKEND_URL}/api/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      primaryKeyword: keyword,
      urls,
      provider,
      apiKey,
      ...(model && { model }),
    }),
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || `Server error (${response.status})`);
  }

  const d = json.data;
  return {
    h2: d.h2,
    h3: d.h3,
    paragraph1: d.paragraph1,
    paragraph2: d.paragraph2,
    metaTitle: d.metaTitle,
    metaDescription: d.metaDescription,
    internalLinks: d.internalLinks,
    placementRecommendation: d.placementRecommendation,
    tokensUsed: d.tokensUsed,
  };
}

export async function checkUrls(urls: string[]): Promise<Map<string, boolean>> {
  const response = await fetch(`${BACKEND_URL}/api/check-urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'URL check failed');
  }

  const map = new Map<string, boolean>();
  for (const r of json.results as Array<{ url: string; isLive: boolean }>) {
    map.set(r.url, r.isLive);
  }
  return map;
}

export async function fetchUsageStats(): Promise<UsageStats | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/usage`);
    const json = await response.json();
    if (!response.ok || !json.success) return null;
    return json.data as UsageStats;
  } catch {
    return null;
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export function formatResultsAsMarkdown(result: SEOResult): string {
  return `## ${result.h2}

**Heading 2:** ${result.h2}

**Paragraph 1:**
${result.paragraph1}

**Heading 3:** ${result.h3}

**Paragraph 2:**
${result.paragraph2}

**Meta Title:** ${result.metaTitle} (${result.metaTitle.length}/55 chars)

**Meta Description:** ${result.metaDescription} (${result.metaDescription.length}/145 chars)

**Internal Links with Anchor Texts:**

${result.internalLinks
  .map(
    (link, i) =>
      `${i + 1}. **Anchor text:** "${link.anchorText}"\n   **Link to:** ${link.url}`
  )
  .join('\n\n')}

**PLACEMENT RECOMMENDATION:**
${result.placementRecommendation}`;
}
