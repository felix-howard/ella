-- Replace N:N ClientAssignment with single managedById FK on Client

-- 1. Add managedById column (nullable)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "managedById" TEXT;

-- 2. Migrate data: set managedById from first assignment (earliest createdAt)
UPDATE "Client" c
SET "managedById" = (
  SELECT ca."staffId"
  FROM "ClientAssignment" ca
  WHERE ca."clientId" = c."id"
  ORDER BY ca."createdAt" ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "ClientAssignment" ca WHERE ca."clientId" = c."id"
);

-- 3. For clients without assignments: set to org's first admin
UPDATE "Client" c
SET "managedById" = (
  SELECT s."id"
  FROM "Staff" s
  WHERE s."organizationId" = c."organizationId"
    AND s."role" = 'ADMIN'
    AND s."isActive" = true
  ORDER BY s."createdAt" ASC
  LIMIT 1
)
WHERE c."managedById" IS NULL
  AND c."organizationId" IS NOT NULL;

-- 4. Add FK constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Client_managedById_fkey'
  ) THEN
    ALTER TABLE "Client" ADD CONSTRAINT "Client_managedById_fkey"
      FOREIGN KEY ("managedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Add index
CREATE INDEX IF NOT EXISTS "Client_managedById_idx" ON "Client"("managedById");

-- 6. Drop ClientAssignment table
DROP TABLE IF EXISTS "ClientAssignment";
