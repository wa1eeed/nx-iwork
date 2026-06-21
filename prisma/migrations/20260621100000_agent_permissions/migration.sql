-- Explicit per-agent function-calling permissions (allow-list of tool ids).
-- Empty array = all module-enabled tools (backward compatible for existing agents).
ALTER TABLE "Agent" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT '{}';
