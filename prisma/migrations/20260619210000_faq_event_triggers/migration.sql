-- Knowledge base (FAQ) + Event Triggers. Additive + safe.

CREATE TYPE "TriggerEvent" AS ENUM ('LEAD_CREATED', 'ORDER_CREATED', 'ORDER_PAID');

CREATE TABLE "FaqItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FaqItem_companyId_idx" ON "FaqItem"("companyId");

CREATE TABLE "EventTrigger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "event" "TriggerEvent" NOT NULL,
    "name" TEXT NOT NULL,
    "taskTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "fireCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventTrigger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventTrigger_companyId_event_idx" ON "EventTrigger"("companyId", "event");
CREATE INDEX "EventTrigger_agentId_idx" ON "EventTrigger"("agentId");

ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTrigger" ADD CONSTRAINT "EventTrigger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTrigger" ADD CONSTRAINT "EventTrigger_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
