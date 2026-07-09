import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Package, Clock, Inbox } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { OutputsHub, type OutputItem } from '@/components/dashboard/outputs-hub';

export const dynamic = 'force-dynamic';

// The unified agent workspace: every deliverable the AI team produced, filterable
// and reviewable in one place. Background archetypes (marketing/finance/ops)
// deliver here via create_output; customer-facing agents can too.
export default async function OutputsPage() {
  const t = await getTranslations('outputs');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [rows, total, thisWeek, pending] = await Promise.all([
    db.agentOutput.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, title: true, body: true, type: true, status: true, createdAt: true,
        agent: { select: { id: true, name: true } },
        customer: { select: { name: true } },
      },
    }),
    db.agentOutput.count({ where: { companyId, status: { not: 'ARCHIVED' } } }),
    db.agentOutput.count({ where: { companyId, createdAt: { gte: weekAgo } } }),
    db.agentOutput.count({ where: { companyId, status: 'READY' } }),
  ]);

  const items: OutputItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    type: r.type,
    status: r.status,
    agentId: r.agent.id,
    agentName: r.agent.name,
    customerName: r.customer?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  // Agents that have produced outputs — the filter's option set.
  const agentMap = new Map<string, string>();
  for (const r of rows) agentMap.set(r.agent.id, r.agent.name);
  const agents = Array.from(agentMap, ([id, name]) => ({ id, name }));

  const stats = [
    { icon: Package, label: t('statTotal'), value: total, tint: 'text-indigo-500' },
    { icon: Clock, label: t('statWeek'), value: thisWeek, tint: 'text-sky-500' },
    { icon: Inbox, label: t('statPending'), value: pending, tint: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <s.icon className={`size-4 ${s.tint}`} />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{s.value.toLocaleString('en')}</p>
          </div>
        ))}
      </div>

      <OutputsHub items={items} agents={agents} />
    </div>
  );
}
