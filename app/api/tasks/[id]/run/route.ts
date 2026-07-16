import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';
import { runAgentTask } from '@/lib/agent/task';

// Manually triggers task execution ("run now"). The scheduler will call
// runAgentTask the same way for autonomous runs. Synchronous for now — a
// background worker/queue is the scaling step (introduced with the scheduler).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }

  // Impersonation-aware tenant resolution (single choke point in lib/companies).
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) {
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 400 });
  }

  const { id } = await params;
  const result = await runAgentTask(id, companyId);

  if (result.ok) {
    return NextResponse.json({ ok: true, result: result.result, tokensUsed: result.tokensUsed });
  }
  const status =
    result.reason === 'task_not_found'
      ? 404
      : result.reason === 'billing_limit'
        ? 402
        : result.reason === 'provider_error'
          ? 502
          : 400;
  return NextResponse.json(
    { ok: false, reason: result.reason, message: result.message },
    { status }
  );
}
