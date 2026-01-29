-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocCategory" AS ENUM ('IDENTITY', 'INCOME', 'EXPENSE', 'ASSET', 'EDUCATION', 'HEALTHCARE', 'OTHER');

-- CreateEnum
CREATE TYPE "MagicLinkType" AS ENUM ('PORTAL', 'SCHEDULE_C');

-- CreateEnum
CREATE TYPE "ScheduleCStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'TAX_ENGAGEMENT';

-- DropIndex
DROP INDEX "RawImage_caseId_deletedAt_idx";

-- DropIndex
DROP INDEX "RawImage_deletedAt_idx";

-- AlterTable
ALTER TABLE "MagicLink" ADD COLUMN     "type" "MagicLinkType" NOT NULL DEFAULT 'PORTAL';

-- AlterTable
ALTER TABLE "RawImage" DROP COLUMN "deletedAt",
ADD COLUMN     "category" "DocCategory",
ADD COLUMN     "displayName" VARCHAR(255);

-- CreateTable (must exist before TaxCase references it)
CREATE TABLE "TaxEngagement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'DRAFT',
    "filingStatus" TEXT,
    "hasW2" BOOLEAN NOT NULL DEFAULT false,
    "hasBankAccount" BOOLEAN NOT NULL DEFAULT false,
    "hasInvestments" BOOLEAN NOT NULL DEFAULT false,
    "hasKidsUnder17" BOOLEAN NOT NULL DEFAULT false,
    "numKidsUnder17" INTEGER NOT NULL DEFAULT 0,
    "paysDaycare" BOOLEAN NOT NULL DEFAULT false,
    "hasKids17to24" BOOLEAN NOT NULL DEFAULT false,
    "hasSelfEmployment" BOOLEAN NOT NULL DEFAULT false,
    "hasRentalProperty" BOOLEAN NOT NULL DEFAULT false,
    "businessName" TEXT,
    "ein" TEXT,
    "hasEmployees" BOOLEAN NOT NULL DEFAULT false,
    "hasContractors" BOOLEAN NOT NULL DEFAULT false,
    "has1099K" BOOLEAN NOT NULL DEFAULT false,
    "intakeAnswers" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleCExpense" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "status" "ScheduleCStatus" NOT NULL DEFAULT 'DRAFT',
    "businessName" VARCHAR(200),
    "businessDesc" VARCHAR(500),
    "grossReceipts" DECIMAL(12,2),
    "returns" DECIMAL(12,2),
    "costOfGoods" DECIMAL(12,2),
    "otherIncome" DECIMAL(12,2),
    "advertising" DECIMAL(12,2),
    "carExpense" DECIMAL(12,2),
    "commissions" DECIMAL(12,2),
    "contractLabor" DECIMAL(12,2),
    "depletion" DECIMAL(12,2),
    "depreciation" DECIMAL(12,2),
    "employeeBenefits" DECIMAL(12,2),
    "insurance" DECIMAL(12,2),
    "interestMortgage" DECIMAL(12,2),
    "interestOther" DECIMAL(12,2),
    "legalServices" DECIMAL(12,2),
    "officeExpense" DECIMAL(12,2),
    "pensionPlans" DECIMAL(12,2),
    "rentEquipment" DECIMAL(12,2),
    "rentProperty" DECIMAL(12,2),
    "repairs" DECIMAL(12,2),
    "supplies" DECIMAL(12,2),
    "taxesAndLicenses" DECIMAL(12,2),
    "travel" DECIMAL(12,2),
    "meals" DECIMAL(12,2),
    "utilities" DECIMAL(12,2),
    "wages" DECIMAL(12,2),
    "otherExpenses" DECIMAL(12,2),
    "otherExpensesNotes" VARCHAR(1000),
    "vehicleMiles" INTEGER,
    "vehicleCommuteMiles" INTEGER,
    "vehicleOtherMiles" INTEGER,
    "vehicleDateInService" TIMESTAMP(3),
    "vehicleUsedForCommute" BOOLEAN NOT NULL DEFAULT false,
    "vehicleAnotherAvailable" BOOLEAN NOT NULL DEFAULT false,
    "vehicleEvidenceWritten" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionHistory" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleCExpense_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add engagementId as NULLABLE first
ALTER TABLE "TaxCase" ADD COLUMN "engagementId" TEXT;

-- Backfill: Create TaxEngagement for each existing TaxCase and link them
INSERT INTO "TaxEngagement" ("id", "clientId", "taxYear", "status", "intakeAnswers", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  tc."clientId",
  tc."taxYear",
  'ACTIVE'::"EngagementStatus",
  '{}',
  tc."createdAt",
  tc."updatedAt"
FROM "TaxCase" tc
WHERE tc."engagementId" IS NULL
ON CONFLICT ("clientId", "taxYear") DO NOTHING;

-- Link existing TaxCases to their newly created TaxEngagements
UPDATE "TaxCase" tc
SET "engagementId" = te."id"
FROM "TaxEngagement" te
WHERE tc."clientId" = te."clientId"
  AND tc."taxYear" = te."taxYear"
  AND tc."engagementId" IS NULL;

-- Now make engagementId NOT NULL
ALTER TABLE "TaxCase" ALTER COLUMN "engagementId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "TaxEngagement_clientId_idx" ON "TaxEngagement"("clientId");

-- CreateIndex
CREATE INDEX "TaxEngagement_taxYear_idx" ON "TaxEngagement"("taxYear");

-- CreateIndex
CREATE INDEX "TaxEngagement_status_idx" ON "TaxEngagement"("status");

-- CreateIndex
CREATE INDEX "TaxEngagement_clientId_status_idx" ON "TaxEngagement"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaxEngagement_clientId_taxYear_key" ON "TaxEngagement"("clientId", "taxYear");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleCExpense_taxCaseId_key" ON "ScheduleCExpense"("taxCaseId");

-- CreateIndex
CREATE INDEX "ScheduleCExpense_status_idx" ON "ScheduleCExpense"("status");

-- CreateIndex
CREATE INDEX "ScheduleCExpense_taxCaseId_status_idx" ON "ScheduleCExpense"("taxCaseId", "status");

-- CreateIndex
CREATE INDEX "MagicLink_type_idx" ON "MagicLink"("type");

-- CreateIndex
CREATE INDEX "MagicLink_caseId_type_isActive_idx" ON "MagicLink"("caseId", "type", "isActive");

-- CreateIndex
CREATE INDEX "RawImage_category_idx" ON "RawImage"("category");

-- CreateIndex
CREATE INDEX "TaxCase_engagementId_idx" ON "TaxCase"("engagementId");

-- CreateIndex
CREATE INDEX "TaxCase_engagementId_status_idx" ON "TaxCase"("engagementId", "status");

-- CreateIndex
CREATE INDEX "TaxCase_engagementId_lastActivityAt_idx" ON "TaxCase"("engagementId", "lastActivityAt");

-- AddForeignKey
ALTER TABLE "TaxEngagement" ADD CONSTRAINT "TaxEngagement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCase" ADD CONSTRAINT "TaxCase_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "TaxEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleCExpense" ADD CONSTRAINT "ScheduleCExpense_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

