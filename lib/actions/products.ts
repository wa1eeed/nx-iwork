'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { nextRef } from '@/lib/refs';
import { productSchema, type ProductInput } from '@/lib/validators/products';

export type ProductActionResult =
  | { ok: true; id: string }
  | { ok: false; error: 'unauthenticated' | 'no_company' | 'validation' | 'not_found' | 'generic' };

async function companyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserCompany(session.user.id);
}

// customFields arrives as a string→string record; store as JSON (or null when
// empty so we don't persist {} noise).
function toJson(fields: Record<string, string>): Prisma.InputJsonValue | undefined {
  return Object.keys(fields).length ? (fields as Prisma.InputJsonValue) : undefined;
}

export async function createProduct(raw: ProductInput): Promise<ProductActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  try {
    const product = await db.product.create({
      data: {
        companyId: cid,
        ref: await nextRef(cid, 'product'),
        title: d.title,
        titleEn: d.titleEn || null,
        description: d.description,
        price: d.price,
        comparePrice: d.comparePrice ?? null,
        sku: d.sku || null,
        stock: d.stock,
        images: d.images,
        isActive: d.isActive,
        customFields: toJson(d.customFields),
      },
      select: { id: true },
    });
    revalidatePath('/products');
    return { ok: true, id: product.id };
  } catch (err) {
    console.error('createProduct failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function updateProduct(
  id: string,
  raw: ProductInput
): Promise<ProductActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  try {
    // updateMany with the companyId guard prevents editing another tenant's row.
    const res = await db.product.updateMany({
      where: { id, companyId: cid },
      data: {
        title: d.title,
        titleEn: d.titleEn || null,
        description: d.description,
        price: d.price,
        comparePrice: d.comparePrice ?? null,
        sku: d.sku || null,
        stock: d.stock,
        images: d.images,
        isActive: d.isActive,
        customFields: toJson(d.customFields) ?? Prisma.DbNull,
      },
    });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    return { ok: true, id };
  } catch (err) {
    console.error('updateProduct failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteProduct(id: string): Promise<ProductActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };

  try {
    const res = await db.product.deleteMany({ where: { id, companyId: cid } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/products');
    return { ok: true, id };
  } catch (err) {
    console.error('deleteProduct failed', err);
    return { ok: false, error: 'generic' };
  }
}
