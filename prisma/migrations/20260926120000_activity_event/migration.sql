-- Phase 0 / PR-1: Unified ActivityEvent + dual-write triggers.
--
-- Additive only. No existing table/column is altered. Two AFTER INSERT triggers
-- dual-write into ActivityEvent from the current writers:
--   * AuditLog     -> HUMAN (or SYSTEM if userId is null)
--   * TimelineEvent -> AGENT (or SYSTEM if agentId is null)
--
-- Four approved refinements are implemented here:
--   1. Fail-open is NOT silent: the exception path emits RAISE WARNING with only
--      non-sensitive identifiers (source + source row id + SQLERRM). The business
--      INSERT/transaction still commits (the handler opens a subtransaction, so a
--      mapping failure rolls back only the ActivityEvent insert).
--   2. Actor attribution is verified against the real writers (see spec §3): every
--      current TimelineEvent writer sets agentId, and AuditLog's sole writer sets
--      userId; the SYSTEM branch is a correctness fallback. We do NOT manufacture
--      HUMAN attribution for timeline rows that carry no human actor (e.g.
--      APPROVAL_RESOLVED records the subject agentId, not the resolving human —
--      documented limitation; corrected at source by later PRs).
--   3. Normal duplicates use ON CONFLICT (source, sourceId) DO NOTHING; the
--      exception handler therefore represents GENUINE logging failures only.
--   4. occurredAt preserves the source row's createdAt; recordedAt is the
--      ActivityEvent insertion time (they diverge on future backfills).

-- CreateEnum
CREATE TYPE "ActivityActorType" AS ENUM ('HUMAN', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('AUDIT_LOG', 'TIMELINE', 'GATEWAY');

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "source" "ActivitySource" NOT NULL,
    "sourceId" TEXT,
    "companyId" TEXT,
    "actorType" "ActivityActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT,
    "goalId" TEXT,
    "taskId" TEXT,
    "executionId" TEXT,
    "sessionId" TEXT,
    "contractId" TEXT,
    "decision" TEXT,
    "cost" JSONB,
    "outcome" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityEvent_source_sourceId_key" ON "ActivityEvent"("source", "sourceId");

-- CreateIndex
CREATE INDEX "ActivityEvent_companyId_occurredAt_idx" ON "ActivityEvent"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorType_actorId_idx" ON "ActivityEvent"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "ActivityEvent_entityType_entityId_idx" ON "ActivityEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityEvent_taskId_idx" ON "ActivityEvent"("taskId");

-- CreateIndex
CREATE INDEX "ActivityEvent_executionId_idx" ON "ActivityEvent"("executionId");

-- ============================================================================
-- Dual-write trigger functions (raw SQL — Prisma does not manage triggers).
-- id is generated with gen_random_uuid() (core in PG13+/pgcrypto, already
-- enabled) because Prisma's cuid() default is client-side and does not apply to
-- these direct inserts. recordedAt uses its column default.
-- ============================================================================

-- AuditLog -> ActivityEvent (HUMAN / SYSTEM)
CREATE OR REPLACE FUNCTION activity_from_auditlog() RETURNS trigger AS $$
BEGIN
  BEGIN
    INSERT INTO "ActivityEvent" (
      "id", "source", "sourceId", "companyId",
      "actorType", "actorId", "action", "entityType", "entityId",
      "ipAddress", "userAgent", "metadata", "occurredAt"
    ) VALUES (
      gen_random_uuid()::text,
      'AUDIT_LOG', NEW."id", NEW."companyId",
      (CASE WHEN NEW."userId" IS NOT NULL THEN 'HUMAN' ELSE 'SYSTEM' END)::"ActivityActorType",
      NEW."userId", NEW."action", NEW."entityType", NEW."entityId",
      NEW."ipAddress", NEW."userAgent", NEW."metadata", NEW."createdAt"
    )
    ON CONFLICT ("source", "sourceId") DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Refinement 1: never silent, never sensitive, never blocking.
    RAISE WARNING 'ActivityEvent dual-write failed [source=AUDIT_LOG sourceId=%]: %', NEW."id", SQLERRM;
  END;
  RETURN NULL; -- AFTER trigger: return value ignored
END;
$$ LANGUAGE plpgsql;

-- TimelineEvent -> ActivityEvent (AGENT / SYSTEM)
CREATE OR REPLACE FUNCTION activity_from_timeline() RETURNS trigger AS $$
BEGIN
  BEGIN
    INSERT INTO "ActivityEvent" (
      "id", "source", "sourceId", "companyId",
      "actorType", "actorId", "action", "summary", "metadata", "occurredAt",
      -- best-effort lineage from metadata (usually null today; do not manufacture)
      "taskId", "goalId", "executionId", "sessionId", "contractId"
    ) VALUES (
      gen_random_uuid()::text,
      'TIMELINE', NEW."id", NEW."companyId",
      (CASE WHEN NEW."agentId" IS NOT NULL THEN 'AGENT' ELSE 'SYSTEM' END)::"ActivityActorType",
      NEW."agentId", NEW."type"::text,
      NEW."title" || COALESCE(E'\n' || NEW."description", ''),
      NEW."metadata", NEW."createdAt",
      NEW."metadata"->>'taskId', NEW."metadata"->>'goalId',
      NEW."metadata"->>'executionId', NEW."metadata"->>'sessionId',
      NEW."metadata"->>'contractId'
    )
    ON CONFLICT ("source", "sourceId") DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ActivityEvent dual-write failed [source=TIMELINE sourceId=%]: %', NEW."id", SQLERRM;
  END;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trg_activity_from_auditlog
  AFTER INSERT ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION activity_from_auditlog();

CREATE TRIGGER trg_activity_from_timeline
  AFTER INSERT ON "TimelineEvent"
  FOR EACH ROW EXECUTE FUNCTION activity_from_timeline();
