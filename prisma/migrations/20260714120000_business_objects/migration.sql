-- Business Objects: owner-defined data types + records. The sector-generality
-- lever — an owner models their own entities (Patient, Vehicle, Contract…) with
-- typed fields stored as JSON, so no migration is needed when a field is added.
-- Additive; scoped by companyId. Agents get generic read/write tools over these.

CREATE TABLE "ObjectType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "icon" TEXT,
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ObjectType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ObjectType_companyId_key_key" ON "ObjectType"("companyId", "key");
CREATE INDEX "ObjectType_companyId_idx" ON "ObjectType"("companyId");

CREATE TABLE "ObjectRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "objectTypeId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ObjectRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ObjectRecord_companyId_idx" ON "ObjectRecord"("companyId");
CREATE INDEX "ObjectRecord_objectTypeId_idx" ON "ObjectRecord"("objectTypeId");
CREATE INDEX "ObjectRecord_companyId_objectTypeId_idx" ON "ObjectRecord"("companyId", "objectTypeId");

ALTER TABLE "ObjectType" ADD CONSTRAINT "ObjectType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObjectRecord" ADD CONSTRAINT "ObjectRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObjectRecord" ADD CONSTRAINT "ObjectRecord_objectTypeId_fkey" FOREIGN KEY ("objectTypeId") REFERENCES "ObjectType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
