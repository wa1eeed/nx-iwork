'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/admin';
import type { ClaudeModel } from '@prisma/client';

type Result = { ok: true } | { ok: false; error: string };

// The runtime adapters the platform can drive. Adding an id here + an adapter in
// lib/ai/providers is the only code needed to support a whole new vendor; new
// MODELS of an existing vendor need no code at all — just a registry row.
const PROVIDERS = ['vertex', 'google', 'anthropic', 'openai'] as const;

const createSchema = z.object({
  provider: z.enum(PROVIDERS),
  modelId: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  tier: z.enum(['HAIKU', 'SONNET', 'OPUS']),
});

export async function createAiModel(input: z.infer<typeof createSchema>): Promise<Result> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  try {
    await db.aiModel.create({
      data: { ...parsed.data, tier: parsed.data.tier as ClaudeModel, enabled: true },
    });
    revalidatePath('/admin/models');
    return { ok: true };
  } catch {
    // Unique (provider, modelId) collision or similar.
    return { ok: false, error: 'duplicate' };
  }
}

export async function toggleAiModel(id: string, enabled: boolean): Promise<Result> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  const res = await db.aiModel.updateMany({ where: { id }, data: { enabled } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/admin/models');
  return { ok: true };
}

// Exactly one platform default: clear the flag everywhere, then set it here.
export async function setDefaultAiModel(id: string): Promise<Result> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  await db.$transaction([
    db.aiModel.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    db.aiModel.updateMany({ where: { id }, data: { isDefault: true, enabled: true } }),
  ]);
  revalidatePath('/admin/models');
  return { ok: true };
}

export async function deleteAiModel(id: string): Promise<Result> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  // Agents pointing at it fall back to their tier (FK is SET NULL).
  const res = await db.aiModel.deleteMany({ where: { id } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/admin/models');
  return { ok: true };
}
