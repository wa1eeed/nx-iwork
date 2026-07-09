'use server';

import { revalidatePath } from 'next/cache';
import type { CommissionType } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function companyId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

export interface StaffInput {
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  commissionType: CommissionType;
  commissionRate: number;
  monthlyTarget?: number | null;
  isActive?: boolean;
}

function clean(input: StaffInput) {
  return {
    name: input.name.trim(),
    role: input.role?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    commissionType: input.commissionType,
    commissionRate: Math.max(0, Number(input.commissionRate) || 0),
    monthlyTarget:
      input.monthlyTarget != null && Number.isFinite(input.monthlyTarget)
        ? Math.max(0, input.monthlyTarget)
        : null,
    isActive: input.isActive ?? true,
  };
}

export async function createStaff(input: StaffInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const data = clean(input);
  if (!data.name) return { ok: false, error: 'name_required' };
  const row = await db.staffMember.create({ data: { companyId: cid, ...data }, select: { id: true } });
  revalidatePath('/staff');
  revalidatePath('/commissions');
  return { ok: true, id: row.id };
}

export async function updateStaff(id: string, input: StaffInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const data = clean(input);
  if (!data.name) return { ok: false, error: 'name_required' };
  const res = await db.staffMember.updateMany({ where: { id, companyId: cid }, data });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/staff');
  revalidatePath('/commissions');
  return { ok: true, id };
}

export async function deleteStaff(id: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const res = await db.staffMember.deleteMany({ where: { id, companyId: cid } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/staff');
  revalidatePath('/commissions');
  return { ok: true, id };
}
