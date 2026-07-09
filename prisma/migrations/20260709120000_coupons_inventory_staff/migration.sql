-- Discount coupons, consumables/raw-materials inventory, and staff commissions.
-- Additive: three new tables + nullable columns on Order/Booking.

CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "CouponScope" AS ENUM ('ALL', 'PRODUCTS', 'SERVICES', 'BOOKINGS');
CREATE TYPE "CommissionType" AS ENUM ('PERCENT_SALES', 'FIXED_PER_ORDER', 'TARGET_BONUS');

CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL DEFAULT 'PERCENT',
    "value" DECIMAL(10,2) NOT NULL,
    "scope" "CouponScope" NOT NULL DEFAULT 'ALL',
    "minSubtotal" DECIMAL(10,2),
    "maxRedemptions" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Coupon_companyId_code_key" ON "Coupon"("companyId", "code");
CREATE INDEX "Coupon_companyId_idx" ON "Coupon"("companyId");

CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "quantityOnHand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2),
    "supplier" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InventoryItem_companyId_idx" ON "InventoryItem"("companyId");

CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ref" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENT_SALES',
    "commissionRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthlyTarget" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StaffMember_companyId_idx" ON "StaffMember"("companyId");

-- Order: coupon discount + staff attribution
ALTER TABLE "Order"
    ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "couponId" TEXT,
    ADD COLUMN "staffMemberId" TEXT;
CREATE INDEX "Order_staffMemberId_idx" ON "Order"("staffMemberId");

-- Booking: staff attribution
ALTER TABLE "Booking" ADD COLUMN "staffMemberId" TEXT;
CREATE INDEX "Booking_staffMemberId_idx" ON "Booking"("staffMemberId");

-- Foreign keys
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
