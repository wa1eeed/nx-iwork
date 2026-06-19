-- CRM (Customer/Lead) + flexible customFields on catalog + unified Task kinds.
-- Hand-authored to match Prisma naming; apply with `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'INTERESTED', 'NEGOTIATING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('AGENT_TASK', 'APPOINTMENT', 'REMINDER');

-- AlterTable: flexible attributes on catalog
ALTER TABLE "Service" ADD COLUMN "customFields" JSONB;
ALTER TABLE "Product" ADD COLUMN "customFields" JSONB;

-- AlterTable: Order links to a persistent CRM record (optional)
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;

-- AlterTable: Task becomes a unified list/calendar entity
ALTER TABLE "Task" ALTER COLUMN "agentId" DROP NOT NULL;
ALTER TABLE "Task" ADD COLUMN "kind" "TaskKind" NOT NULL DEFAULT 'AGENT_TASK';
ALTER TABLE "Task" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Task" ADD COLUMN "startAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "endAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "customFields" JSONB;

-- agentId FK was ON DELETE CASCADE; appointments/reminders must survive an
-- agent deletion, so switch to SET NULL.
ALTER TABLE "Task" DROP CONSTRAINT "Task_agentId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Customer (CRM)
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "notes" TEXT,
    "customFields" JSONB,
    "assignedAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_companyId_status_idx" ON "Customer"("companyId", "status");
CREATE INDEX "Customer_assignedAgentId_idx" ON "Customer"("assignedAgentId");
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex: new Task indexes
CREATE INDEX "Task_companyId_kind_idx" ON "Task"("companyId", "kind");
CREATE INDEX "Task_customerId_idx" ON "Task"("customerId");
CREATE INDEX "Task_startAt_idx" ON "Task"("startAt");

-- CreateIndex: new Order index
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
