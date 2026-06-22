-- Marketplace: platform-sold services/add-ons (admin catalog) + purchases
-- (bought with the wallet). Distinct from the tenant `Service`.

-- CreateEnum
CREATE TYPE "ServicePurchaseStatus" AS ENUM ('PURCHASED', 'ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "MarketplaceService" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'package',
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePurchase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pricePaid" DECIMAL(10,2) NOT NULL,
    "status" "ServicePurchaseStatus" NOT NULL DEFAULT 'PURCHASED',
    "walletTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceService_active_idx" ON "MarketplaceService"("active");
CREATE INDEX "ServicePurchase_companyId_idx" ON "ServicePurchase"("companyId");
CREATE INDEX "ServicePurchase_serviceId_idx" ON "ServicePurchase"("serviceId");

-- AddForeignKey
ALTER TABLE "ServicePurchase" ADD CONSTRAINT "ServicePurchase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicePurchase" ADD CONSTRAINT "ServicePurchase_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "MarketplaceService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
