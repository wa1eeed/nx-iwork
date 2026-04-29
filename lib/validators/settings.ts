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

export const apiKeySchema = z.object({
  apiKey: z.string().trim().min(10).max(500),
});

export type LocalizationInput = z.infer<typeof localizationSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
export type CompanyInfoInput = z.infer<typeof companyInfoSchema>;
export type ApiKeyInput = z.infer<typeof apiKeySchema>;
