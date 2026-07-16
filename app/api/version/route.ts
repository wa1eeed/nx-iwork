import { NextResponse } from 'next/server';

// Tiny build marker so we can tell WHICH build is actually serving (Coolify
// queues sequential deploys, so "pushed" ≠ "live"). `marker` is bumped by hand
// on deploys we need to verify; SOURCE_COMMIT is injected by Coolify when
// available. No secrets — a short marker + commit sha only.
export const dynamic = 'force-dynamic';

const MARKER = 'skills-v4-clarity';

export function GET() {
  return NextResponse.json({
    marker: MARKER,
    commit: (process.env.SOURCE_COMMIT ?? process.env.COOLIFY_COMMIT ?? 'unknown').slice(0, 12),
  });
}
