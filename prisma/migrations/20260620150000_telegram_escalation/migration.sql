-- Telegram escalation channel for human-in-the-loop alerts.
ALTER TABLE "BusinessSettings" ADD COLUMN "telegramBotToken" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "telegramChatId" TEXT;
