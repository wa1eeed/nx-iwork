'use server';

import { revalidatePath } from 'next/cache';
import type { LeadStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { nextRef } from '@/lib/refs';
import { customerSchema, type CustomerInput } from '@/lib/validators/customers';

export type CustomerResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_company' | 'validation' | 'not_found' | 'generic' };

async function companyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserCompany(session.user.id);
}

export async function createCustomer(raw: CustomerInput): Promise<CustomerResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  try {
    const c = await db.customer.create({
      data: {
        companyId: cid,
        ref: await nextRef(cid, 'customer'),
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
        source: 'manual',
      },
      select: { id: true },
    });
    revalidatePath('/customers');
    return { ok: true, id: c.id };
  } catch (err) {
    console.error('createCustomer failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function updateCustomer(id: string, raw: CustomerInput): Promise<CustomerResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  try {
    const res = await db.customer.updateMany({
      where: { id, companyId: cid },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
      },
    });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { ok: true, id };
  } catch (err) {
    console.error('updateCustomer failed', err);
    return { ok: false, error: 'generic' };
  }
}

// Quick status change from the list (pipeline move).
export async function setCustomerStatus(id: string, status: LeadStatus): Promise<CustomerResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.customer.updateMany({ where: { id, companyId: cid }, data: { status } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { ok: true, id };
  } catch (err) {
    console.error('setCustomerStatus failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteCustomer(id: string): Promise<CustomerResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.customer.deleteMany({ where: { id, companyId: cid } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/customers');
    return { ok: true, id };
  } catch (err) {
    console.error('deleteCustomer failed', err);
    return { ok: false, error: 'generic' };
  }
}
