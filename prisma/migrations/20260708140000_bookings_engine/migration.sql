-- Bookings module: deterministic slot-engine foundation. Additive.

-- Service: slot config for bookable services.
ALTER TABLE "Service" ADD COLUMN "durationMin" INTEGER;
ALTER TABLE "Service" ADD COLUMN "bufferMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD COLUMN "maxCapacity" INTEGER NOT NULL DEFAULT 1;

-- Booking: link to the booked service (drives per-service slot capacity).
ALTER TABLE "Booking" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Booking_serviceId_startAt_idx" ON "Booking"("serviceId", "startAt");

-- ServiceAvailability: weekly windows per bookable service (the slot source).
CREATE TABLE "ServiceAvailability" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceAvailability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceAvailability_serviceId_dayOfWeek_startTime_key" ON "ServiceAvailability"("serviceId", "dayOfWeek", "startTime");
CREATE INDEX "ServiceAvailability_companyId_idx" ON "ServiceAvailability"("companyId");
CREATE INDEX "ServiceAvailability_serviceId_idx" ON "ServiceAvailability"("serviceId");
ALTER TABLE "ServiceAvailability" ADD CONSTRAINT "ServiceAvailability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
