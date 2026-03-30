-- AlterEnum: Add new values to ClientSource
ALTER TYPE "ClientSource" ADD VALUE IF NOT EXISTS 'GENERIC_FORM';
ALTER TYPE "ClientSource" ADD VALUE IF NOT EXISTS 'STAFF_FORM';
ALTER TYPE "ClientSource" ADD VALUE IF NOT EXISTS 'CONVERTED';

-- AlterTable: Add tags column to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: Add tags column to Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DataMigration: Copy existing Lead.source values into tags array
UPDATE "Lead" SET "tags" = ARRAY["source"] WHERE "source" IS NOT NULL AND "source" != '' AND ("tags" IS NULL OR array_length("tags", 1) IS NULL);

-- GIN indexes for fast tag filtering (hasSome/has queries)
CREATE INDEX IF NOT EXISTS "Lead_tags_idx" ON "Lead" USING GIN ("tags");
CREATE INDEX IF NOT EXISTS "Client_tags_idx" ON "Client" USING GIN ("tags");
