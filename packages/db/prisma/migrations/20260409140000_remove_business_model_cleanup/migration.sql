-- Phase 15: Remove Business model and clean up dual FKs
-- DESTRUCTIVE: DROP TABLE "Business", DROP COLUMN "businessId" from 3 tables

-- Step 1: Populate NULL clientId values from Business.clientId before making non-nullable
-- Contractors: copy clientId from their linked Business record
UPDATE "Contractor" c
SET "clientId" = b."clientId"
FROM "Business" b
WHERE c."businessId" = b."id"
  AND c."clientId" IS NULL;

-- ContractorIntakeToken: copy clientId from their linked Business record
UPDATE "ContractorIntakeToken" t
SET "clientId" = b."clientId"
FROM "Business" b
WHERE t."businessId" = b."id"
  AND t."clientId" IS NULL;

-- FilingBatch: copy clientId from their linked Business record
UPDATE "FilingBatch" f
SET "clientId" = b."clientId"
FROM "Business" b
WHERE f."businessId" = b."id"
  AND f."clientId" IS NULL;

-- Step 2: Verify no NULL clientId values remain (safety check)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Contractor" WHERE "clientId" IS NULL) THEN
    RAISE EXCEPTION 'Contractor records with NULL clientId still exist. Aborting migration.';
  END IF;
  IF EXISTS (SELECT 1 FROM "ContractorIntakeToken" WHERE "clientId" IS NULL) THEN
    RAISE EXCEPTION 'ContractorIntakeToken records with NULL clientId still exist. Aborting migration.';
  END IF;
  IF EXISTS (SELECT 1 FROM "FilingBatch" WHERE "clientId" IS NULL) THEN
    RAISE EXCEPTION 'FilingBatch records with NULL clientId still exist. Aborting migration.';
  END IF;
END $$;

-- Step 3: Drop old foreign keys
ALTER TABLE "Business" DROP CONSTRAINT "Business_clientId_fkey";
ALTER TABLE "Contractor" DROP CONSTRAINT "Contractor_businessId_fkey";
ALTER TABLE "Contractor" DROP CONSTRAINT "Contractor_clientId_fkey";
ALTER TABLE "ContractorIntakeToken" DROP CONSTRAINT "ContractorIntakeToken_businessId_fkey";
ALTER TABLE "ContractorIntakeToken" DROP CONSTRAINT "ContractorIntakeToken_clientId_fkey";
ALTER TABLE "FilingBatch" DROP CONSTRAINT "FilingBatch_businessId_fkey";
ALTER TABLE "FilingBatch" DROP CONSTRAINT "FilingBatch_clientId_fkey";

-- Step 4: Drop old indexes
DROP INDEX "Contractor_businessId_idx";
DROP INDEX "ContractorIntakeToken_businessId_isActive_idx";
DROP INDEX "FilingBatch_businessId_idx";

-- Step 5: Drop businessId columns and make clientId required
ALTER TABLE "Contractor" DROP COLUMN "businessId",
ALTER COLUMN "clientId" SET NOT NULL;

ALTER TABLE "ContractorIntakeToken" DROP COLUMN "businessId",
ALTER COLUMN "clientId" SET NOT NULL;

ALTER TABLE "FilingBatch" DROP COLUMN "businessId",
ALTER COLUMN "clientId" SET NOT NULL;

-- Step 6: Drop Business table
DROP TABLE "Business";

-- Step 7: Add new foreign keys with Cascade delete
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractorIntakeToken" ADD CONSTRAINT "ContractorIntakeToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FilingBatch" ADD CONSTRAINT "FilingBatch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
