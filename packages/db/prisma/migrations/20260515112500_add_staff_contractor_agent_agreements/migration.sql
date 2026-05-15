-- Add staff contractor-agent compliance flag.
ALTER TABLE "Staff"
  ADD COLUMN IF NOT EXISTS "isContractorAgent" BOOLEAN NOT NULL DEFAULT false;

-- Store versioned Independent Contractor agreement acceptances for staff.
CREATE TABLE IF NOT EXISTS "ContractorAgreementAcceptance" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "signedPdfR2Key" TEXT NOT NULL,
  "sourceTemplateR2Key" TEXT,
  "pdfSha256" TEXT NOT NULL,
  "signerName" TEXT NOT NULL,
  "signerEmail" TEXT NOT NULL,
  "signerIpAddress" TEXT,
  "signerUserAgent" TEXT,
  "firmSignerName" TEXT NOT NULL,
  "firmSignerEmail" TEXT NOT NULL,
  "firmSignerTitle" TEXT,
  "firmSignaturePngKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContractorAgreementAcceptance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractorAgreementAcceptance_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContractorAgreementAcceptance_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContractorAgreementAcceptance_staffId_version_key"
  ON "ContractorAgreementAcceptance"("staffId", "version");

CREATE INDEX IF NOT EXISTS "ContractorAgreementAcceptance_staffId_idx"
  ON "ContractorAgreementAcceptance"("staffId");

CREATE INDEX IF NOT EXISTS "ContractorAgreementAcceptance_organizationId_idx"
  ON "ContractorAgreementAcceptance"("organizationId");

CREATE INDEX IF NOT EXISTS "ContractorAgreementAcceptance_version_idx"
  ON "ContractorAgreementAcceptance"("version");
