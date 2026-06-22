-- Add the DEFERRED opportunity stage (مؤجلة). Isolated: the new enum value
-- isn't used in this migration's transaction.
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'DEFERRED';
