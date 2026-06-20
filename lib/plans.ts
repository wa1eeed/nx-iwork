import type { PlanTier } from '@prisma/client';

// The tiers selectable during onboarding (subset of the full PlanTier enum).
export type OnboardingTier = Extract<PlanTier, 'STARTER' | 'GROWTH' | 'SCALE'>;

// Display-only plan catalog for onboarding. Selection is recorded on the company
// (Company.plan); real billing (Tap) is wired later, so prices here are
// informational and everyone starts on managed token credits.
export interface OnboardingPlan {
  tier: OnboardingTier;
  /** SAR / month. 0 = free. */
  priceMonthly: number;
  recommended?: boolean;
  /** i18n message keys under onboarding.plans.features.* */
  featureKeys: string[];
}

export const ONBOARDING_PLANS: OnboardingPlan[] = [
  {
    tier: 'STARTER',
    priceMonthly: 0,
    featureKeys: ['agents2', 'creditsTrial', 'landingPage', 'crm'],
  },
  {
    tier: 'GROWTH',
    priceMonthly: 99,
    recommended: true,
    featureKeys: ['agents10', 'creditsMonthly', 'customDomain', 'allModules', 'support'],
  },
  {
    tier: 'SCALE',
    priceMonthly: 299,
    featureKeys: ['agentsUnlimited', 'creditsHigh', 'customBranding', 'apiAccess', 'priority'],
  },
];

export const DEFAULT_PLAN: OnboardingTier = 'STARTER';

export function isOnboardingPlan(value: string): value is PlanTier {
  return ONBOARDING_PLANS.some((p) => p.tier === value);
}
