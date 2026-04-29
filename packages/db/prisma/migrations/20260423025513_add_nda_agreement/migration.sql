-- CreateEnum
CREATE TYPE "NdaStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'EXPIRED', 'VOIDED');

-- CreateEnum
CREATE TYPE "NdaDepositStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'FORFEITED');

-- CreateTable
CREATE TABLE "NdaAgreement" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "status" "NdaStatus" NOT NULL DEFAULT 'DRAFT',
    "depositStatus" "NdaDepositStatus" NOT NULL DEFAULT 'PENDING',
    "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 300.00,
    "depositPaidAt" TIMESTAMP(3),
    "depositResolvedAt" TIMESTAMP(3),
    "depositNote" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "signedAt" TIMESTAMP(3),
    "signerName" TEXT,
    "signerEmail" TEXT,
    "signerIpAddress" TEXT,
    "signerUserAgent" TEXT,
    "signaturePngKey" TEXT,
    "signedPdfKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NdaAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NdaAgreement_token_key" ON "NdaAgreement"("token");

-- CreateIndex
CREATE INDEX "NdaAgreement_leadId_idx" ON "NdaAgreement"("leadId");

-- CreateIndex
CREATE INDEX "NdaAgreement_organizationId_idx" ON "NdaAgreement"("organizationId");

-- CreateIndex
CREATE INDEX "NdaAgreement_token_idx" ON "NdaAgreement"("token");

-- CreateIndex
CREATE INDEX "NdaAgreement_status_idx" ON "NdaAgreement"("status");

-- CreateIndex
CREATE INDEX "NdaAgreement_leadId_status_idx" ON "NdaAgreement"("leadId", "status");

-- AddForeignKey
ALTER TABLE "NdaAgreement" ADD CONSTRAINT "NdaAgreement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdaAgreement" ADD CONSTRAINT "NdaAgreement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdaAgreement" ADD CONSTRAINT "NdaAgreement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
