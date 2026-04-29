'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { testAnthropicKey } from '@/lib/byok';
import {
  localizationSchema,
  brandingSchema,
  companyInfoSchema,
  apiKeySchema,
  type LocalizationInput,
  type BrandingInput,
  type CompanyInfoInput,
  type ApiKeyInput,
} from '@/lib/validators/settings';

type Result<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; status?: number };

async function authedCompanyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });
  return user?.companyId ?? null;
}

export async function updateLocalization(
  raw: LocalizationInput
): Promise<Result> {
  const companyId = await authedCompanyId();
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  const parsed = localizationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };

  await db.businessSettings.update({
    where: { companyId },
    data: parsed.data,
  });
  revalidatePath('/settings');
  return { ok: true };
}

export async function updateBranding(raw: BrandingInput): Promise<Result> {
  const companyId = await authedCompanyId();
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  const parsed = brandingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };

  await db.businessSettings.update({
    where: { companyId },
    data: parsed.data,
  });
  revalidatePath('/settings');
  return { ok: true };
}

export async function updateCompanyInfo(
  raw: CompanyInfoInput
): Promise<Result> {
  const companyId = await authedCompanyId();
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  const parsed = companyInfoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };

  await db.company.update({
    where: { id: companyId },
    data: {
      name: parsed.data.name,
      nameEn: parsed.data.nameEn ?? null,
      industry: parsed.data.industry ?? null,
      mainGoal: parsed.data.mainGoal ?? null,
      vision: parsed.data.vision ?? null,
      brandVoice: parsed.data.brandVoice ?? null,
    },
  });
  revalidatePath('/settings');
  return { ok: true };
}

// Save flow: validate format → call Anthropic to confirm the key works → only
// then persist (encrypted). Bad keys never make it to the DB, which means
// byokVerified can be trusted to mean "this key worked at least once."
export async function saveApiKey(raw: ApiKeyInput): Promise<Result> {
  const companyId = await authedCompanyId();
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  const parsed = apiKeySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid_format' };

  const test = await testAnthropicKey(parsed.data.apiKey);
  if (!test.ok) {
    return { ok: false, error: test.reason, status: test.status };
  }

  const encrypted = encrypt(parsed.data.apiKey);
  await db.companyApiSettings.update({
    where: { companyId },
    data: {
      byokApiKey: encrypted,
      byokVerified: true,
      byokLastTest: new Date(),
    },
  });
  revalidatePath('/settings');
  revalidatePath('/overview');
  return { ok: true };
}

export async function removeApiKey(): Promise<Result> {
  const companyId = await authedCompanyId();
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  await db.companyApiSettings.update({
    where: { companyId },
    data: {
      byokApiKey: null,
      byokVerified: false,
      byokLastTest: null,
    },
  });
  revalidatePath('/settings');
  revalidatePath('/overview');
  return { ok: true };
}
