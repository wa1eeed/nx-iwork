'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { requireSuperAdmin } from '@/lib/admin';
import { purchaseService } from '@/lib/marketplace';

// ── Customer: buy a service with the wallet ──────────────────────────────────

export type BuyServiceResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'inactive' | 'insufficient' | 'generic' };

export async function buyService(serviceId: string): Promise<BuyServiceResult> {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) return { ok: false, error: 'unauthorized' };
  if (typeof serviceId !== 'string' || !serviceId) return { ok: false, error: 'not_found' };

  try {
    const res = await purchaseService(companyId, serviceId);
    if (!res.ok) return { ok: false, error: res.reason };
    revalidatePath('/services');
    revalidatePath('/wallet');
    return { ok: true };
  } catch (err) {
    console.error('buyService failed', err);
    return { ok: false, error: 'generic' };
  }
}

// ── Admin: manage the catalog ────────────────────────────────────────────────

export type AdminMpResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'forbidden' | 'invalid' | 'in_use' | 'generic' };

const serviceSchema = z.object({
  title: z.string().trim().min(1).max(120),
  titleAr: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  descriptionAr: z.string().trim().max(2000).optional().nullable(),
  price: z.number().min(0).max(1_000_000),
  icon: z.string().trim().max(40).optional(),
  category: z.string().trim().max(60).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export type MarketplaceServiceInput = z.infer<typeof serviceSchema>;

function toData(d: MarketplaceServiceInput) {
  return {
    title: d.title,
    titleAr: d.titleAr ?? null,
    description: d.description ?? null,
    descriptionAr: d.descriptionAr ?? null,
    price: d.price,
    icon: d.icon || 'package',
    category: d.category ?? null,
    active: d.active ?? true,
    sortOrder: d.sortOrder ?? 0,
  };
}

export async function createMarketplaceService(input: MarketplaceServiceInput): Promise<AdminMpResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  try {
    const created = await db.marketplaceService.create({ data: toData(parsed.data) });
    revalidatePath('/admin/services');
    revalidatePath('/services');
    return { ok: true, id: created.id };
  } catch (err) {
    console.error('createMarketplaceService failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function updateMarketplaceService(
  id: string,
  input: MarketplaceServiceInput
): Promise<AdminMpResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  try {
    await db.marketplaceService.update({ where: { id }, data: toData(parsed.data) });
    revalidatePath('/admin/services');
    revalidatePath('/services');
    return { ok: true };
  } catch (err) {
    console.error('updateMarketplaceService failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function toggleMarketplaceService(id: string, active: boolean): Promise<AdminMpResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  try {
    await db.marketplaceService.update({ where: { id }, data: { active } });
    revalidatePath('/admin/services');
    revalidatePath('/services');
    return { ok: true };
  } catch (err) {
    console.error('toggleMarketplaceService failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteMarketplaceService(id: string): Promise<AdminMpResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  try {
    // Keep purchase history intact: a sold service is deactivated, not deleted.
    const count = await db.servicePurchase.count({ where: { serviceId: id } });
    if (count > 0) return { ok: false, error: 'in_use' };
    await db.marketplaceService.delete({ where: { id } });
    revalidatePath('/admin/services');
    revalidatePath('/services');
    return { ok: true };
  } catch (err) {
    console.error('deleteMarketplaceService failed', err);
    return { ok: false, error: 'generic' };
  }
}
