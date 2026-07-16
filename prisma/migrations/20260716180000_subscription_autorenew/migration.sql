-- Subscription auto-renewal (Tap saved-card): toggle + next-attempt cursor +
-- card token/display fields + dunning counters. Additive + defaulted → safe.
ALTER TABLE "Subscription" ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Subscription" ADD COLUMN "renewsAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "cardId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "cardBrand" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "cardLast4" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

-- Existing active subscriptions renew at their current period end.
UPDATE "Subscription" SET "renewsAt" = "currentPeriodEnd" WHERE "status" = 'ACTIVE';

CREATE INDEX "Subscription_status_autoRenew_renewsAt_idx"
  ON "Subscription"("status", "autoRenew", "renewsAt");
