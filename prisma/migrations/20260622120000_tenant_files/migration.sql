-- File: lightweight metadata registry for tenant uploads (references, not bytes).

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "File_key_key" ON "File"("key");
CREATE INDEX "File_companyId_createdAt_idx" ON "File"("companyId", "createdAt");

-- Row-Level Security (same permissive-until-pinned pattern as the other tenant
-- tables — see 20260620170000_rls_policies). Enforced only inside a withTenant tx.
ALTER TABLE "File" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "File" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "File";
CREATE POLICY tenant_isolation ON "File"
  USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.current_tenant_id', true) = ''
    OR "companyId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.current_tenant_id', true) = ''
    OR "companyId" = current_setting('app.current_tenant_id', true)
  );
