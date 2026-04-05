-- Phase 4: TaxBandits cleanup migration
-- Remove old Tax1099 fields and add taxbanditsSubmissionId to Form1099NEC

-- Step 1: Migrate existing data from old columns to new columns (preserve data)
UPDATE "Form1099NEC"
SET "taxbanditsRecordId" = CAST("tax1099FormId" AS TEXT)
WHERE "tax1099FormId" IS NOT NULL AND "taxbanditsRecordId" IS NULL;

UPDATE "FilingBatch"
SET "taxbanditsSubmissionId" = "tax1099SubmissionId"
WHERE "tax1099SubmissionId" IS NOT NULL AND "taxbanditsSubmissionId" IS NULL;

-- Step 2: Add taxbanditsSubmissionId to Form1099NEC (denormalized for faster queries)
ALTER TABLE "Form1099NEC" ADD COLUMN IF NOT EXISTS "taxbanditsSubmissionId" TEXT;
CREATE INDEX IF NOT EXISTS "Form1099NEC_taxbanditsSubmissionId_idx" ON "Form1099NEC"("taxbanditsSubmissionId");

-- Step 2b: Add index on FilingBatch.taxbanditsSubmissionId for status polling queries
CREATE INDEX IF NOT EXISTS "FilingBatch_taxbanditsSubmissionId_idx" ON "FilingBatch"("taxbanditsSubmissionId");

-- Step 3: Drop old Tax1099 columns
ALTER TABLE "Form1099NEC" DROP COLUMN IF EXISTS "tax1099FormId";
ALTER TABLE "FilingBatch" DROP COLUMN IF EXISTS "tax1099SubmissionId";
ALTER TABLE "Contractor" DROP COLUMN IF EXISTS "tax1099RecipientId";
