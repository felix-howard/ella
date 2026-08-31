-- CreateTable
CREATE TABLE "AccountExecutiveAgreementAcceptance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedPdfR2Key" TEXT NOT NULL,
    "pdfSha256" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signerIpAddress" TEXT,
    "signerUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountExecutiveAgreementAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountExecutiveAgreementAcceptance_staffId_idx" ON "AccountExecutiveAgreementAcceptance"("staffId");

-- CreateIndex
CREATE INDEX "AccountExecutiveAgreementAcceptance_organizationId_idx" ON "AccountExecutiveAgreementAcceptance"("organizationId");

-- CreateIndex
CREATE INDEX "AccountExecutiveAgreementAcceptance_version_idx" ON "AccountExecutiveAgreementAcceptance"("version");

-- CreateIndex
CREATE UNIQUE INDEX "AccountExecutiveAgreementAcceptance_staffId_version_key" ON "AccountExecutiveAgreementAcceptance"("staffId", "version");

-- AddForeignKey
ALTER TABLE "AccountExecutiveAgreementAcceptance" ADD CONSTRAINT "AccountExecutiveAgreementAcceptance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountExecutiveAgreementAcceptance" ADD CONSTRAINT "AccountExecutiveAgreementAcceptance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
