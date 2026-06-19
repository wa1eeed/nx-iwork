-- Managed-mode token bank: prepaid AI credits per company.
-- Additive + safe (DEFAULT backfills existing rows). Ignored in BYOK mode.
ALTER TABLE "Company" ADD COLUMN "tokenBalance" INTEGER NOT NULL DEFAULT 100000;
