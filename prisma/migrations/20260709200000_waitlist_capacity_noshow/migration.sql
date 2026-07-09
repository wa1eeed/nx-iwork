-- Waitlist capacity per service + NO_SHOW booking status (frees a slot and
-- promotes the oldest waitlisted booking). Additive.

ALTER TABLE "Service" ADD COLUMN "waitlistCapacity" INTEGER NOT NULL DEFAULT 0;

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';
