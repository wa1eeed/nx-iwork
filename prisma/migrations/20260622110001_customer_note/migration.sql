-- Opportunity activity log: manual notes + logged visits on a CRM record.
-- (Reminders/meetings reuse Task; not stored here.)

-- CreateEnum
CREATE TYPE "CustomerNoteType" AS ENUM ('NOTE', 'VISIT');

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CustomerNoteType" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerNote_customerId_createdAt_idx" ON "CustomerNote"("customerId", "createdAt");
CREATE INDEX "CustomerNote_companyId_idx" ON "CustomerNote"("companyId");

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
