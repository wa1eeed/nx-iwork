-- Agent Job Description "constitution": the agent's mandate/charter (what it
-- does + boundaries), distinct from persona. Governs its decisions and is
-- injected into the system prompt. Additive + nullable.
ALTER TABLE "Agent" ADD COLUMN "jobDescription" TEXT;
