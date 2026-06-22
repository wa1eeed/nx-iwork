import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { PlansStorageManager } from '@/components/admin/plans-storage-manager';

const SHOWN = ['STARTER', 'GROWTH', 'SCALE'] as const;
const GB = 1073741824;

export default async function AdminPlansPage() {
  const t = await getTranslations('admin.plans');

  const [allPlans, agg, top] = await Promise.all([
    db.plan.findMany({ select: { tier: true, nameEn: true, maxStorageBytes: true } }),
    db.company.aggregate({ _sum: { storageUsedBytes: true } }),
    db.company.findMany({
      orderBy: { storageUsedBytes: 'desc' },
      take: 12,
      select: { id: true, name: true, plan: true, storageUsedBytes: true, storageLimitBytes: true },
    }),
  ]);

  const planLimit = new Map(allPlans.map((p) => [p.tier, Number(p.maxStorageBytes)]));
  const plans = SHOWN.map((tier) => {
    const p = allPlans.find((x) => x.tier === tier);
    return { tier, name: p?.nameEn ?? tier, gb: p ? Number(p.maxStorageBytes) / GB : 0 };
  });

  const totalUsed = agg._sum.storageUsedBytes ? Number(agg._sum.storageUsedBytes) : 0;
  const consumers = top
    .map((c) => {
      const limit =
        c.storageLimitBytes != null ? Number(c.storageLimitBytes) : planLimit.get(c.plan) ?? 0;
      const used = Number(c.storageUsedBytes);
      return {
        id: c.id,
        name: c.name,
        used,
        limit,
        percent: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0,
      };
    })
    .filter((c) => c.used > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <PlansStorageManager plans={plans} totalUsed={totalUsed} consumers={consumers} />
    </div>
  );
}
