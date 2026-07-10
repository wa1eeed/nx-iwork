-- Task sequencing for multi-agent chains: a task can wait for other tasks to
-- finish before it runs. Additive — one nullable-defaulted array column.

ALTER TABLE "Task" ADD COLUMN "dependsOn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
