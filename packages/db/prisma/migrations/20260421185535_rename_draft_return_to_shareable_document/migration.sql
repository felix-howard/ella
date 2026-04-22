-- Rename DraftReturn → ShareableDocument at Prisma level, keep DB table as `DraftReturn` via @@map.
-- Rename enum DraftReturnStatus → DocumentStatus in-place (preserves data, unlike drop+recreate).

-- 1. Rename enum type (in-place, no data loss)
ALTER TYPE "DraftReturnStatus" RENAME TO "DocumentStatus";

-- 2. Add new columns with safe defaults
ALTER TABLE "DraftReturn" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Draft Return';
ALTER TABLE "DraftReturn" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- 3. Replace composite index (taxCaseId, status) with (taxCaseId, status, deletedAt)
DROP INDEX IF EXISTS "DraftReturn_taxCaseId_status_idx";
CREATE INDEX "DraftReturn_taxCaseId_status_deletedAt_idx"
  ON "DraftReturn"("taxCaseId", "status", "deletedAt");
