// Marketplace — platform add-ons/services sold to business owners, bought with
// the wallet. A purchase debits the wallet, records a WalletTransaction, and
// stores a ServicePurchase (activation/plugins are a later phase).

import { db } from '@/lib/db';

export interface MarketplaceServiceView {
  id: string;
  title: string;
  description: string | null;
  price: number;
  icon: string;
  category: string | null;
}

export async function listActiveServices(locale = 'en'): Promise<MarketplaceServiceView[]> {
  const rows = await db.marketplaceService.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const ar = locale === 'ar';
  return rows.map((s) => ({
    id: s.id,
    title: ar && s.titleAr ? s.titleAr : s.title,
    description: ar && s.descriptionAr ? s.descriptionAr : s.description,
    price: s.price.toNumber(),
    icon: s.icon,
    category: s.category,
  }));
}

export async function purchasedServiceIds(companyId: string): Promise<string[]> {
  const rows = await db.servicePurchase.findMany({
    where: { companyId, status: { not: 'CANCELLED' } },
    select: { serviceId: true },
  });
  return rows.map((r) => r.serviceId);
}

export type PurchaseServiceResult =
  | { ok: true; balance: number; title: string }
  | { ok: false; reason: 'not_found' | 'inactive' | 'insufficient' };

// Buy a service with the wallet: debit + ledger + purchase record, atomically.
export async function purchaseService(
  companyId: string,
  serviceId: string
): Promise<PurchaseServiceResult> {
  return db.$transaction(async (tx) => {
    const service = await tx.marketplaceService.findUnique({ where: { id: serviceId } });
    if (!service) return { ok: false, reason: 'not_found' };
    if (!service.active) return { ok: false, reason: 'inactive' };

    const cost = service.price.toNumber();
    const wallet = await tx.wallet.findUnique({
      where: { companyId },
      select: { id: true, balance: true },
    });
    if (!wallet || wallet.balance.toNumber() < cost) return { ok: false, reason: 'insufficient' };

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: cost } },
      select: { balance: true },
    });
    const wtx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        companyId,
        type: 'SERVICE_PURCHASE',
        status: 'COMPLETED',
        amount: cost,
        balanceAfter: updated.balance,
        description: service.title,
        metadata: { serviceId: service.id },
      },
    });
    await tx.servicePurchase.create({
      data: {
        companyId,
        serviceId: service.id,
        title: service.title,
        pricePaid: cost,
        walletTxId: wtx.id,
      },
    });

    // Storage add-on: raise the tenant's ceiling by the granted bytes. We
    // materialize the override from the current effective limit (override ?? plan
    // default) + grant, so it stacks correctly.
    if (service.grantStorageBytes && service.grantStorageBytes > 0n) {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { plan: true, storageLimitBytes: true },
      });
      const planRow = await tx.plan.findUnique({
        where: { tier: company?.plan ?? 'STARTER' },
        select: { maxStorageBytes: true },
      });
      const base =
        company?.storageLimitBytes ?? planRow?.maxStorageBytes ?? 5368709120n; // 5 GB fallback
      await tx.company.update({
        where: { id: companyId },
        data: { storageLimitBytes: base + service.grantStorageBytes },
      });
    }

    return { ok: true, balance: updated.balance.toNumber(), title: service.title };
  });
}
