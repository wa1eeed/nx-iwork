-- Multi-tenant R2 storage quota: per-plan ceiling + per-tenant usage/override.

-- Plan: storage ceiling per tier (bytes). Seed commercial defaults.
ALTER TABLE "Plan" ADD COLUMN "maxStorageBytes" BIGINT NOT NULL DEFAULT 5368709120; -- 5 GB
UPDATE "Plan" SET "maxStorageBytes" = 1073741824  WHERE "tier" = 'FREE';        -- 1 GB
UPDATE "Plan" SET "maxStorageBytes" = 5368709120  WHERE "tier" = 'STARTER';     -- 5 GB
UPDATE "Plan" SET "maxStorageBytes" = 10737418240 WHERE "tier" = 'GROWTH';      -- 10 GB
UPDATE "Plan" SET "maxStorageBytes" = 21474836480 WHERE "tier" = 'SCALE';       -- 20 GB
UPDATE "Plan" SET "maxStorageBytes" = 53687091200 WHERE "tier" = 'ENTERPRISE';  -- 50 GB

-- Company (tenant): running usage + optional per-tenant override ceiling.
ALTER TABLE "Company" ADD COLUMN "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN "storageLimitBytes" BIGINT;
