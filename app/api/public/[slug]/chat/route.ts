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

  // Use the designated agent ONLY if it's still an active customer-facing agent;
  // otherwise fall back to the first that is. This mirrors the landing-page widget
  // resolution exactly — otherwise a widget configured with an internal/archived
  // agent renders fine but silently fails to reply (runPublicAgentChat rejects a
  // non-customer-facing agent), which reads to the owner as "the widget is broken".
  let agentId: string | null = null;
  if (company.websiteConfig.chatAgentId) {
    const designated = await db.agent.findFirst({
      where: {
        id: company.websiteConfig.chatAgentId,
        companyId: company.id,
        status: { not: 'ARCHIVED' },
        surface: 'CUSTOMER_FACING',
      },
      select: { id: true },
    });
    agentId = designated?.id ?? null;
  }
  if (!agentId) {
    const fallback = await db.agent.findFirst({
      where: { companyId: company.id, status: { not: 'ARCHIVED' }, surface: 'CUSTOMER_FACING' },
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
      // Prime the stream (2KB comment) so a buffering proxy flushes immediately +
      // keepalive comments hold the connection open. Ignored by the SSE client.
      controller.enqueue(encoder.encode(`:${' '.repeat(2048)}\n\n`));
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ka\n\n'));
        } catch {
          /* stream already closed */
        }
      }, 15_000);
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
