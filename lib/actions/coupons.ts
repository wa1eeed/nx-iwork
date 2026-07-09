'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, type CouponType, type CouponScope } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function companyId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

export interface CouponInput {
  code: string;
  type: CouponType;
  value: number;
  scope: CouponScope;
  minSubtotal?: number | null;
  maxRedemptions?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

// Clamp + normalize a raw coupon payload into safe DB values.
function clean(input: CouponInput) {
  const code = input.code.trim().toUpperCase();
  const value =
    input.type === 'PERCENT'
      ? Math.min(100, Math.max(0, Number(input.value) || 0))
      : Math.max(0, Number(input.value) || 0);
  return {
    code,
    type: input.type,
    value,
    scope: input.scope,
    minSubtotal:
      input.minSubtotal != null && Number.isFinite(input.minSubtotal)
        ? Math.max(0, input.minSubtotal)
        : null,
    maxRedemptions:
      input.maxRedemptions != null && Number.isFinite(input.maxRedemptions)
        ? Math.max(1, Math.round(input.maxRedemptions))
        : null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    isActive: input.isActive ?? true,
  };
}

export async function createCoupon(input: CouponInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const data = clean(input);
  if (!data.code) return { ok: false, error: 'code_required' };
  try {
    const row = await db.coupon.create({ data: { companyId: cid, ...data }, select: { id: true } });
    revalidatePath('/coupons');
    return { ok: true, id: row.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, error: 'duplicate' };
    }
    console.error('createCoupon failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function updateCoupon(id: string, input: CouponInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const data = clean(input);
  if (!data.code) return { ok: false, error: 'code_required' };
  try {
    const res = await db.coupon.updateMany({ where: { id, companyId: cid }, data });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/coupons');
    return { ok: true, id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, error: 'duplicate' };
    }
    console.error('updateCoupon failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteCoupon(id: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const res = await db.coupon.deleteMany({ where: { id, companyId: cid } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/coupons');
  return { ok: true, id };
}

export type CouponCheck =
  | { ok: true; couponId: string; discount: number; code: string }
  | { ok: false; error: string };

// Validate a coupon code against a subtotal + scope, returning the discount to
// apply. Deterministic + tenant-scoped — the same check the order flow uses
// before recording `Order.couponId`/`discount`. Does NOT increment usedCount
// (do that only when the order is actually placed).
export async function checkCoupon(
  code: string,
  scope: 'PRODUCTS' | 'SERVICES' | 'BOOKINGS',
  subtotal: number
): Promise<CouponCheck> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const coupon = await db.coupon.findFirst({
    where: { companyId: cid, code: code.trim().toUpperCase() },
  });
  if (!coupon || !coupon.isActive) return { ok: false, error: 'invalid' };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: 'not_started' };
  if (coupon.expiresAt && coupon.expiresAt < now) return { ok: false, error: 'expired' };
  if (coupon.maxRedemptions != null && coupon.usedCount >= coupon.maxRedemptions) {
    return { ok: false, error: 'exhausted' };
  }
  if (coupon.scope !== 'ALL' && coupon.scope !== scope) return { ok: false, error: 'wrong_scope' };
  const min = coupon.minSubtotal ? Number(coupon.minSubtotal) : 0;
  if (subtotal < min) return { ok: false, error: 'below_min' };

  const value = Number(coupon.value);
  const discount =
    coupon.type === 'PERCENT'
      ? Math.round(((subtotal * value) / 100) * 100) / 100
      : Math.min(subtotal, value);

  return { ok: true, couponId: coupon.id, discount, code: coupon.code };
}
