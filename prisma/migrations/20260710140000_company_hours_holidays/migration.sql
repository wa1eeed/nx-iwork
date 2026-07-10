-- Company-wide default opening hours (inherited by services with no windows of
-- their own) + holiday closures. Additive.

CREATE TABLE "CompanyHours" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyHours_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyHours_companyId_dayOfWeek_startTime_key" ON "CompanyHours"("companyId", "dayOfWeek", "startTime");
CREATE INDEX "CompanyHours_companyId_idx" ON "CompanyHours"("companyId");
ALTER TABLE "CompanyHours" ADD CONSTRAINT "CompanyHours_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Holiday_companyId_date_key" ON "Holiday"("companyId", "date");
CREATE INDEX "Holiday_companyId_idx" ON "Holiday"("companyId");
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
