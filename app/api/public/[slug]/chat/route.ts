import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runPublicAgentChat } from '@/lib/agent/public-chat';
import { detectComplaint } from '@/lib/agent/sentiment';
import { dispatchEvent } from '@/lib/agent/events';
import { sendTelegram } from '@/lib/notify/telegram';

export const dynamic = 'force-dynamic';

// Very small in-memory rate limiter (per visitor). Not multi-replica safe — a
// shared store (Redis) is the scaling upgrade — but it stops obvious abuse on a
// single instance.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > MAX_PER_WINDOW;
}

// Public visitor → company's widget agent. No auth; scoped by the company slug.
// The reply is STREAMED token-by-token over SSE (like the dashboard chat), so the
// visitor sees text appear immediately instead of waiting for the whole reply.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let body: { message?: unknown; visitorId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const visitorId = typeof body.visitorId === 'string' && body.visitorId ? body.visitorId.slice(0, 60) : null;
  if (!message || !visitorId) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ ok: false, reason: 'too_long' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(`${slug}:${visitorId}:${ip}`)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  // Resolve the company + its designated widget agent.
  const company = await db.company.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      websiteConfig: { select: { chatEnabled: true, chatAgentId: true } },
    },
  });
  if (!company || company.status === 'SUSPENDED' || !company.websiteConfig?.chatEnabled) {
    return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 404 });
  }

  // Designated agent, or fall back to the first active agent.
  let agentId = company.websiteConfig.chatAgentId;
  if (!agentId) {
    const fallback = await db.agent.findFirst({
      where: { companyId: company.id, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    agentId = fallback?.id ?? null;
  }
  if (!agentId) {
    return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 404 });
  }

  const companyId = company.id;
  const resolvedAgentId = agentId;
  const meta = {
    pageUrl: req.headers.get('referer') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
    ip,
  };

  // Stream the reply token-by-token over SSE (mirrors the dashboard chat route).
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const result = await runPublicAgentChat(
          { companyId, agentId: resolvedAgentId, visitorId, message, meta },
          { onDelta: (delta) => send({ type: 'delta', text: delta }) }
        );
        if (result.ok) {
          send({ type: 'done', reply: result.reply });
          // Sentiment-based escalation, off the reply path (best-effort).
          void handleComplaint(companyId, message).catch((err) =>
            console.error('complaint escalation failed', err)
          );
        } else {
          send({ type: 'error', reason: result.reason });
        }
      } catch (err) {
        console.error('public chat stream error', err);
        send({ type: 'error', reason: 'provider_error' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function handleComplaint(companyId: string, message: string): Promise<void> {
  const verdict = await detectComplaint(companyId, message);
  if (!verdict.isComplaint) return;

  await dispatchEvent(companyId, 'COMPLAINT_RECEIVED', {
    summary: verdict.summary || message.slice(0, 200),
    metadata: { anger: verdict.anger },
  });

  const pct = Math.round(verdict.anger * 100);
  await sendTelegram(
    companyId,
    `🚨 <b>Customer complaint</b> (anger ${pct}%)\n\n${verdict.summary || message.slice(0, 300)}\n\n<i>Message:</i> ${message.slice(0, 500)}`
  );
}
