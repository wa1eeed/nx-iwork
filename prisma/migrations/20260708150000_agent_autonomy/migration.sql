-- Agent autonomy: the dial on the two-layer contract's human-in-the-loop —
-- how much the agent does before pausing for the owner. Additive.
CREATE TYPE "AutonomyLevel" AS ENUM ('SUGGEST', 'ASK', 'AUTOPILOT');
ALTER TABLE "Agent" ADD COLUMN "autonomy" "AutonomyLevel" NOT NULL DEFAULT 'ASK';
