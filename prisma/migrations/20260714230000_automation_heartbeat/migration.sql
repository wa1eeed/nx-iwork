-- Automation heartbeat: the every-minute cron stamps these so the dashboard can
-- prove autonomous execution is alive (and warn the owner if it stops). Additive.

ALTER TABLE "PlatformSettings" ADD COLUMN "lastCronRunAt" TIMESTAMP(3);
ALTER TABLE "PlatformSettings" ADD COLUMN "lastCronSummary" JSONB;
