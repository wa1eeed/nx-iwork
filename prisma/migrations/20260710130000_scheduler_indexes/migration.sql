-- Composite indexes for the every-minute scheduler scans (runDueTasks /
-- runDueSchedules), which filter on (status, triggerType) and (isActive,
-- nextRunAt) respectively. Additive, non-unique.

CREATE INDEX IF NOT EXISTS "Task_status_triggerType_idx" ON "Task"("status", "triggerType");
CREATE INDEX IF NOT EXISTS "AgentSchedule_isActive_nextRunAt_idx" ON "AgentSchedule"("isActive", "nextRunAt");
