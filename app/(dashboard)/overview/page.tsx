import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserPlus, Sprout, Activity } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ClaudeModel } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { deptHue } from '@/lib/ui/dept-accent';
import { AgentCard, type AgentCardData } from '@/components/dashboard/agent-card';
import { ApprovalCard, type ApprovalCardData } from '@/components/dashboard/approval-card';

const TIER: Record<ClaudeModel, string> = { HAIKU: 'Fast', SONNET: 'Balanced', OPUS: 'Advanced' };

// The Command Center — the owner supervises an automated company: the AI
// workforce grouped by department, the decisions awaiting them (the two-layer
// contract's human-in-the-loop), and a live activity feed.
export default async function OverviewPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login');
  const companyId = await getUserCompany(userId);
  if (!companyId) redirect('/onboarding');

  const t = await getTranslations('overview');
  const locale = await getLocale();
  const en = locale === 'en';

  const [departments, approvals, timeline] = await Promise.all([
    db.department.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, nameEn: true,
        agents: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, name: true, role: true, roleEn: true, status: true, model: true,
            tasks: {
              where: { status: { in: ['WORKING', 'PENDING'] } },
              orderBy: { createdAt: 'desc' }, take: 1, select: { title: true },
            },
            approvals: {
              where: { status: 'PENDING' },
              orderBy: { createdAt: 'desc' }, take: 1, select: { id: true },
            },
          },
        },
      },
    }),
    db.approval.findMany({
      where: { companyId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true, decision: true, context: true, agentId: true,
        agent: { select: { name: true, department: { select: { id: true, name: true, nameEn: true } } } },
      },
    }),
    db.timelineEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, title: true, createdAt: true, agent: { select: { name: true } } },
    }),
  ]);

  const totalAgents = departments.reduce((n, d) => n + d.agents.length, 0);

  const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const ago = (d: Date) => {
    const s = Math.round((d.getTime() - Date.now()) / 1000);
    const m = Math.round(s / 60);
    const h = Math.round(m / 60);
    if (Math.abs(s) < 60) return rel.format(s, 'second');
    if (Math.abs(m) < 60) return rel.format(m, 'minute');
    if (Math.abs(h) < 24) return rel.format(h, 'hour');
    return rel.format(Math.round(h / 24), 'day');
  };

  const approvalCards: ApprovalCardData[] = approvals.map((a) => ({
    id: a.id,
    agentId: a.agentId,
    agentName: a.agent.name,
    deptLabel: en ? a.agent.department.nameEn || a.agent.department.name : a.agent.department.name,
    hue: deptHue(a.agent.department),
    decision: a.decision,
    context: a.context,
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      {/* Roster */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t('workforce')}</h1>
            <p className="text-sm text-muted-foreground">{t('live')}</p>
          </div>
          <Link
            href="/agents/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" />
            {t('hireEmployee')}
          </Link>
        </div>

        {totalAgents === 0 ? (
          <Link
            href="/agents/new"
            className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-14 text-center text-sm text-muted-foreground transition hover:bg-accent/40"
          >
            <Sprout className="h-9 w-9" />
            {t('hireFirst')}
          </Link>
        ) : (
          departments
            .filter((d) => d.agents.length > 0)
            .map((d) => {
              const hue = deptHue(d);
              return (
                <section key={d.id}>
                  <div className="mb-2.5 flex items-center gap-2" style={{ ['--dept-h' as string]: String(hue) }}>
                    <span className="h-2.5 w-2.5 rounded-full dept-dot" />
                    <h2 className="text-sm font-semibold">{en ? d.nameEn || d.name : d.name}</h2>
                    <span className="text-xs text-muted-foreground">· {d.agents.length}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {d.agents.map((a) => {
                      const data: AgentCardData = {
                        id: a.id,
                        name: a.name,
                        role: en ? a.roleEn || a.role : a.role,
                        status: a.status,
                        currentTask: a.tasks[0]?.title ?? null,
                        approvalId: a.approvals[0]?.id ?? null,
                        trigger: null,
                        modelTier: TIER[a.model],
                      };
                      return <AgentCard key={a.id} agent={data} hue={hue} />;
                    })}
                  </div>
                </section>
              );
            })
        )}
      </div>

      {/* Right rail */}
      <aside className="space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-base font-semibold">{t('needsAttention')}</h2>
            {approvalCards.length > 0 && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                {approvalCards.length}
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{t('routeNote')}</p>
          {approvalCards.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Sprout className="h-4 w-4" />
              {t('allCaught')}
            </p>
          ) : (
            <div className="space-y-2.5">
              {approvalCards.map((a) => (
                <ApprovalCard key={a.id} approval={a} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-muted-foreground" />
            {t('liveActivity')}
          </h2>
          {timeline.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">{t('noActivity')}</p>
          ) : (
            <ul className="space-y-2.5">
              {timeline.map((e) => (
                <li key={e.id} className="flex gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                  <div className="min-w-0">
                    <p className="text-foreground/80">
                      {e.agent?.name ? `${e.agent.name} · ` : ''}
                      {e.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{ago(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
