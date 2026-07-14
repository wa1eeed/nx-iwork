'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import {
  parseFields,
  normalizeFields,
  coerceRecord,
  computeTitle,
  toKey,
  type FieldDef,
} from '@/lib/objects/fields';

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function companyId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

// A company-unique machine key derived from the type name.
async function uniqueTypeKey(cid: string, name: string, excludeId?: string): Promise<string> {
  const base = toKey(name) || 'type';
  const existing = await db.objectType.findMany({
    where: { companyId: cid, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { key: true },
  });
  const taken = new Set(existing.map((e) => e.key));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const k = `${base}_${i}`;
    if (!taken.has(k)) return k;
  }
  return `${base}_${Date.now()}`;
}

export interface ObjectTypeInput {
  name: string;
  nameEn?: string | null;
  icon?: string | null;
  description?: string | null;
  fields: Array<Partial<FieldDef>>;
}

export async function createObjectType(input: ObjectTypeInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };

  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'name_required' };
  const fields = normalizeFields(input.fields ?? []);
  if (fields.length === 0) return { ok: false, error: 'fields_required' };

  const key = await uniqueTypeKey(cid, name);
  const created = await db.objectType.create({
    data: {
      companyId: cid,
      key,
      name,
      nameEn: input.nameEn?.trim() || null,
      icon: input.icon?.trim() || null,
      description: input.description?.trim() || null,
      fields: fields as unknown as object,
    },
    select: { id: true },
  });
  revalidatePath('/data');
  return { ok: true, id: created.id };
}

export async function updateObjectType(id: string, input: ObjectTypeInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };

  const existing = await db.objectType.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!existing) return { ok: false, error: 'not_found' };

  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'name_required' };
  const fields = normalizeFields(input.fields ?? []);
  if (fields.length === 0) return { ok: false, error: 'fields_required' };

  await db.objectType.update({
    where: { id },
    data: {
      name,
      nameEn: input.nameEn?.trim() || null,
      icon: input.icon?.trim() || null,
      description: input.description?.trim() || null,
      fields: fields as unknown as object,
    },
  });
  revalidatePath('/data');
  revalidatePath(`/data/${id}`);
  return { ok: true, id };
}

export async function deleteObjectType(id: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const existing = await db.objectType.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!existing) return { ok: false, error: 'not_found' };
  await db.objectType.delete({ where: { id } }); // cascades to records
  revalidatePath('/data');
  return { ok: true };
}

// ── Records ──────────────────────────────────────────────────────────────────
export async function createRecord(
  objectTypeId: string,
  data: Record<string, unknown>
): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };

  const type = await db.objectType.findFirst({
    where: { id: objectTypeId, companyId: cid },
    select: { id: true, fields: true },
  });
  if (!type) return { ok: false, error: 'not_found' };

  const fields = parseFields(type.fields);
  const coerced = coerceRecord(fields, data);
  if (!coerced.ok) return { ok: false, error: coerced.error };

  const created = await db.objectRecord.create({
    data: {
      companyId: cid,
      objectTypeId,
      data: coerced.data as unknown as object,
      title: computeTitle(fields, coerced.data),
    },
    select: { id: true },
  });
  revalidatePath(`/data/${objectTypeId}`);
  return { ok: true, id: created.id };
}

export async function updateRecord(id: string, data: Record<string, unknown>): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };

  const record = await db.objectRecord.findFirst({
    where: { id, companyId: cid },
    select: { id: true, objectTypeId: true, objectType: { select: { fields: true } } },
  });
  if (!record) return { ok: false, error: 'not_found' };

  const fields = parseFields(record.objectType.fields);
  const coerced = coerceRecord(fields, data);
  if (!coerced.ok) return { ok: false, error: coerced.error };

  await db.objectRecord.update({
    where: { id },
    data: { data: coerced.data as unknown as object, title: computeTitle(fields, coerced.data) },
  });
  revalidatePath(`/data/${record.objectTypeId}`);
  return { ok: true, id };
}

export async function deleteRecord(id: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const record = await db.objectRecord.findFirst({
    where: { id, companyId: cid },
    select: { id: true, objectTypeId: true },
  });
  if (!record) return { ok: false, error: 'not_found' };
  await db.objectRecord.delete({ where: { id } });
  revalidatePath(`/data/${record.objectTypeId}`);
  return { ok: true };
}
