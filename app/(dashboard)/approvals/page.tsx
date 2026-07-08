import { redirect } from 'next/navigation';
import { Sprout } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { deptHue } from '@/lib/ui/dept-accent';
import { ApprovalCard, type ApprovalCardData } from '@/components/dashboard/approval-card';

// Approvals inbox (design View 3). The sensitive decisions the agents paused for
// — approving wakes them to continue (the two-layer contract's human-in-the-loop).
export default async function ApprovalsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login');
  const companyId = await getUserCompany(userId);
  if (!companyId) redirect('/onboarding');

  const t = await getTranslations('overview');
  const en = (await getLocale()) === 'en';

  const approvals = await db.approval.findMany({
    where: { companyId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, decision: true, context: true, agentId: true,
      agent: { select: { name: true, department: { select: { id: true, name: true, nameEn: true } } } },
    },
  });

  const cards: ApprovalCardData[] = approvals.map((a) => ({
    id: a.id,
    agentId: a.agentId,
    agentName: a.agent.name,
    deptLabel: en ? a.agent.department.nameEn || a.agent.department.name : a.agent.department.name,
    hue: deptHue(a.agent.department),
    decision: a.decision,
    context: a.context,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{t('approvalsTitle')}</h1>
          {cards.length > 0 && (
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-600 dark:text-amber-400">
              {cards.length}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('approvalsSubtitle')}</p>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-16 text-center text-sm text-muted-foreground">
          <Sprout className="h-10 w-10" />
          {t('nothingNeeds')}
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </div>
      )}
    </div>
  );
}
