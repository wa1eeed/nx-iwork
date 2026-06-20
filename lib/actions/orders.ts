'use server';

import { revalidatePath } from 'next/cache';
import type { OrderStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

export type OrderResult = { ok: true } | { ok: false; error: 'no_company' | 'not_found' | 'generic' };

async function companyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserCompany(session.user.id);
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<OrderResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.order.updateMany({ where: { id, companyId: cid }, data: { status } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/orders');
    return { ok: true };
  } catch (err) {
    console.error('setOrderStatus failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteOrder(id: string): Promise<OrderResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.order.deleteMany({ where: { id, companyId: cid } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/orders');
    return { ok: true };
  } catch (err) {
    console.error('deleteOrder failed', err);
    return { ok: false, error: 'generic' };
  }
}
