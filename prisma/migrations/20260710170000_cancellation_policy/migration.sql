-- Free-text cancellation / booking policy shown to customers. Additive.
ALTER TABLE "BusinessSettings" ADD COLUMN "cancellationPolicy" TEXT;
