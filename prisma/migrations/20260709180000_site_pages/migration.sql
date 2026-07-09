-- Owner-authored content pages for the public site (Terms, Instructions, etc.),
-- rendered inside the site chrome and linked from the footer and/or nav.
-- Additive: one new table.

CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentEn" TEXT,
    "showInFooter" BOOLEAN NOT NULL DEFAULT true,
    "showInNav" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SitePage_companyId_slug_key" ON "SitePage"("companyId", "slug");
CREATE INDEX "SitePage_companyId_idx" ON "SitePage"("companyId");

ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
