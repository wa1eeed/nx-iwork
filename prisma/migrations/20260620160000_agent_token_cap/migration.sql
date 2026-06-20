-- Per-agent monthly token ceiling (managed mode). 0 = unlimited.
ALTER TABLE "Agent" ADD COLUMN "tokenLimit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Agent" ADD COLUMN "periodTokensUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Agent" ADD COLUMN "periodStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
