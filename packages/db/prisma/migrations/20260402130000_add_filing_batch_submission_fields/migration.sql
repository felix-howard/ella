-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "FilingStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PROCESSING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Add new columns to FilingBatch (idempotent)
ALTER TABLE "FilingBatch"
  ADD COLUMN IF NOT EXISTS "tax1099SubmissionId" TEXT,
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "totalForms" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "acceptedForms" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rejectedForms" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tinCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "uspsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "eDeliveryEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Convert status column from TEXT to FilingStatus enum
-- Must drop default first, change type, then re-add default
ALTER TABLE "FilingBatch" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "FilingBatch" ALTER COLUMN "status" SET DATA TYPE "FilingStatus" USING COALESCE("status", 'PENDING')::"FilingStatus";
ALTER TABLE "FilingBatch" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"FilingStatus";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FilingBatch_status_idx" ON "FilingBatch"("status");
