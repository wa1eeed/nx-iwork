import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Building2, Bot, ListChecks, Coins, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { HoverLift, AnimatedCounter } from '@/components/ui/motion';
import { SeedRefineButton } from '@/components/admin/seed-refine-button';
import { SeedDemoButton } from '@/components/admin/seed-demo-button';

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  TRIAL: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  SUSPENDED: 'bg-destructive/15 text-destructive',
  EXPIRED: 'bg-muted text-muted-foreground',
};

export default async function AdminOverviewPage() {
  const t = await getTranslations('admin');
  const locale = await getLocale();
  const en = locale === 'en';
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [companies, activeCompanies, newWeek, agents, tasks, tokens, byStatus, recent] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { status: 'ACTIVE' } }),
    db.company.count({ where: { createdAt: { gte: weekAgo } } }),
    db.agent.count({ where: { status: { not: 'ARCHIVED' } } }),
    db.task.count(),
    db.company.aggregate({ _sum: { tokenBalance: true } }),
    db.company.groupBy({ by: ['status'], _count: { _all: true } }),
    db.company.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, name: true, slug: true, plan: true, status: true },
    }),
  ]);

  const stats = [
    { label: t('overview.companies'), value: companies, icon: Building2, tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { label: en ? 'Active' : 'نشطة', value: activeCompanies, icon: Sparkles, tint: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
    { label: t('overview.agents'), value: agents, icon: Bot, tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    { label: t('overview.tasks'), value: tasks, icon: ListChecks, tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    { label: t('overview.tokens'), value: tokens._sum.tokenBalance ?? 0, icon: Coins, tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { label: en ? 'New this week' : 'جديدة هذا الأسبوع', value: newWeek, icon: TrendingUp, tint: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <HoverLift key={s.label}>
            <Card className="h-full shadow-card transition hover:border-primary/30 hover:shadow-elevated">
              <CardContent className="flex items-start gap-3 p-4">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${s.tint}`}>
                  <s.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-tight tabular-nums">
                    <AnimatedCounter value={s.value} locale={locale} />
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </HoverLift>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium">{t('overview.byStatus')}</p>
            <div className="flex flex-wrap gap-2">
              {byStatus.map((s) => (
                <span key={s.status} className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLS[s.status] ?? 'bg-muted'}`}>
                  {t(`status.${s.status}`)} · {s._count._all}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-medium">{t('overview.recent')}</p>
            <div className="space-y-1">
              {recent.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/companies/${c.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent/50"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">/{c.slug}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_CLS[c.status] ?? 'bg-muted'}`}>
                    {t(`status.${c.status}`)}
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground rtl:rotate-180" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SeedRefineButton />
        <SeedDemoButton />
      </div>
    </div>
  );
}
