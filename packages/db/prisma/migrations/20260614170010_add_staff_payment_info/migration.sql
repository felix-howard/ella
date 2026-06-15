-- CreateEnum
CREATE TYPE "StaffPaymentCountry" AS ENUM ('US', 'VN', 'PH');

-- CreateTable
CREATE TABLE "StaffPaymentInfo" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "country" "StaffPaymentCountry" NOT NULL,
    "nameOnAccount" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountNumberLast4" TEXT NOT NULL,
    "routingNumberEncrypted" TEXT,
    "routingNumberLast4" TEXT,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPaymentInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffPaymentInfo_organizationId_staffId_idx" ON "StaffPaymentInfo"("organizationId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPaymentInfo_staffId_country_key" ON "StaffPaymentInfo"("staffId", "country");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPaymentInfo_id_organizationId_key" ON "StaffPaymentInfo"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "StaffPaymentInfo" ADD CONSTRAINT "StaffPaymentInfo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPaymentInfo" ADD CONSTRAINT "StaffPaymentInfo_staffId_organizationId_fkey" FOREIGN KEY ("staffId", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPaymentInfo" ADD CONSTRAINT "StaffPaymentInfo_updatedByStaffId_organizationId_fkey" FOREIGN KEY ("updatedByStaffId", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
