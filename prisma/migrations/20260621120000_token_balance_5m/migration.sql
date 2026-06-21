-- Token bank fix: the 100k starter grant ran out after a handful of
-- gemini-2.5-flash chats (thinking tokens). Raise the default to 5,000,000 and
-- restore any account currently below that (test phase) so no one stays locked.
ALTER TABLE "Company" ALTER COLUMN "tokenBalance" SET DEFAULT 5000000;
UPDATE "Company" SET "tokenBalance" = 5000000 WHERE "tokenBalance" < 5000000;
