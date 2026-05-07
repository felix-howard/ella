-- Rename NdaAgreement -> Agreement, generalize for multi-type contracts.
-- Preserves all existing rows by using ALTER TABLE RENAME instead of DROP/CREATE.

-- 1. New AgreementType enum
CREATE TYPE "AgreementType" AS ENUM ('NDA', 'ENGAGEMENT_LETTER', 'SERVICE_AGREEMENT', 'CUSTOM');

-- 2. Rename existing enums
ALTER TYPE "NdaStatus" RENAME TO "AgreementStatus";
ALTER TYPE "NdaDepositStatus" RENAME TO "DepositStatus";

-- 3. Rename table
ALTER TABLE "NdaAgreement" RENAME TO "Agreement";

-- 4. Rename indexes
ALTER INDEX "NdaAgreement_pkey"               RENAME TO "Agreement_pkey";
ALTER INDEX "NdaAgreement_token_key"          RENAME TO "Agreement_token_key";
ALTER INDEX "NdaAgreement_leadId_idx"         RENAME TO "Agreement_leadId_idx";
ALTER INDEX "NdaAgreement_clientId_idx"       RENAME TO "Agreement_clientId_idx";
ALTER INDEX "NdaAgreement_organizationId_idx" RENAME TO "Agreement_organizationId_idx";
ALTER INDEX "NdaAgreement_token_idx"          RENAME TO "Agreement_token_idx";
ALTER INDEX "NdaAgreement_status_idx"         RENAME TO "Agreement_status_idx";
ALTER INDEX "NdaAgreement_leadId_status_idx"  RENAME TO "Agreement_leadId_status_idx";

-- 5. Rename FK constraints
ALTER TABLE "Agreement" RENAME CONSTRAINT "NdaAgreement_leadId_fkey"          TO "Agreement_leadId_fkey";
ALTER TABLE "Agreement" RENAME CONSTRAINT "NdaAgreement_clientId_fkey"        TO "Agreement_clientId_fkey";
ALTER TABLE "Agreement" RENAME CONSTRAINT "NdaAgreement_organizationId_fkey"  TO "Agreement_organizationId_fkey";
ALTER TABLE "Agreement" RENAME CONSTRAINT "NdaAgreement_createdByUserId_fkey" TO "Agreement_createdByUserId_fkey";

-- 6. Add new columns. Backfill existing rows via DEFAULT, then drop the temporary default on title.
ALTER TABLE "Agreement" ADD COLUMN "type"         "AgreementType" NOT NULL DEFAULT 'NDA';
ALTER TABLE "Agreement" ADD COLUMN "title"        VARCHAR(200)    NOT NULL DEFAULT 'NDA';
ALTER TABLE "Agreement" ADD COLUMN "internalNote" TEXT;
ALTER TABLE "Agreement" ADD COLUMN "templateId"   TEXT;

-- title default was only for backfill; new rows must set explicitly
ALTER TABLE "Agreement" ALTER COLUMN "title" DROP DEFAULT;

-- 7. Loosen deposit columns: now optional per-send.
ALTER TABLE "Agreement" ALTER COLUMN "depositStatus" DROP NOT NULL;
ALTER TABLE "Agreement" ALTER COLUMN "depositStatus" DROP DEFAULT;
ALTER TABLE "Agreement" ALTER COLUMN "depositAmount" DROP NOT NULL;
ALTER TABLE "Agreement" ALTER COLUMN "depositAmount" DROP DEFAULT;

-- 8. New indexes for new columns
CREATE INDEX "Agreement_organizationId_type_idx" ON "Agreement"("organizationId", "type");
CREATE INDEX "Agreement_templateId_idx"          ON "Agreement"("templateId");

-- 9. AgreementTemplate table
CREATE TABLE "AgreementTemplate" (
    "id"                   TEXT            NOT NULL,
    "type"                 "AgreementType" NOT NULL,
    "name"                 VARCHAR(200)    NOT NULL,
    "contentHtml"          TEXT            NOT NULL,
    "defaultDepositAmount" DECIMAL(10,2),
    "isArchived"           BOOLEAN         NOT NULL DEFAULT false,
    "organizationId"       TEXT            NOT NULL,
    "createdByUserId"      TEXT            NOT NULL,
    "createdAt"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgreementTemplate_organizationId_type_isArchived_idx"
    ON "AgreementTemplate"("organizationId", "type", "isArchived");

ALTER TABLE "AgreementTemplate"
    ADD CONSTRAINT "AgreementTemplate_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgreementTemplate"
    ADD CONSTRAINT "AgreementTemplate_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "Staff"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 10. FK from Agreement.templateId to AgreementTemplate
ALTER TABLE "Agreement"
    ADD CONSTRAINT "Agreement_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "AgreementTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
