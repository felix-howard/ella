-- Add grouping job tracking to TaxCase
-- This allows reliable tracking of batch grouping job status

ALTER TABLE "TaxCase" ADD COLUMN "groupingJobId" TEXT;
ALTER TABLE "TaxCase" ADD COLUMN "groupingStartedAt" TIMESTAMP(3);

-- Index for querying cases with active grouping jobs
CREATE INDEX "TaxCase_groupingJobId_idx" ON "TaxCase"("groupingJobId");
