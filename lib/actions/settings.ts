'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { testKey } from '@/lib/byok';
import { sendTelegramTest } from '@/lib/notify/telegram';
import {
  localizationSchema,
  brandingSchema,
  companyInfoSchema,
  apiKeySchema,
  customDomainSchema,
  storefrontSchema,
  escalationSchema,
  type LocalizationInput,
  type BrandingInput,
  type CompanyInfoInput,
  type ApiKeyInput,
  type CustomDomainInput,
  type StorefrontInput,
  type EscalationInput,
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

  const test = await testKey(parsed.data.provider, parsed.data.apiKey);
  if (!test.ok) {
    return { ok: false, error: test.reason, status: test.status };
  }

  const encrypted = encrypt(parsed.data.apiKey);
  await db.companyApiSettings.update({
    where: { companyId },
    data: {
      byokApiKey: encrypted,
      byokProvider: parsed.data.provider,
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

// Connect (or clear) a custom domain. Saving a new value resets verification —
// the owner points DNS at us, then verification/SSL is provisioned out of band.
export async function updateCustomDomain(raw: CustomDomainInput): Promise<Result> {
  const companyId = await authedCompanyId();
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  const parsed = customDomainSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid_domain' };

  const domain = parsed.data.customDomain || null;
  try {
    await db.company.update({
      where: { id: companyId },
      data: {
        customDomain: domain,
        customDomainVerified: false,
        customDomainSslReady: false,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, error: 'domain_taken' };
    }
    throw err;
  }
  revalidatePath('/settings');
  return { ok: true };
}

// Escalation: the owner's Telegram bot for human-in-the-loop alerts.
export async function updateEscalation(raw: EscalationInput): Promise<Result> {
  const companyId = await authedCompanyId();
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  const parsed = escalationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };

  await db.businessSettings.update({
    where: { companyId },
    data: {
      telegramBotToken: parsed.data.telegramBotToken || null,
      telegramChatId: parsed.data.telegramChatId || null,
    },
  });
  revalidatePath('/settings');
  return { ok: true };
}

export async function testEscalation(raw: EscalationInput): Promise<Result> {
  const companyId = await authedCompanyId();
  if (!companyId) return { ok: false, error: 'unauthenticated' };
  const parsed = escalationSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.telegramBotToken || !parsed.data.telegramChatId) {
    return { ok: false, error: 'validation' };
  }
  const ok = await sendTelegramTest(parsed.data.telegramBotToken, parsed.data.telegramChatId);
  return ok ? { ok: true } : { ok: false, error: 'telegram_failed' };
}

// Storefront: logo + hero copy that render on the public landing page.
export async function updateStorefront(raw: StorefrontInput): Promise<Result> {
  const companyId = await authedCompanyId();
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  const parsed = storefrontSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  const company = await db.company.update({
    where: { id: companyId },
    data: { logo: d.logo || null },
    select: { slug: true },
  });
  await db.websiteConfig.update({
    where: { companyId },
    data: {
      heroTitle: d.heroTitle || null,
      heroTitleEn: d.heroTitleEn || null,
      heroSubtitle: d.heroSubtitle || null,
      heroSubtitleEn: d.heroSubtitleEn || null,
    },
  });

  revalidatePath('/settings');
  revalidatePath('/overview');
  revalidatePath(`/${company.slug}`);
  return { ok: true };
}
