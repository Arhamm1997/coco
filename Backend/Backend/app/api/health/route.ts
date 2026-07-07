import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

// Liveness must reflect whether the API process can answer — NOT whether
// MongoDB happens to be connected. The optimizer works without the DB (writes
// are best-effort/non-fatal), so a slow or dropped Mongo connection must never
// make the whole service read as "offline".
//
// Two deliberate choices fix the false "Backend offline" flips:
//   1. Do NOT await connectDB() here. Server selection can block up to
//      serverSelectionTimeoutMS (5s), which exceeds the client's 4s health
//      timeout and would falsely report offline. We only read the current
//      connection state, which is instant.
//   2. Always return 200 when the process responds. DB status is reported in
//      the body as informational only.
const READY_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

export async function GET() {
  const dbStatus = READY_STATES[mongoose.connection.readyState] ?? 'unknown';

  return NextResponse.json({
    status:    'ok',
    service:   'SEO Content Optimizer API',
    version:   '1.0.0',
    // Bumped on every internal-link logic change so a deploy can be verified:
    // hit /api/health and confirm linksEngine matches the latest code. If it
    // still reads an older value, the running backend has NOT picked up the fix.
    linksEngine: 'v2-strict-anchors-2026-06-16',
    commit:    process.env.RENDER_GIT_COMMIT?.slice(0, 7) || 'local',
    timestamp: new Date().toISOString(),
    database:  { status: dbStatus },
  });
}
