'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

type Result = { ok: true } | { ok: false; error: string };

// The human-in-the-loop half of the two-layer contract: the owner resolves an
// agent's paused sensitive decision. We RECORD the decision (system), then WAKE
// the agent with a follow-up task so it continues (approve) or revises (send
// back) — the scheduler runs AGENT_TOOL tasks. Tenant-scoped.
export async function resolveApproval(id: string, decision: 'approve' | 'reject'): Promise<Result> {
  const session = await auth();
  const userId = session?.user?.id;
  const companyId = userId ? await getUserCompany(userId) : null;
  if (!companyId || !userId) return { ok: false, error: 'unauthenticated' };

  const approval = await db.approval.findFirst({
    where: { id, companyId, status: 'PENDING' },
    select: { id: true, agentId: true, decision: true },
  });
  if (!approval) return { ok: false, error: 'not_found' };

  const approved = decision === 'approve';
  await db.$transaction([
    db.approval.update({
      where: { id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        resolvedById: userId,
        resolvedAt: new Date(),
        resolution: approved ? 'approved' : 'sent_back',
      },
    }),
    // Wake the agent to continue/revise (scheduler picks up PENDING AGENT_TOOL tasks).
    db.task.create({
      data: {
        companyId,
        agentId: approval.agentId,
        kind: 'AGENT_TASK',
        triggerType: 'AGENT_TOOL',
        title: approved ? 'تمت الموافقة — أكمل' : 'أُعيد إليك — راجع',
        description: approved
          ? `وافق صاحب العمل على: ${approval.decision}. أكمل التنفيذ.`
          : `أعاد صاحب العمل القرار: ${approval.decision}. راجعه وقدّم بديلاً مناسباً.`,
      },
    }),
    db.timelineEvent.create({
      data: {
        companyId,
        agentId: approval.agentId,
        type: 'APPROVAL_RESOLVED',
        title: approved ? 'وافقتَ على قرار' : 'أعدتَ قراراً للمراجعة',
        description: approval.decision,
      },
    }),
  ]);

  revalidatePath('/overview');
  revalidatePath('/approvals');
  return { ok: true };
}
