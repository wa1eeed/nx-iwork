'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

export type SitePageActionResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_company' | 'validation' | 'not_found' | 'slug_taken' | 'generic' };

const pageSchema = z.object({
  title: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().max(200).optional().nullable(),
  slug: z.string().trim().max(120).optional().nullable(),
  content: z.string().trim().max(50_000).default(''),
  contentEn: z.string().trim().max(50_000).optional().nullable(),
  showInFooter: z.boolean().default(true),
  showInNav: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});
export type SitePageInput = z.input<typeof pageSchema>;

async function companyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserCompany(session.user.id);
}

// URL-safe slug: keep Arabic + Latin letters/digits, collapse the rest to '-'.
function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'page'
  );
}

async function uniqueSlug(cid: string, base: string, exceptId?: string): Promise<string> {
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const clash = await db.sitePage.findFirst({
      where: { companyId: cid, slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createSitePage(raw: SitePageInput): Promise<SitePageActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = pageSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  try {
    const base = slugify(d.slug || d.title);
    const slug = await uniqueSlug(cid, base);
    const max = await db.sitePage.aggregate({ where: { companyId: cid }, _max: { sortOrder: true } });
    const page = await db.sitePage.create({
      data: {
        companyId: cid,
        title: d.title,
        titleEn: d.titleEn || null,
        slug,
        content: d.content,
        contentEn: d.contentEn || null,
        showInFooter: d.showInFooter,
        showInNav: d.showInNav,
        isPublished: d.isPublished,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });
    revalidatePath('/pages');
    return { ok: true, id: page.id };
  } catch (err) {
    console.error('createSitePage failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function updateSitePage(id: string, raw: SitePageInput): Promise<SitePageActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = pageSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  const existing = await db.sitePage.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!existing) return { ok: false, error: 'not_found' };

  try {
    const base = slugify(d.slug || d.title);
    const slug = await uniqueSlug(cid, base, id);
    await db.sitePage.update({
      where: { id },
      data: {
        title: d.title,
        titleEn: d.titleEn || null,
        slug,
        content: d.content,
        contentEn: d.contentEn || null,
        showInFooter: d.showInFooter,
        showInNav: d.showInNav,
        isPublished: d.isPublished,
      },
    });
    revalidatePath('/pages');
    return { ok: true, id };
  } catch (err) {
    console.error('updateSitePage failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteSitePage(id: string): Promise<SitePageActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.sitePage.deleteMany({ where: { id, companyId: cid } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/pages');
    return { ok: true, id };
  } catch (err) {
    console.error('deleteSitePage failed', err);
    return { ok: false, error: 'generic' };
  }
}
