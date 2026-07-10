-- CreateEnum
CREATE TYPE "ClientServiceType" AS ENUM ('INDIVIDUAL_TAX_RETURN', 'BUSINESS_TAX_RETURN', 'BOOKKEEPING', 'PAYROLL', 'TAX_PLANNING', 'IRS_NOTICE', 'AMENDMENT', 'FORM_1099_FILING', 'CONSULTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientServiceStatus" AS ENUM ('ACTIVE', 'WAITING_ON_CLIENT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ClientServiceLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceType" "ClientServiceType" NOT NULL,
    "customServiceName" VARCHAR(100),
    "status" "ClientServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "taxYear" INTEGER,
    "serviceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientServiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientServiceLog_organizationId_clientId_serviceDate_idx" ON "ClientServiceLog"("organizationId", "clientId", "serviceDate");

-- CreateIndex
CREATE INDEX "ClientServiceLog_organizationId_clientId_status_idx" ON "ClientServiceLog"("organizationId", "clientId", "status");

-- CreateIndex
CREATE INDEX "ClientServiceLog_organizationId_serviceType_idx" ON "ClientServiceLog"("organizationId", "serviceType");

-- CreateIndex
CREATE INDEX "ClientServiceLog_createdById_idx" ON "ClientServiceLog"("createdById");

-- AddForeignKey
ALTER TABLE "ClientServiceLog" ADD CONSTRAINT "ClientServiceLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServiceLog" ADD CONSTRAINT "ClientServiceLog_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServiceLog" ADD CONSTRAINT "ClientServiceLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServiceLog" ADD CONSTRAINT "ClientServiceLog_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServiceLog" ADD CONSTRAINT "ClientServiceLog_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
