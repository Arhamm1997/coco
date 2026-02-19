import { NextRequest, NextResponse } from 'next/server';
import { batchCheckURLs } from '@/lib/url-checker';

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();

    if (
      !body ||
      typeof body !== 'object' ||
      !Array.isArray((body as { urls?: unknown }).urls)
    ) {
      return NextResponse.json(
        { success: false, error: 'Request body must contain a "urls" array' },
        { status: 400 }
      );
    }

    const { urls } = body as { urls: unknown[] };

    if (urls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No URLs provided' },
        { status: 400 }
      );
    }

    if (urls.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 URLs allowed per batch request' },
        { status: 400 }
      );
    }

    // Validate all URLs are strings starting with http
    const validUrls = urls.filter(
      (u): u is string => typeof u === 'string' && u.startsWith('http')
    );

    if (validUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid URLs found — must start with http:// or https://' },
        { status: 400 }
      );
    }

    const results = await batchCheckURLs(validUrls, {
      timeout: 5000,
      maxConcurrent: 10,
      retries: 1,
    });

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    console.error('[/api/check-urls] Error:', err);
    const message = err instanceof Error ? err.message : 'URL check failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
