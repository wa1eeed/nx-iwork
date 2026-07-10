import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Star, CheckCircle2, Inbox } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { ReviewsManager, type ReviewRow } from '@/components/dashboard/reviews-manager';

export const dynamic = 'force-dynamic';

// Owner moderation for customer reviews: publish the good ones to the storefront,
// hide the rest. The average is computed from PUBLISHED reviews (what visitors see).
export default async function ReviewsPage() {
  const t = await getTranslations('reviewsMgr');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const [rows, total, published, pending, agg] = await Promise.all([
    db.review.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, authorName: true, rating: true, comment: true, status: true, createdAt: true,
        service: { select: { title: true } },
      },
    }),
    db.review.count({ where: { companyId } }),
    db.review.count({ where: { companyId, status: 'PUBLISHED' } }),
    db.review.count({ where: { companyId, status: 'PENDING' } }),
    db.review.aggregate({ where: { companyId, status: 'PUBLISHED' }, _avg: { rating: true } }),
  ]);

  const reviews: ReviewRow[] = rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    serviceTitle: r.service?.title ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const avg = agg._avg.rating ?? 0;
  const stats = [
    { icon: Star, label: t('statAvg'), value: published > 0 ? avg.toFixed(1) : '—', tint: 'text-amber-500' },
    { icon: CheckCircle2, label: t('statPublished'), value: String(published), tint: 'text-emerald-500' },
    { icon: Inbox, label: t('statPending'), value: String(pending), tint: 'text-sky-500' },
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
            <p className="mt-2 text-2xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <ReviewsManager reviews={reviews} />
      )}
    </div>
  );
}
