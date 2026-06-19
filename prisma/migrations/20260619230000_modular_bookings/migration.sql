-- Modular architecture: per-company module flags + Bookings module. Additive.

ALTER TABLE "Company" ADD COLUMN "hasEcommerce" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Company" ADD COLUMN "hasServices" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Company" ADD COLUMN "hasBookings" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Booking_companyId_startAt_idx" ON "Booking"("companyId", "startAt");
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
