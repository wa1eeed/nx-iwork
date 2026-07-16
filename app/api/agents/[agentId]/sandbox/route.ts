import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';
import { runAgentSandbox } from '@/lib/agent/sandbox';

// Agent Studio test run: executes one message through the agent without touching
// its chat history, and returns the internals (model, tokens, tool trace).
export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });

  // Impersonation-aware tenant resolution (single choke point in lib/companies).
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 400 });

  const { agentId } = await params;
  const body = (await req.json().catch(() => ({}))) as { message?: unknown };
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });

  const res = await runAgentSandbox(agentId, companyId, message);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
