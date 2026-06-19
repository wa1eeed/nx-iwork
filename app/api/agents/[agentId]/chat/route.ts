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

  const result = await runAgentChat({
    agentId,
    companyId: user.companyId,
    userMessage: message.trim(),
    userId: session.user.id,
  });

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      reply: result.reply,
      tokensUsed: result.tokensUsed,
    });
  }

  // Map the loop's failure reasons to status codes. A missing/bad key is a
  // setup problem the owner can fix, so surface it as 400 with a clear reason.
  const status =
    result.reason === 'agent_not_found'
      ? 404
      : result.reason === 'provider_error'
        ? 502
        : 400;
  return NextResponse.json(
    { ok: false, reason: result.reason, message: result.message },
    { status }
  );
}
