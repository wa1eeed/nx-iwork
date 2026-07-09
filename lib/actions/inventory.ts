'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function companyId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

export interface InventoryInput {
  name: string;
  sku?: string | null;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost?: number | null;
  supplier?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

function clean(input: InventoryInput) {
  return {
    name: input.name.trim(),
    sku: input.sku?.trim() || null,
    unit: input.unit.trim() || 'unit',
    quantityOnHand: Math.max(0, Number(input.quantityOnHand) || 0),
    reorderLevel: Math.max(0, Number(input.reorderLevel) || 0),
    unitCost: input.unitCost != null && Number.isFinite(input.unitCost) ? Math.max(0, input.unitCost) : null,
    supplier: input.supplier?.trim() || null,
    notes: input.notes?.trim() || null,
    isActive: input.isActive ?? true,
  };
}

export async function createInventoryItem(input: InventoryInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const data = clean(input);
  if (!data.name) return { ok: false, error: 'name_required' };
  const row = await db.inventoryItem.create({ data: { companyId: cid, ...data }, select: { id: true } });
  revalidatePath('/inventory');
  return { ok: true, id: row.id };
}

export async function updateInventoryItem(id: string, input: InventoryInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const data = clean(input);
  if (!data.name) return { ok: false, error: 'name_required' };
  const res = await db.inventoryItem.updateMany({ where: { id, companyId: cid }, data });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/inventory');
  return { ok: true, id };
}

export async function deleteInventoryItem(id: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const res = await db.inventoryItem.deleteMany({ where: { id, companyId: cid } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/inventory');
  return { ok: true, id };
}

// Increment/decrement stock (receiving or consumption). Clamped at 0.
export async function adjustStock(id: string, delta: number): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const item = await db.inventoryItem.findFirst({
    where: { id, companyId: cid },
    select: { quantityOnHand: true },
  });
  if (!item) return { ok: false, error: 'not_found' };
  const next = Math.max(0, Number(item.quantityOnHand) + delta);
  await db.inventoryItem.update({ where: { id }, data: { quantityOnHand: next } });
  revalidatePath('/inventory');
  return { ok: true, id };
}
