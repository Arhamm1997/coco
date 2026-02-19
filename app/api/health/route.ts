import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import mongoose from 'mongoose';

export async function GET() {
  let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  let dbError: string | undefined;

  try {
    await connectDB();
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch (err: unknown) {
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : 'Unknown DB error';
  }

  const healthy = dbStatus === 'connected';

  return NextResponse.json(
    {
      status:    healthy ? 'ok' : 'degraded',
      service:   'SEO Content Optimizer API',
      version:   '1.0.0',
      timestamp: new Date().toISOString(),
      database:  {
        status: dbStatus,
        ...(dbError ? { error: dbError } : {}),
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
