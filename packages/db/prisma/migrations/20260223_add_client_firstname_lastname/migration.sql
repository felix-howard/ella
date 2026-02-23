-- Add firstName and lastName columns to Client table
-- firstName is required, lastName is optional
-- Existing clients will have their name migrated to firstName

-- Add new columns (firstName with default empty string temporarily)
ALTER TABLE "Client" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Client" ADD COLUMN "lastName" TEXT;

-- Copy existing name to firstName for all existing clients
UPDATE "Client" SET "firstName" = "name" WHERE "firstName" = '';

-- Set name column default to empty string for new records
-- (name will be computed by API from firstName + lastName)
ALTER TABLE "Client" ALTER COLUMN "name" SET DEFAULT '';
