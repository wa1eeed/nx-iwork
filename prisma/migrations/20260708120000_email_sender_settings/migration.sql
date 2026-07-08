-- Per-tenant email sender config on BusinessSettings. All mail still sends
-- through the platform's central Resend account from the platform's verified
-- domain; these only brand the display name + route replies, and gate
-- non-transactional (marketing) mail. Additive + backward-compatible.
ALTER TABLE "BusinessSettings" ADD COLUMN "emailSenderName" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "emailReplyTo" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "marketingEmailsEnabled" BOOLEAN NOT NULL DEFAULT false;
