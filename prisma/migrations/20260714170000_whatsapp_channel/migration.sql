-- WhatsApp Cloud API fields on Channel. Official Meta API (stateless: webhooks +
-- REST) — chosen over unofficial QR bridges because it scales horizontally on
-- Cloud Run and across many tenants. Additive; Telegram rows leave these null.

ALTER TABLE "Channel" ADD COLUMN "phoneNumberId" TEXT;
ALTER TABLE "Channel" ADD COLUMN "wabaId" TEXT;
CREATE UNIQUE INDEX "Channel_phoneNumberId_key" ON "Channel"("phoneNumberId");
