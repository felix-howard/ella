-- Fix: Re-apply missing schema changes that were marked as applied but never ran
-- This migration uses IF NOT EXISTS/IF EXISTS clauses to be idempotent

-- 1. Add aiMetadata column (from 20260224_add_ai_metadata_to_raw_image)
ALTER TABLE "RawImage" ADD COLUMN IF NOT EXISTS "aiMetadata" JSONB;

-- 2. Create GIN index on aiMetadata (from 20260224_add_ai_metadata_gin_index)
CREATE INDEX IF NOT EXISTS "RawImage_aiMetadata_idx" ON "RawImage" USING GIN ("aiMetadata");

-- 3. Create DocumentGroup table (from 20260224_add_document_group_model)
CREATE TABLE IF NOT EXISTS "DocumentGroup" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "documentType" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentGroup_pkey" PRIMARY KEY ("id")
);

-- 4. Add multi-page grouping fields to RawImage
ALTER TABLE "RawImage" ADD COLUMN IF NOT EXISTS "documentGroupId" TEXT;
ALTER TABLE "RawImage" ADD COLUMN IF NOT EXISTS "pageNumber" INTEGER;
ALTER TABLE "RawImage" ADD COLUMN IF NOT EXISTS "totalPages" INTEGER;
ALTER TABLE "RawImage" ADD COLUMN IF NOT EXISTS "groupConfidence" DOUBLE PRECISION;

-- 5. Create indexes for DocumentGroup
CREATE INDEX IF NOT EXISTS "DocumentGroup_caseId_idx" ON "DocumentGroup"("caseId");
CREATE INDEX IF NOT EXISTS "DocumentGroup_caseId_createdAt_idx" ON "DocumentGroup"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "RawImage_documentGroupId_idx" ON "RawImage"("documentGroupId");
CREATE INDEX IF NOT EXISTS "RawImage_caseId_documentGroupId_idx" ON "RawImage"("caseId", "documentGroupId");

-- 6. Add foreign keys (only if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RawImage_documentGroupId_fkey') THEN
    ALTER TABLE "RawImage" ADD CONSTRAINT "RawImage_documentGroupId_fkey"
      FOREIGN KEY ("documentGroupId") REFERENCES "DocumentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentGroup_caseId_fkey') THEN
    ALTER TABLE "DocumentGroup" ADD CONSTRAINT "DocumentGroup_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 7. Add duplicateOfId (from 20260224_add_duplicate_of_id)
ALTER TABLE "RawImage" ADD COLUMN IF NOT EXISTS "duplicateOfId" TEXT;

-- 8. Add grouping job tracking to TaxCase (from 20260225_add_grouping_job_tracking)
ALTER TABLE "TaxCase" ADD COLUMN IF NOT EXISTS "groupingJobId" TEXT;
ALTER TABLE "TaxCase" ADD COLUMN IF NOT EXISTS "groupingStartedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "TaxCase_groupingJobId_idx" ON "TaxCase"("groupingJobId");
