-- Booking-first: departments double as customer-facing "clinics" / service
-- categories on the landing page, and services group under them.
-- Additive: nullable/defaulted columns only.

ALTER TABLE "Department"
    ADD COLUMN "landingVisible" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "tagline" TEXT,
    ADD COLUMN "landingOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Service"
    ADD COLUMN "allowWaitlist" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "departmentId" TEXT;

CREATE INDEX "Service_departmentId_idx" ON "Service"("departmentId");

ALTER TABLE "Service" ADD CONSTRAINT "Service_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
