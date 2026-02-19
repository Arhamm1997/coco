import { NextRequest, NextResponse } from 'next/server';

/**
 * Dynamic CORS middleware — checks the request Origin against ALLOWED_ORIGINS.
 * Falls back to http://localhost:3000 for local development.
 */

function getAllowedOrigins(): string[] {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  }
  return ['http://localhost:3000'];
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = getAllowedOrigins();
  const isAllowed = allowed.includes(origin);

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : '',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // For actual requests, attach CORS headers to the response
  const res = NextResponse.next();
  if (isAllowed) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  return res;
}

export const config = {
  matcher: '/api/:path*',
};
