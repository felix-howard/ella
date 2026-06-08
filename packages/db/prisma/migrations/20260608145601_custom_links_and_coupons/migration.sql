-- AlterTable
ALTER TABLE "PaymentQuote" ADD COLUMN     "allowPromotionCodes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "appliedCouponId" TEXT,
ADD COLUMN     "billingInterval" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'calculator';

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "discountType" TEXT NOT NULL,
    "percentOff" INTEGER,
    "amountOffCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "duration" TEXT NOT NULL DEFAULT 'once',
    "durationInMonths" INTEGER,
    "maxRedemptions" INTEGER,
    "redeemBy" TIMESTAMP(3),
    "stripeCouponId" TEXT,
    "stripePromotionCodeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "timesRedeemed" INTEGER NOT NULL DEFAULT 0,
    "createdByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Coupon_organizationId_active_idx" ON "Coupon"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_organizationId_code_key" ON "Coupon"("organizationId", "code");

-- CreateIndex
CREATE INDEX "PaymentQuote_appliedCouponId_idx" ON "PaymentQuote"("appliedCouponId");

-- AddForeignKey
ALTER TABLE "PaymentQuote" ADD CONSTRAINT "PaymentQuote_appliedCouponId_fkey" FOREIGN KEY ("appliedCouponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
