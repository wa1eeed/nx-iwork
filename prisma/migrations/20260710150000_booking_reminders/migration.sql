-- Owner-controllable booking reminders: confirmation on booking + a reminder N
-- hours before the appointment. Additive.

ALTER TABLE "BusinessSettings"
  ADD COLUMN "bookingConfirmationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "bookingReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "bookingReminderHoursBefore" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "Booking" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

CREATE INDEX "Booking_companyId_status_reminderSentAt_idx" ON "Booking"("companyId", "status", "reminderSentAt");
