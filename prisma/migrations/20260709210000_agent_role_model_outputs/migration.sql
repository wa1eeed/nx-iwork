-- Agent role model (3-layer) + the unified outputs hub. Additive:
--  * Agent gains `archetype` (capability-bundle key), `surface` (hard
--    customer/internal scope) and `personaConfig` (structured persona JSON).
--  * New AgentOutput table — the deliverables background agents hand the owner.

-- AlterEnum: a timeline event for deliveries into the outputs hub.
ALTER TYPE "TimelineEventType" ADD VALUE IF NOT EXISTS 'OUTPUT_DELIVERED';

-- CreateEnum
CREATE TYPE "AgentSurface" AS ENUM ('CUSTOMER_FACING', 'INTERNAL');

-- CreateEnum
CREATE TYPE "AgentOutputType" AS ENUM ('MESSAGE', 'REPORT', 'PLAN', 'CONTENT', 'ANALYSIS', 'ACTION_LOG');

-- CreateEnum
CREATE TYPE "AgentOutputStatus" AS ENUM ('DRAFT', 'READY', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "archetype" TEXT DEFAULT 'front_desk',
ADD COLUMN     "surface" "AgentSurface" NOT NULL DEFAULT 'CUSTOMER_FACING',
ADD COLUMN     "personaConfig" JSONB;

-- CreateTable
CREATE TABLE "AgentOutput" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" "AgentOutputType" NOT NULL,
    "status" "AgentOutputStatus" NOT NULL DEFAULT 'READY',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentOutput_companyId_createdAt_idx" ON "AgentOutput"("companyId", "createdAt");
CREATE INDEX "AgentOutput_agentId_createdAt_idx" ON "AgentOutput"("agentId", "createdAt");
CREATE INDEX "AgentOutput_companyId_status_idx" ON "AgentOutput"("companyId", "status");

-- AddForeignKey
ALTER TABLE "AgentOutput" ADD CONSTRAINT "AgentOutput_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentOutput" ADD CONSTRAINT "AgentOutput_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentOutput" ADD CONSTRAINT "AgentOutput_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
