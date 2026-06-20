import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Users,
  Building2,
  ListChecks,
  CheckCircle2,
  UserPlus,
  CalendarCheck,
  Coins,
  Plus,
  ArrowRight,
  Activity,
} from 'lucide-react';
import type { TaskStatus } from '@prisma/client';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAiMode } from '@/lib/ai';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const IN_PROGRESS: TaskStatus[] = ['PENDING', 'WORKING', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'BLOCKED'];

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const t = await getTranslations('overview');
  const locale = await getLocale();
  const fmt = (d: Date) => d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true, company: { select: { name: true, tokenBalance: true, hasBookings: true } } },
  });
  if (!user?.companyId || !user.company) redirect('/onboarding');
  const companyId = user.companyId;
  const managed = getAiMode() === 'managed';

  const [agents, departments, customers, tasksDone, tasksActive, bookings, schedules, timeline] =
    await Promise.all([
      db.agent.count({ where: { companyId, status: { not: 'ARCHIVED' } } }),
      db.department.count({ where: { companyId } }),
      db.customer.count({ where: { companyId } }),
      db.task.count({ where: { companyId, status: 'DONE' } }),
      db.task.count({ where: { companyId, status: { in: IN_PROGRESS } } }),
      user.company.hasBookings ? db.booking.count({ where: { companyId } }) : Promise.resolve(0),
      db.agentSchedule.count({ where: { companyId, isActive: true } }),
      db.timelineEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, title: true, type: true, createdAt: true },
      }),
    ]);

  const stats = [
    { label: t('stats.employees'), value: agents, icon: Users, href: '/agents' },
    { label: t('stats.departments'), value: departments, icon: Building2, href: '/departments' },
    { label: t('stats.tasksActive'), value: tasksActive, icon: ListChecks, href: '/tasks' },
    { label: t('stats.tasksDone'), value: tasksDone, icon: CheckCircle2, href: '/tasks' },
    { label: t('stats.customers'), value: customers, icon: UserPlus, href: '/customers' },
    { label: t('stats.activeSchedules'), value: schedules, icon: CalendarCheck, href: '/knowledge' },
    ...(user.company.hasBookings
      ? [{ label: t('stats.bookings'), value: bookings, icon: CalendarCheck, href: '/bookings' }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('greeting', { name: session.user.name ?? '' })}</h1>
          <p className="text-sm text-muted-foreground">{t('companyDashboard', { company: user.company.name })}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/agents/new"><Plus className="me-1 h-4 w-4" />{t('newAgent')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/chat">{t('chatAgent')}</Link>
          </Button>
        </div>
      </div>

      {managed && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Coins className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{t('tokensRemaining')}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {user.company.tokenBalance.toLocaleString(locale)}
              </p>
            </div>
            {user.company.tokenBalance <= 0 && (
              <span className="rounded-full bg-destructive/15 px-3 py-1 text-xs text-destructive">
                {t('outOfTokens')}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="transition hover:border-primary/50">
                <CardContent className="p-4">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Activity className="h-4 w-4" />
          {t('recentActivity')}
        </h2>
        {timeline.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t('noActivity')}
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href="/agents/new">{t('createFirstAgent')} <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {timeline.map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <p className="min-w-0 flex-1 truncate text-sm">{e.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmt(e.createdAt)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
