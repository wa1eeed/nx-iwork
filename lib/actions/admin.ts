'use server';

import { revalidatePath } from 'next/cache';
import type { CompanyStatus, PlanTier, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/admin';
import { agentTokenCap } from '@/lib/plans';
import { seedRefine } from '@/lib/seed/refine';

export type AdminResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | 'generic' };

export type SeedRefineResult =
  | { ok: true; slug: string; services: number; clinics: number }
  | { ok: false; error: 'forbidden' | 'generic' };

// Build (or rebuild) the Refine Medical Complex client demo tenant. Runs the same
// idempotent seed as `npm run seed:refine`, but from a super-admin session so it
// works inside the production image (no container terminal / secret needed).
export async function seedRefineDemo(): Promise<SeedRefineResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  try {
    const r = await seedRefine();
    await audit(admin.userId, 'admin.seed.refine', null, { services: r.services, clinics: r.clinics });
    revalidatePath('/admin');
    return { ok: true, slug: r.slug, services: r.services, clinics: r.clinics };
  } catch (err) {
    console.error('seedRefineDemo failed', err);
    return { ok: false, error: 'generic' };
  }
}

const VALID_TIERS: PlanTier[] = ['FREE', 'STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE'];
const VALID_STATUS: CompanyStatus[] = ['ACTIVE', 'SUSPENDED', 'TRIAL', 'EXPIRED'];

async function audit(userId: string, action: string, companyId: string | null, metadata: Prisma.InputJsonValue) {
  try {
    await db.auditLog.create({ data: { userId, action, companyId, metadata } });
  } catch (err) {
    console.error('audit log failed', err);
  }
}

// Add prepaid AI credits to a company's token bank.
export async function topUpTokens(companyId: string, amount: number): Promise<AdminResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return { ok: false, error: 'invalid' };

  try {
    await db.company.update({ where: { id: companyId }, data: { tokenBalance: { increment: Math.floor(amount) } } });
    await audit(admin.userId, 'admin.tokens.topup', companyId, { amount: Math.floor(amount) });
    revalidatePath(`/admin/companies/${companyId}`);
    revalidatePath('/admin/companies');
    revalidatePath('/admin');
    return { ok: true };
  } catch (err) {
    console.error('topUpTokens failed', err);
    return { ok: false, error: 'generic' };
  }
}

// Change a company's plan. Also re-applies the per-agent monthly token cap to its
// agents so the new plan takes effect immediately.
export async function setCompanyPlan(companyId: string, tier: PlanTier): Promise<AdminResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  if (!VALID_TIERS.includes(tier)) return { ok: false, error: 'invalid' };

  try {
    await db.company.update({ where: { id: companyId }, data: { plan: tier } });
    await db.agent.updateMany({ where: { companyId }, data: { tokenLimit: agentTokenCap(tier) } });
    await audit(admin.userId, 'admin.plan.change', companyId, { tier });
    revalidatePath(`/admin/companies/${companyId}`);
    revalidatePath('/admin/companies');
    return { ok: true };
  } catch (err) {
    console.error('setCompanyPlan failed', err);
    return { ok: false, error: 'generic' };
  }
}

// Suspend / reactivate / set status. SUSPENDED companies are blocked from the
// public chat + order flow (Company.status checks already exist there).
export async function setCompanyStatus(companyId: string, status: CompanyStatus): Promise<AdminResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  if (!VALID_STATUS.includes(status)) return { ok: false, error: 'invalid' };

  try {
    await db.company.update({ where: { id: companyId }, data: { status } });
    await audit(admin.userId, 'admin.status.change', companyId, { status });
    revalidatePath(`/admin/companies/${companyId}`);
    revalidatePath('/admin/companies');
    return { ok: true };
  } catch (err) {
    console.error('setCompanyStatus failed', err);
    return { ok: false, error: 'generic' };
  }
}

const GB = 1073741824;

// Set a plan's storage ceiling (admin enters GB). Applies to every tenant on that
// plan that has no per-tenant override.
export async function setPlanStorage(tier: PlanTier, gb: number): Promise<AdminResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  if (!VALID_TIERS.includes(tier) || !Number.isFinite(gb) || gb < 0 || gb > 100000) {
    return { ok: false, error: 'invalid' };
  }
  try {
    await db.plan.update({ where: { tier }, data: { maxStorageBytes: BigInt(Math.round(gb * GB)) } });
    await audit(admin.userId, 'admin.plan.storage', null, { tier, gb });
    revalidatePath('/admin/plans');
    return { ok: true };
  } catch (err) {
    console.error('setPlanStorage failed', err);
    return { ok: false, error: 'generic' };
  }
}

// Override one tenant's storage ceiling (GB). null clears it → back to the plan
// default. This is how a premium customer gets a bigger ceiling, no code change.
export async function setCompanyStorageLimit(companyId: string, gb: number | null): Promise<AdminResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };
  let bytes: bigint | null = null;
  if (gb != null) {
    if (!Number.isFinite(gb) || gb < 0 || gb > 100000) return { ok: false, error: 'invalid' };
    bytes = BigInt(Math.round(gb * GB));
  }
  try {
    await db.company.update({ where: { id: companyId }, data: { storageLimitBytes: bytes } });
    await audit(admin.userId, 'admin.company.storage', companyId, { gb });
    revalidatePath(`/admin/companies/${companyId}`);
    revalidatePath('/admin/plans');
    return { ok: true };
  } catch (err) {
    console.error('setCompanyStorageLimit failed', err);
    return { ok: false, error: 'generic' };
  }
}

export interface PlatformSettingsInput {
  siteName: string;
  signupEnabled: boolean;
  trialEnabled: boolean;
  trialDays: number;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  maxCompaniesAllowed: number | null;
  tokenPricePerMillion: number;
}

export async function updatePlatformSettings(raw: PlatformSettingsInput): Promise<AdminResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return { ok: false, error: 'forbidden' };

  const trialDays = Math.min(365, Math.max(0, Math.floor(Number(raw.trialDays) || 0)));
  const maxCompanies =
    raw.maxCompaniesAllowed == null || Number.isNaN(Number(raw.maxCompaniesAllowed))
      ? null
      : Math.max(0, Math.floor(Number(raw.maxCompaniesAllowed)));
  const tokenPrice = Math.min(10000, Math.max(0, Math.round((Number(raw.tokenPricePerMillion) || 0) * 100) / 100));

  try {
    const data = {
      siteName: raw.siteName.trim().slice(0, 120) || 'NX iWork',
      signupEnabled: Boolean(raw.signupEnabled),
      trialEnabled: Boolean(raw.trialEnabled),
      trialDays,
      maintenanceMode: Boolean(raw.maintenanceMode),
      maintenanceMessage: raw.maintenanceMessage?.trim() || null,
      maxCompaniesAllowed: maxCompanies,
      tokenPricePerMillion: tokenPrice,
    };
    await db.platformSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });
    await audit(admin.userId, 'admin.settings.update', null, { signupEnabled: data.signupEnabled, maintenanceMode: data.maintenanceMode });
    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (err) {
    console.error('updatePlatformSettings failed', err);
    return { ok: false, error: 'generic' };
  }
}
