import { z } from 'zod';

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const INDUSTRIES = [
  'retail',
  'saas',
  'consulting',
  'education',
  'healthcare',
  'realestate',
  'food',
  'marketing',
  'finance',
  'manufacturing',
  'logistics',
  'other',
] as const;

export const TEAM_SIZES = ['solo', 'small', 'medium', 'large'] as const;

export const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().max(120).optional().nullable(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(SLUG_REGEX)
    .optional()
    .nullable(),
  industry: z.enum(INDUSTRIES).optional().nullable(),
  teamSize: z.enum(TEAM_SIZES).optional().nullable(),
  mainGoal: z.string().trim().max(2000).optional().nullable(),
  vision: z.string().trim().max(2000).optional().nullable(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
