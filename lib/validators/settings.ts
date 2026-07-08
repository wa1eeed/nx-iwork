import { z } from 'zod';
import { INDUSTRIES } from '@/lib/validators/onboarding';

const HEX_COLOR = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export const localizationSchema = z.object({
  primaryLanguage: z.enum(['ar', 'en']),
  currency: z.string().trim().min(1).max(8),
  currencySymbol: z.string().trim().min(1).max(8),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
  showHijriDate: z.boolean(),
  timezone: z.string().trim().min(1).max(60),
  weekStart: z.enum(['sunday', 'monday', 'saturday']),
});

export const brandingSchema = z.object({
  themeMode: z.enum(['dark', 'light', 'system']),
  primaryColor: z.string().regex(HEX_COLOR),
  accentColor: z.string().regex(HEX_COLOR),
});

export const companyInfoSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().max(120).optional().nullable(),
  industry: z.enum(INDUSTRIES).optional().nullable(),
  mainGoal: z.string().trim().max(2000).optional().nullable(),
  vision: z.string().trim().max(2000).optional().nullable(),
  brandVoice: z.string().trim().max(2000).optional().nullable(),
});

// A bare hostname like "shop.acme.com" (no scheme/path). Empty string clears it.
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export const customDomainSchema = z.object({
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .refine((v) => v === '' || HOSTNAME.test(v), 'invalid_domain'),
});

export const escalationSchema = z.object({
  telegramBotToken: z.string().trim().max(120).optional().nullable().or(z.literal('')),
  telegramChatId: z.string().trim().max(60).optional().nullable().or(z.literal('')),
});

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Per-tenant email sender. Sender name brands the "from"; reply-to routes
// replies to the tenant; the toggle gates marketing (non-transactional) mail.
export const emailSchema = z.object({
  emailSenderName: z.string().trim().max(60).optional().nullable(),
  emailReplyTo: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === '' || EMAIL.test(v), 'invalid_email')
    .optional()
    .nullable(),
  marketingEmailsEnabled: z.boolean(),
});

export const storefrontSchema = z.object({
  logo: z.string().trim().url().max(2048).optional().nullable().or(z.literal('')),
  heroTitle: z.string().trim().max(120).optional().nullable(),
  heroTitleEn: z.string().trim().max(120).optional().nullable(),
  heroSubtitle: z.string().trim().max(400).optional().nullable(),
  heroSubtitleEn: z.string().trim().max(400).optional().nullable(),
});

export const apiKeySchema = z.object({
  apiKey: z.string().trim().min(10).max(500),
  // Which AI engine this key belongs to. Defaults to anthropic to match
  // CompanyApiSettings.byokProvider's column default.
  provider: z.enum(['anthropic', 'google']).default('anthropic'),
});

export type LocalizationInput = z.infer<typeof localizationSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
export type CompanyInfoInput = z.infer<typeof companyInfoSchema>;
export type ApiKeyInput = z.infer<typeof apiKeySchema>;
export type CustomDomainInput = z.infer<typeof customDomainSchema>;
export type StorefrontInput = z.infer<typeof storefrontSchema>;
export type EscalationInput = z.infer<typeof escalationSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
