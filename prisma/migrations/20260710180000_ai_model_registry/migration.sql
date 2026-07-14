-- Provider-agnostic AI model registry (super-admin managed). Adding a new model
-- becomes a data row instead of a code change. Agents can point at a concrete
-- model; a null falls back to the capability tier. Additive.

CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tier" "ClaudeModel" NOT NULL DEFAULT 'SONNET',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiModel_provider_modelId_key" ON "AiModel"("provider", "modelId");
CREATE INDEX "AiModel_enabled_idx" ON "AiModel"("enabled");

ALTER TABLE "Agent" ADD COLUMN "aiModelId" TEXT;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the models the platform ships with today (managed Vertex/Gemini). New
-- models are added from the super-admin Models page — no migration needed.
INSERT INTO "AiModel" ("id", "provider", "modelId", "label", "tier", "enabled", "isDefault", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid()::text, 'vertex', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'SONNET', true, true, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'vertex', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 'OPUS', true, false, 20, CURRENT_TIMESTAMP)
ON CONFLICT ("provider", "modelId") DO NOTHING;
