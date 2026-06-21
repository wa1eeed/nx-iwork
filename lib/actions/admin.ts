'use server';

import { revalidatePath } from 'next/cache';
import type { CompanyStatus, PlanTier, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/admin';
import { agentTokenCap } from '@/lib/plans';

export type AdminResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | 'generic' };

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
