-- Guardrails: owner governance over the autonomous workforce.
-- Additive, all with safe defaults so existing tenants keep working unchanged.
ALTER TABLE "Company"
  ADD COLUMN "automationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireApprovalForSensitive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireMessageReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "spendApprovalCapEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "spendApprovalCapSar" INTEGER NOT NULL DEFAULT 500;
