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

export async function fetchPreconfiguredProviders(): Promise<Record<string, boolean>> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/config`);
    if (!res.ok) return {};
    const json = await res.json();
    return (json.preconfiguredProviders as Record<string, boolean>) ?? {};
  } catch {
    return {};
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
  const linkLines = result.internalLinks
    .map(
      (link, i) =>
        `${i + 1}. **Anchor text:** "${link.anchorText}"\n   **Link to:** ${link.url}`
    )
    .join('\n\n');

  return `## ${result.h2}

${result.paragraph1}

### ${result.h3}

${result.paragraph2}

**Meta Title:** ${result.metaTitle}

**Meta Description:** ${result.metaDescription}

**Internal Links with Anchor Texts:**

${linkLines}

**PLACEMENT RECOMMENDATION:** ${result.placementRecommendation}`;
}

/** Content block only — H2, P1, H3, P2 as rich HTML */
export function formatResultsAsHTML(result: SEOResult): string {
  return [
    `<h2>${result.h2}</h2>`,
    `<p>${result.paragraph1}</p>`,
    `<h3>${result.h3}</h3>`,
    `<p>${result.paragraph2}</p>`,
  ].join('\n\n');
}

/** Full output as rich HTML — headings bold, labels bold, links clickable */
export function formatResultsAsFullHTML(result: SEOResult): string {
  const linkItems = result.internalLinks
    .map(
      (link, i) =>
        `<p>${i + 1}. <strong>Anchor text:</strong> &ldquo;${link.anchorText}&rdquo;<br>` +
        `<strong>Link to:</strong> <a href="${link.url}">${link.url}</a></p>`
    )
    .join('\n');

  return [
    `<h2>${result.h2}</h2>`,
    `<p>${result.paragraph1}</p>`,
    `<h3>${result.h3}</h3>`,
    `<p>${result.paragraph2}</p>`,
    `<p><strong>Meta Title:</strong> ${result.metaTitle}</p>`,
    `<p><strong>Meta Description:</strong> ${result.metaDescription}</p>`,
    `<p><strong>Internal Links with Anchor Texts:</strong></p>`,
    linkItems,
    `<p><strong>PLACEMENT RECOMMENDATION:</strong> ${result.placementRecommendation}</p>`,
  ].join('\n\n');
}

/**
 * Write both HTML and plain-text to the clipboard simultaneously.
 * Apps that support rich paste (Google Docs, Word, Notion) will use the HTML.
 * Plain-text editors fall back to the markdown string.
 */
export async function copyRichText(html: string, plain: string): Promise<void> {
  if (typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([html],  { type: 'text/html'  }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ]);
  } else {
    // Safari / older browsers — plain text only
    await navigator.clipboard.writeText(plain);
  }
}
