import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sprout, Activity, CalendarCheck, ShoppingBag, ListChecks, ArrowRight } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { deptHue } from '@/lib/ui/dept-accent';
import { ApprovalCard, type ApprovalCardData } from '@/components/dashboard/approval-card';
import { BusinessCounters } from '@/components/dashboard/business-counters';

// The Overview — a holistic, live snapshot of the *business*: upcoming bookings,
// recent orders, agent tasks in progress, the decisions awaiting the owner, and a
// live activity feed. (The AI workforce roster lives on /agents.)
export default async function OverviewPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login');
  const companyId = await getUserCompany(userId);
  if (!companyId) redirect('/onboarding');

  const t = await getTranslations('overview');
  const tb = await getTranslations('biz.overview');
  const locale = await getLocale();
  const en = locale === 'en';
  const now = new Date();

  const [approvals, timeline, upcomingBookings, recentOrders, openTasks] = await Promise.all([
    db.approval.findMany({
      where: { companyId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 8,
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
    db.booking.findMany({
      where: { companyId, status: 'CONFIRMED', startAt: { gte: now } },
      orderBy: { startAt: 'asc' },
      take: 6,
      select: { id: true, title: true, startAt: true, customer: { select: { name: true } } },
    }),
    db.order.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true },
    }),
    db.task.findMany({
      where: { companyId, status: { in: ['WORKING', 'PENDING'] }, agentId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, title: true, status: true, agent: { select: { name: true } } },
    }),
  ]);

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
  const when = (d: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  const sar = (n: number) => `${Math.round(n).toLocaleString('en')} SAR`;

  const approvalCards: ApprovalCardData[] = approvals.map((a) => ({
    id: a.id,
    agentId: a.agentId,
    agentName: a.agent.name,
    deptLabel: en ? a.agent.department.nameEn || a.agent.department.name : a.agent.department.name,
    hue: deptHue(a.agent.department),
    decision: a.decision,
    context: a.context,
  }));

  const Panel = ({
    title,
    icon: Icon,
    href,
    empty,
    children,
  }: {
    title: string;
    icon: typeof CalendarCheck;
    href: string;
    empty: string;
    children: React.ReactNode;
    hasItems?: boolean;
  }) => (
    <div className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h2>
        <Link href={href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {tb('all')} <ArrowRight className="size-3 rtl:rotate-180" />
        </Link>
      </div>
      {children ?? <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{tb('title')}</h1>
        <p className="text-sm text-muted-foreground">{tb('subtitle')}</p>
      </div>

      {/* Whole-business 360° snapshot. */}
      <BusinessCounters companyId={companyId} />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {/* Upcoming bookings */}
          <Panel title={tb('upcomingBookings')} icon={CalendarCheck} href="/bookings" empty={tb('noBookings')}>
            {upcomingBookings.length > 0 ? (
              <div className="divide-y">
                {upcomingBookings.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="size-2 shrink-0 rounded-full bg-indigo-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.customer?.name || b.title}</p>
                      {b.customer?.name && <p className="truncate text-xs text-muted-foreground">{b.title}</p>}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground tabular-nums">{when(b.startAt)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>

          {/* Recent orders */}
          <Panel title={tb('recentOrders')} icon={ShoppingBag} href="/orders" empty={tb('noOrders')}>
            {recentOrders.length > 0 ? (
              <div className="divide-y">
                {recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="size-2 shrink-0 rounded-full bg-sky-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{o.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums" dir="ltr">{o.orderNumber}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{sar(Number(o.total))}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>

          {/* Agent tasks in progress */}
          <Panel title={tb('agentTasks')} icon={ListChecks} href="/tasks" empty={tb('noTasks')}>
            {openTasks.length > 0 ? (
              <div className="divide-y">
                {openTasks.map((tk) => (
                  <div key={tk.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`size-2 shrink-0 rounded-full ${tk.status === 'WORKING' ? 'bg-amber-500' : 'bg-muted-foreground/50'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tk.title}</p>
                      {tk.agent?.name && <p className="truncate text-xs text-muted-foreground">{tk.agent.name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>
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
    </div>
  );
}
