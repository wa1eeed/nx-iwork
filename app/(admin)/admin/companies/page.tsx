import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Prisma } from '@prisma/client';
import { Search, ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  TRIAL: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  SUSPENDED: 'bg-destructive/15 text-destructive',
  EXPIRED: 'bg-muted text-muted-foreground',
};

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const t = await getTranslations('admin');
  const locale = await getLocale();
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const where: Prisma.CompanyWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { slug: { contains: query, mode: 'insensitive' } },
        ],
      }
    : {};

  const companies = await db.company.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      tokenBalance: true,
      _count: { select: { agents: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('companies.title')}</h1>
        <form action="/admin/companies" className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={query} placeholder={t('companies.search')} className="w-72 max-w-full ps-9" />
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* header (desktop) */}
          <div className="hidden grid-cols-12 gap-3 border-b px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
            <span className="col-span-5">{t('companies.colCompany')}</span>
            <span className="col-span-2">{t('companies.colPlan')}</span>
            <span className="col-span-2">{t('companies.colStatus')}</span>
            <span className="col-span-1 text-center">{t('companies.colAgents')}</span>
            <span className="col-span-2 text-end">{t('companies.colTokens')}</span>
          </div>

          {companies.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t('companies.empty')}</p>
          ) : (
            <ul className="divide-y">
              {companies.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/companies/${c.id}`}
                    className="grid grid-cols-2 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/40 sm:grid-cols-12"
                  >
                    <span className="col-span-2 min-w-0 sm:col-span-5">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground" dir="ltr">/{c.slug}</span>
                    </span>
                    <span className="col-span-2 text-xs text-muted-foreground sm:col-span-2">{c.plan}</span>
                    <span className="sm:col-span-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_CLS[c.status] ?? 'bg-muted'}`}>
                        {t(`status.${c.status}`)}
                      </span>
                    </span>
                    <span className="col-span-1 text-center text-xs tabular-nums text-muted-foreground sm:col-span-1">{c._count.agents}</span>
                    <span className="col-span-1 flex items-center justify-end gap-2 text-end font-mono text-xs tabular-nums sm:col-span-2" dir="ltr">
                      {c.tokenBalance.toLocaleString(locale)}
                      <ArrowRight className="size-3.5 text-muted-foreground rtl:rotate-180" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
