/**
 * Fetches candidate pages and extracts the parts needed to judge topical
 * relevance: real title, meta description, headings, and the first chunk of
 * visible body text. A keyword in the URL slug is NOT evidence the page is
 * about that topic — reading the page is.
 *
 * Results are cached in-memory (30 min TTL) so repeated runs with the same
 * sheet skip the network.
 */

export interface PageSummary {
  url: string;
  title: string;
  description: string;
  headings: string[];
  bodyText: string;
}

const cache = new Map<string, { summary: PageSummary | null; at: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#822[01];|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/g, '-')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function firstMatch(html: string, rx: RegExp): string {
  const m = html.match(rx);
  return m ? decodeEntities(m[1].trim()) : '';
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchPageSummary(url: string, timeoutMs = 6000): Promise<PageSummary | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.summary;

  let summary: PageSummary | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        // Honest, simple UA — houseofcoco.net's WAF returns 403 for spoofed
        // browser UAs (TLS fingerprint mismatch) but allows plain clients.
        'user-agent': 'HoC-SEO-Optimizer/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = (await res.text()).slice(0, 400_000);

      const title =
        firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);

      const description =
        firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

      const headings: string[] = [];
      const hRx = /<h([123])[^>]*>([\s\S]*?)<\/h\1>/gi;
      let hm: RegExpExecArray | null;
      while ((hm = hRx.exec(html)) !== null && headings.length < 8) {
        const text = stripTags(hm[2]);
        if (text) headings.push(text);
      }

      // Visible article text — drop site chrome first so nav/footer link
      // labels don't masquerade as page content.
      const bodyHtml = html
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<aside[\s\S]*?<\/aside>/gi, ' ');
      const bodyText = stripTags(bodyHtml).slice(0, 2500);

      summary = { url, title, description, headings, bodyText };
    }
  } catch {
    summary = null;
  }

  cache.set(url, { summary, at: Date.now() });
  return summary;
}

export async function fetchPageSummaries(
  urls: string[],
  concurrency = 10
): Promise<Map<string, PageSummary | null>> {
  const out = new Map<string, PageSummary | null>();
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      out.set(urls[i], await fetchPageSummary(urls[i]));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) || 1 }, worker));
  return out;
}
