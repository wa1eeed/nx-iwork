-- Channels: inbound messaging bots (Telegram now, WhatsApp reserved) that route
-- customer messages to a customer-facing agent through the public-chat path.
-- Token encrypted at rest; `secret` gates the webhook. Additive; companyId-scoped.

CREATE TYPE "ChannelType" AS ENUM ('TELEGRAM', 'WHATSAPP');

CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "agentId" TEXT,
    "token" TEXT NOT NULL,
    "botUsername" TEXT,
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Channel_secret_key" ON "Channel"("secret");
CREATE UNIQUE INDEX "Channel_companyId_type_key" ON "Channel"("companyId", "type");
CREATE INDEX "Channel_companyId_idx" ON "Channel"("companyId");

ALTER TABLE "Channel" ADD CONSTRAINT "Channel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
