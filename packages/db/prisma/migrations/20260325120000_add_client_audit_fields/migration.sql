-- Add createdById and updatedById audit fields to Client

-- 1. Add columns
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

-- 2. Add FK constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Client_createdById_fkey'
  ) THEN
    ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Client_updatedById_fkey'
  ) THEN
    ALTER TABLE "Client" ADD CONSTRAINT "Client_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Add indexes
CREATE INDEX IF NOT EXISTS "Client_createdById_idx" ON "Client"("createdById");
CREATE INDEX IF NOT EXISTS "Client_updatedById_idx" ON "Client"("updatedById");

-- 4. Backfill createdById from managedById (initial manager = creator)
UPDATE "Client" SET "createdById" = "managedById"
WHERE "createdById" IS NULL AND "managedById" IS NOT NULL;
