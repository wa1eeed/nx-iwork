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

// Attribute (or clear) the staff member who delivered/sold an order — feeds the
// commissions report. Validates the staff belongs to the same tenant.
export async function setOrderStaff(id: string, staffMemberId: string | null): Promise<OrderResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  if (staffMemberId) {
    const staff = await db.staffMember.findFirst({
      where: { id: staffMemberId, companyId: cid },
      select: { id: true },
    });
    if (!staff) return { ok: false, error: 'not_found' };
  }
  const res = await db.order.updateMany({ where: { id, companyId: cid }, data: { staffMemberId } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/orders');
  revalidatePath('/commissions');
  return { ok: true };
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<OrderResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const order = await db.order.findFirst({
      where: { id, companyId: cid },
      select: { status: true, customerId: true },
    });
    if (!order) return { ok: false, error: 'not_found' };

    await db.order.update({ where: { id }, data: { status } });

    // Keep the linked opportunity in sync with the deal lifecycle:
    //  • cancelling the order → revert the opportunity to LOST, BUT only if the
    //    customer has no other live (non-cancelled) order.
    //  • un-cancelling → the deal is back on → WON.
    // We only act on the cancel/un-cancel transition, so a manual stage change
    // while an order is active is never overridden.
    if (order.customerId) {
      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        const otherLive = await db.order.count({
          where: { companyId: cid, customerId: order.customerId, id: { not: id }, status: { not: 'CANCELLED' } },
        });
        if (otherLive === 0) {
          await db.customer.update({ where: { id: order.customerId }, data: { status: 'LOST' } });
        }
      } else if (status !== 'CANCELLED' && order.status === 'CANCELLED') {
        await db.customer.update({ where: { id: order.customerId }, data: { status: 'WON' } });
      }
    }

    revalidatePath('/orders');
    if (order.customerId) revalidatePath(`/customers/${order.customerId}`);
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
