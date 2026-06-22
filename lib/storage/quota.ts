// Multi-tenant R2 storage quota.
//
// The ceiling for a tenant = Company.storageLimitBytes (admin per-tenant override)
// or, when null, the plan's Plan.maxStorageBytes. Usage is the running aggregate
// Company.storageUsedBytes, kept in lock-step with the File registry.
//
// Reservation is ATOMIC: increment the usage counter and create the File row in
// one transaction; if the new usage exceeds the ceiling the whole tx rolls back,
// so nothing is reserved and no File row is written. (Sign first — it has no side
// effect — then reserve, so an over-quota request never receives an upload URL.)

import { Prisma, type PlanTier } from '@prisma/client';
import { db } from '@/lib/db';
import { getStorage } from '@/lib/storage';

// Fallback ceilings if a Plan row is missing (mirror the migration seed).
export const FALLBACK_LIMIT: Record<PlanTier, bigint> = {
  FREE: 1073741824n, // 1 GB
  STARTER: 5368709120n, // 5 GB
  GROWTH: 10737418240n, // 10 GB
  SCALE: 21474836480n, // 20 GB
  ENTERPRISE: 53687091200n, // 50 GB
};

class QuotaError extends Error {
  constructor(
    public used: number,
    public limit: number
  ) {
    super('quota_exceeded');
  }
}

async function resolveLimit(plan: PlanTier, override: bigint | null): Promise<bigint> {
  if (override != null) return override;
  const row = await db.plan.findUnique({ where: { tier: plan }, select: { maxStorageBytes: true } });
  return row?.maxStorageBytes ?? FALLBACK_LIMIT[plan] ?? FALLBACK_LIMIT.STARTER;
}

export interface StorageStatus {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
}

export async function getStorageStatus(companyId: string): Promise<StorageStatus | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { plan: true, storageUsedBytes: true, storageLimitBytes: true },
  });
  if (!company) return null;
  const limit = await resolveLimit(company.plan, company.storageLimitBytes);
  const used = company.storageUsedBytes;
  const remaining = limit > used ? limit - used : 0n;
  return {
    used: Number(used),
    limit: Number(limit),
    remaining: Number(remaining),
    percent: limit > 0n ? Math.min(100, Number((used * 100n) / limit)) : 0,
  };
}

export type ReserveResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'quota_exceeded'; used: number; limit: number };

// Atomic pre-upload allocation: reserve `size` bytes and record the File row.
export async function reserveAndRecordFile(input: {
  companyId: string;
  key: string;
  url: string;
  purpose: string;
  mimeType: string;
  size: number;
  uploadedById: string | null;
}): Promise<ReserveResult> {
  const company = await db.company.findUnique({
    where: { id: input.companyId },
    select: { plan: true, storageLimitBytes: true },
  });
  if (!company) return { ok: false, reason: 'not_found' };

  const limit = await resolveLimit(company.plan, company.storageLimitBytes);
  const size = BigInt(Math.max(0, Math.floor(input.size)));

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id: input.companyId },
        data: { storageUsedBytes: { increment: size } },
        select: { storageUsedBytes: true },
      });
      if (updated.storageUsedBytes > limit) {
        // Roll the whole transaction back — nothing reserved, no File row.
        throw new QuotaError(Number(updated.storageUsedBytes - size), Number(limit));
      }
      await tx.file.create({
        data: {
          companyId: input.companyId,
          key: input.key,
          url: input.url,
          purpose: input.purpose,
          mimeType: input.mimeType,
          size: input.size,
          uploadedById: input.uploadedById,
        },
      });
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof QuotaError) {
      return { ok: false, reason: 'quota_exceeded', used: err.used, limit: err.limit };
    }
    throw err;
  }
}

export type DeleteResult = { ok: true } | { ok: false; reason: 'not_found' | 'generic' };

// Delete a tenant file: remove the R2 object, then delete the row + decrement
// usage atomically. Scoped to companyId so a tenant can only delete its own.
export async function deleteTenantFile(companyId: string, key: string): Promise<DeleteResult> {
  const file = await db.file.findFirst({
    where: { companyId, key },
    select: { id: true, size: true },
  });
  if (!file) return { ok: false, reason: 'not_found' };

  try {
    await getStorage().delete(key);
  } catch (e) {
    // Object delete failed — keep the row so a retry/cleanup can finish it.
    console.error('R2 delete failed', e);
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.file.delete({ where: { id: file.id } });
      await tx.company.update({
        where: { id: companyId },
        data: { storageUsedBytes: { decrement: BigInt(file.size) } },
      });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return { ok: false, reason: 'not_found' };
    }
    console.error('deleteTenantFile failed', e);
    return { ok: false, reason: 'generic' };
  }
}
