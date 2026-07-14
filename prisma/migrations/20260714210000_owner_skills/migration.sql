-- Repurpose the (unused) global Skill model into per-tenant, tool-bundling owner
-- skills: add companyId + a tools grant list, and drop the global key-uniqueness
-- (keys are now scoped per company in app code). Existing rows (if any) become
-- global skills (companyId null). Additive + backward compatible.

ALTER TABLE "Skill" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Skill" ADD COLUMN "tools" TEXT[] NOT NULL DEFAULT '{}';

DROP INDEX IF EXISTS "Skill_key_key";
CREATE INDEX "Skill_companyId_idx" ON "Skill"("companyId");

ALTER TABLE "Skill" ADD CONSTRAINT "Skill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
