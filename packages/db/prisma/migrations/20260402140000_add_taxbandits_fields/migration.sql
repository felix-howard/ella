-- AlterTable: Add TaxBandits fields alongside existing Tax1099 fields
-- These new fields will be used by the TaxBandits API integration
-- Old fields (tax1099FormId, tax1099SubmissionId) kept for backward compatibility until Phase 4 cleanup

ALTER TABLE "Form1099NEC" ADD COLUMN IF NOT EXISTS "taxbanditsRecordId" TEXT;
CREATE INDEX IF NOT EXISTS "Form1099NEC_taxbanditsRecordId_idx" ON "Form1099NEC"("taxbanditsRecordId");

ALTER TABLE "FilingBatch" ADD COLUMN IF NOT EXISTS "taxbanditsSubmissionId" TEXT;
