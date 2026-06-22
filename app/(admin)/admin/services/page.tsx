import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { MarketplaceManager } from '@/components/admin/marketplace-manager';

export default async function AdminServicesPage() {
  const t = await getTranslations('admin.services');
  const rows = await db.marketplaceService.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { purchases: true } } },
  });

  const services = rows.map((s) => ({
    id: s.id,
    title: s.title,
    titleAr: s.titleAr,
    description: s.description,
    descriptionAr: s.descriptionAr,
    price: s.price.toNumber(),
    icon: s.icon,
    category: s.category,
    active: s.active,
    sortOrder: s.sortOrder,
    grantStorageGb: s.grantStorageBytes ? Number(s.grantStorageBytes) / 1073741824 : null,
    purchases: s._count.purchases,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <MarketplaceManager services={services} />
    </div>
  );
}
