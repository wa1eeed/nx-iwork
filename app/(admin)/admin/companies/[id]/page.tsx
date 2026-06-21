import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Bot, ListChecks, Users, Coins } from 'lucide-react';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { CompanyActions } from '@/components/admin/company-actions';

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  TRIAL: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  SUSPENDED: 'bg-destructive/15 text-destructive',
  EXPIRED: 'bg-muted text-muted-foreground',
};

export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('admin');
  const locale = await getLocale();

  const company = await db.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nameEn: true,
      slug: true,
      plan: true,
      status: true,
      tokenBalance: true,
      createdAt: true,
      customDomain: true,
      users: { where: { role: 'BUSINESS_OWNER' }, take: 1, select: { name: true, email: true } },
      _count: { select: { agents: true, tasks: true, customers: true } },
    },
  });
  if (!company) notFound();

  const owner = company.users[0];
  const usage = [
    { label: t('company.agents'), value: company._count.agents, icon: Bot },
    { label: t('company.tasks'), value: company._count.tasks, icon: ListChecks },
    { label: t('company.customers'), value: company._count.customers, icon: Users },
    { label: t('company.tokens'), value: company.tokenBalance, icon: Coins },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/companies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4 rtl:rotate-180" />
        {t('company.back')}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-brand-soft text-xl font-bold text-primary">
          {Array.from(company.name)[0] ?? '؟'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {company.name}
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[company.status] ?? 'bg-muted'}`}>
              {t(`status.${company.status}`)}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            <a href={`/${company.slug}`} target="_blank" className="font-mono hover:text-foreground" dir="ltr">/{company.slug}</a>
            {' · '}{company.plan}
            {owner?.email ? ` · ${t('company.owner')}: ${owner.email}` : ''}
            {` · ${t('company.created')}: ${company.createdAt.toLocaleDateString(locale)}`}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">{t('company.usage')}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {usage.map((u) => (
            <Card key={u.label}>
              <CardContent className="p-4">
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-gradient-brand-soft text-primary">
                  <u.icon className="size-4" />
                </div>
                <p className="text-2xl font-semibold tabular-nums">{u.value.toLocaleString(locale)}</p>
                <p className="text-xs text-muted-foreground">{u.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <CompanyActions companyId={company.id} plan={company.plan} status={company.status} />
    </div>
  );
}
