import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createVertexProvider, isVertexConfigured } from '@/lib/ai/providers/vertex';
import { getEmbedding, isEmbeddingsConfigured, EMBEDDING_DIMS } from '@/lib/ai/embeddings';

// In-container Vertex AI smoke test. The standalone Docker image ships neither
// tsx nor scripts/, so `npm run test:vertex` can't run there — this route does
// the same checks (auth via ADC, chat, embeddings) and is reachable with curl:
//
//   curl -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:3000/api/ai/health
//
// Protected by CRON_SECRET (each call spends a few tokens). force-dynamic so it
// always runs live.

export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, reason: 'set CRON_SECRET to enable' }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const result: Record<string, unknown> = {
    project: process.env.GCP_PROJECT_ID ?? null,
    location: process.env.GCP_LOCATION ?? null,
    configured: isVertexConfigured(),
  };

  if (!isVertexConfigured()) {
    return NextResponse.json({ ok: false, ...result, reason: 'GCP_PROJECT_ID missing' }, { status: 503 });
  }

  // Chat
  try {
    const completion = await createVertexProvider().complete({
      system: 'You are a connectivity test. Reply with exactly: VERTEX_OK',
      messages: [{ role: 'user', content: 'ping' }],
      tier: 'HAIKU',
      maxTokens: 256,
      temperature: 0,
    });
    result.chat = { ok: true, model: completion.model, reply: completion.text.trim().slice(0, 40) };
  } catch (err) {
    result.chat = { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : 'error' };
  }

  // Embeddings
  try {
    const vec = isEmbeddingsConfigured() ? await getEmbedding('health check') : null;
    result.embeddings = { ok: Array.isArray(vec) && vec.length === EMBEDDING_DIMS, dims: vec?.length ?? 0 };
  } catch (err) {
    result.embeddings = { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : 'error' };
  }

  const ok =
    (result.chat as { ok: boolean }).ok && (result.embeddings as { ok: boolean }).ok;
  return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 502 });
}
