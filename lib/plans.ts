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

// Per-agent MONTHLY token ceiling by plan (managed mode). 0 = unlimited. Keeps a
// single runaway agent from draining the shared company token bank.
export const AGENT_TOKEN_CAP: Record<PlanTier, number> = {
  FREE: 50_000,
  STARTER: 100_000,
  GROWTH: 500_000,
  SCALE: 2_000_000,
  ENTERPRISE: 0, // unlimited
};

export function agentTokenCap(plan: PlanTier): number {
  return AGENT_TOKEN_CAP[plan] ?? 0;
}

export function isOnboardingPlan(value: string): value is PlanTier {
  return ONBOARDING_PLANS.some((p) => p.tier === value);
}
