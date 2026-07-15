import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { runAgentChat } from '@/lib/agent/run';

// Owner/member chats with one of their AI employees. Tenant isolation is
// enforced by resolving companyId from the session and passing it into
// runAgentChat (which scopes every query by it).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });
  if (!user?.companyId) {
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 400 });
  }

  const { agentId } = await params;

  let message: unknown;
  try {
    ({ message } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }
  if (typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ ok: false, reason: 'empty_message' }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ ok: false, reason: 'message_too_long' }, { status: 400 });
  }

  // Stream the reply token-by-token over SSE: the agent's text is emitted as it
  // generates (onDelta); a final 'done' (or 'error') event closes the turn.
  const companyId = user.companyId;
  const userId = session.user.id;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      // Prime the stream: a ~2KB SSE comment forces a buffering proxy (Cloudflare,
      // Traefik) to flush immediately, so deltas arrive live instead of in one lump
      // after the whole reply finishes. Keepalive comments hold the connection open
      // through slow tool rounds. Both are ignored by the SSE client.
      controller.enqueue(encoder.encode(`:${' '.repeat(2048)}\n\n`));
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ka\n\n'));
        } catch {
          /* stream already closed */
        }
      }, 15_000);
      try {
        const result = await runAgentChat(
          { agentId, companyId, userMessage: message.trim(), userId },
          { onDelta: (delta) => send({ type: 'delta', text: delta }) }
        );
        if (result.ok) {
          send({ type: 'done', reply: result.reply, tokensUsed: result.tokensUsed, meta: result.meta });
        } else {
          send({ type: 'error', reason: result.reason, message: result.message });
        }
      } catch (err) {
        send({ type: 'error', reason: 'provider_error', message: err instanceof Error ? err.message : 'unknown' });
      } finally {
        clearInterval(keepalive);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering so deltas flush live
    },
  });
}
