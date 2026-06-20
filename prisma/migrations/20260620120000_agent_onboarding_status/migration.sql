-- New lifecycle state: agents are created ONBOARDING, then flipped to ONLINE
-- (active) once cognitive onboarding completes.
ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'ONBOARDING' BEFORE 'ONLINE';
