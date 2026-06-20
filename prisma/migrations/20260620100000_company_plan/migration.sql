-- Plan selected during onboarding. Additive; defaults existing rows to STARTER.
ALTER TABLE "Company" ADD COLUMN "plan" "PlanTier" NOT NULL DEFAULT 'STARTER';
