import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { InventoryManager, type InventoryRow } from '@/components/dashboard/inventory-manager';

export default async function InventoryPage() {
  const t = await getTranslations('pageHeaders');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const items = await db.inventoryItem.findMany({
    where: { companyId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  const rows: InventoryRow[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    sku: it.sku,
    unit: it.unit,
    quantityOnHand: Number(it.quantityOnHand),
    reorderLevel: Number(it.reorderLevel),
    unitCost: it.unitCost != null ? Number(it.unitCost) : null,
    supplier: it.supplier,
    notes: it.notes,
    isActive: it.isActive,
  }));

  const lowCount = rows.filter((r) => r.quantityOnHand <= r.reorderLevel).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('inventory.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('inventory.subtitle')}
          {lowCount > 0 ? ` — ${t('inventory.lowStock', { count: lowCount })}` : ''}
        </p>
      </div>
      <InventoryManager items={rows} />
    </div>
  );
}
