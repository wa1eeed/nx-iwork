-- Per-agent governance overrides. Nullable = inherit the company-wide guardrail
-- (Company.requireApprovalForSensitive / requireMessageReview / spendApprovalCapSar).
-- Additive + nullable → safe, no backfill, no default behavior change.
ALTER TABLE "Agent" ADD COLUMN "requireApprovalForSensitive" BOOLEAN;
ALTER TABLE "Agent" ADD COLUMN "requireMessageReview" BOOLEAN;
ALTER TABLE "Agent" ADD COLUMN "spendApprovalCapSar" INTEGER;
