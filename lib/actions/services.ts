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

export interface ServiceInput {
  title: string;
  subtitle?: string | null;
  description: string;
  price?: number | null;
  priceLabel?: string | null;
  durationMin?: number | null; // null = not bookable by slot
  bufferMin?: number;
  maxCapacity?: number;
  allowWaitlist?: boolean;
  departmentId?: string | null; // clinic / category
  image?: string | null;
  isActive?: boolean;
}

function clean(input: ServiceInput) {
  return {
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    description: (input.description ?? '').trim() || input.title.trim(),
    price: input.price != null && Number.isFinite(input.price) ? Math.max(0, input.price) : null,
    priceLabel: input.priceLabel?.trim() || null,
    durationMin:
      input.durationMin != null && Number.isFinite(input.durationMin)
        ? Math.min(1440, Math.max(5, Math.round(input.durationMin)))
        : null,
    bufferMin: input.bufferMin != null ? Math.max(0, Math.round(input.bufferMin)) : 0,
    maxCapacity: input.maxCapacity != null ? Math.max(1, Math.round(input.maxCapacity)) : 1,
    allowWaitlist: input.allowWaitlist ?? false,
    image: input.image?.trim() || null,
    isActive: input.isActive ?? true,
  };
}

// Validate an optional department belongs to the same tenant before linking.
async function safeDepartmentId(cid: string, departmentId?: string | null): Promise<string | null> {
  if (!departmentId) return null;
  const dept = await db.department.findFirst({
    where: { id: departmentId, companyId: cid },
    select: { id: true },
  });
  return dept ? dept.id : null;
}

export async function createService(input: ServiceInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const data = clean(input);
  if (!data.title) return { ok: false, error: 'title_required' };
  const departmentId = await safeDepartmentId(cid, input.departmentId);
  const row = await db.service.create({
    data: { companyId: cid, departmentId, ...data },
    select: { id: true },
  });
  revalidatePath('/services');
  revalidatePath('/departments');
  return { ok: true, id: row.id };
}

export async function updateService(id: string, input: ServiceInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const data = clean(input);
  if (!data.title) return { ok: false, error: 'title_required' };
  const departmentId = await safeDepartmentId(cid, input.departmentId);
  const res = await db.service.updateMany({
    where: { id, companyId: cid },
    data: { departmentId, ...data },
  });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/services');
  revalidatePath('/departments');
  return { ok: true, id };
}

export async function deleteService(id: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const res = await db.service.deleteMany({ where: { id, companyId: cid } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/services');
  revalidatePath('/departments');
  return { ok: true, id };
}
