-- Human-readable per-tenant reference codes (CUS-001, PRD-001, ...). Additive.
ALTER TABLE "Customer" ADD COLUMN "ref" TEXT;
ALTER TABLE "Agent" ADD COLUMN "ref" TEXT;
ALTER TABLE "Product" ADD COLUMN "ref" TEXT;
ALTER TABLE "Service" ADD COLUMN "ref" TEXT;
ALTER TABLE "Booking" ADD COLUMN "ref" TEXT;

CREATE TABLE "RefCounter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RefCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefCounter_companyId_entity_key" ON "RefCounter"("companyId", "entity");
ALTER TABLE "RefCounter" ADD CONSTRAINT "RefCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill: stamp existing rows with per-tenant sequential codes (ordered by
-- creation), then seed each RefCounter to the highest value used so the
-- runtime allocator continues from there without ever colliding.
-- ---------------------------------------------------------------------------

-- Customer → CUS-NNN
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS rn
  FROM "Customer"
)
UPDATE "Customer" t SET "ref" = 'CUS-' || LPAD(o.rn::text, 3, '0') FROM ordered o WHERE t."id" = o."id";

-- Agent → AGT-NNN
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS rn
  FROM "Agent"
)
UPDATE "Agent" t SET "ref" = 'AGT-' || LPAD(o.rn::text, 3, '0') FROM ordered o WHERE t."id" = o."id";

-- Product → PRD-NNN
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS rn
  FROM "Product"
)
UPDATE "Product" t SET "ref" = 'PRD-' || LPAD(o.rn::text, 3, '0') FROM ordered o WHERE t."id" = o."id";

-- Service → SRV-NNN
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS rn
  FROM "Service"
)
UPDATE "Service" t SET "ref" = 'SRV-' || LPAD(o.rn::text, 3, '0') FROM ordered o WHERE t."id" = o."id";

-- Booking → BKG-NNN
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS rn
  FROM "Booking"
)
UPDATE "Booking" t SET "ref" = 'BKG-' || LPAD(o.rn::text, 3, '0') FROM ordered o WHERE t."id" = o."id";

-- Seed counters from the rows just stamped (one row per company+entity).
INSERT INTO "RefCounter" ("id", "companyId", "entity", "value")
SELECT gen_random_uuid()::text, "companyId", 'customer', COUNT(*) FROM "Customer" GROUP BY "companyId"
UNION ALL
SELECT gen_random_uuid()::text, "companyId", 'agent',    COUNT(*) FROM "Agent"    GROUP BY "companyId"
UNION ALL
SELECT gen_random_uuid()::text, "companyId", 'product',  COUNT(*) FROM "Product"  GROUP BY "companyId"
UNION ALL
SELECT gen_random_uuid()::text, "companyId", 'service',  COUNT(*) FROM "Service"  GROUP BY "companyId"
UNION ALL
SELECT gen_random_uuid()::text, "companyId", 'booking',  COUNT(*) FROM "Booking"  GROUP BY "companyId";
