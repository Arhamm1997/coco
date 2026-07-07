import { URLCheckOptions, URLCheckResult } from '@/types';

async function checkSingleURL(
  url: string,
  timeout: number,
  attempt: number = 1
): Promise<URLCheckResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)',
      },
    });

    clearTimeout(timeoutId);

    // 2xx, 3xx = live; 4xx, 5xx = dead
    const isLive = response.status < 400;

    return { url, isLive, statusCode: response.status };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === 'AbortError') {
      return { url, isLive: false, error: 'Timeout' };
    }

    // Some servers reject HEAD but respond to GET — try GET on first attempt
    if (attempt === 1) {
      return checkSingleURL(url, timeout, 2);
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    return { url, isLive: false, error: message };
  }
}

export async function batchCheckURLs(
  urls: string[],
  options: URLCheckOptions
): Promise<URLCheckResult[]> {
  const { maxConcurrent, timeout, retries } = options;
  const results: URLCheckResult[] = [];

  // Process in chunks to respect maxConcurrent limit
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const chunk = urls.slice(i, i + maxConcurrent);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (url) => {
        let result = await checkSingleURL(url, timeout);

        // Retry once if failed (non-timeout)
        if (!result.isLive && retries > 0 && result.error !== 'Timeout') {
          result = await checkSingleURL(url, timeout);
        }

        return result;
      })
    );

    chunkResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({ url: chunk[idx], isLive: false, error: 'Promise rejected' });
      }
    });
  }

  return results;
}
