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

  const result = await runPublicAgentChat({
    companyId: company.id,
    agentId,
    visitorId,
    message,
    meta: {
      pageUrl: req.headers.get('referer') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      ip,
    },
  });

  if (result.ok) {
    // Sentiment-based escalation: if the customer message is an angry complaint,
    // fire COMPLAINT_RECEIVED (waking any configured agent) and ping the owner's
    // Telegram. Best-effort and non-fatal to the chat response.
    void handleComplaint(company.id, message).catch((err) =>
      console.error('complaint escalation failed', err)
    );
    return NextResponse.json({ ok: true, reply: result.reply });
  }
  const status = result.reason === 'billing_limit' ? 402 : result.reason === 'provider_error' ? 502 : 404;
  return NextResponse.json({ ok: false, reason: result.reason }, { status });
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
