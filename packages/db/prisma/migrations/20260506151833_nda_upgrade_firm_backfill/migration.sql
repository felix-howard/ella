-- Backfill Houston defaults for existing single-tenant org
-- Only sets fields that are currently NULL to preserve any future manual updates
UPDATE "Organization"
SET "address" = COALESCE("address", '10700 Richmond Ave Ste 117'),
    "city" = COALESCE("city", 'Houston'),
    "state" = COALESCE("state", 'TX'),
    "zip" = COALESCE("zip", '77042'),
    "governingState" = COALESCE("governingState", 'Texas'),
    "governingCounty" = COALESCE("governingCounty", 'Harris County')
WHERE "address" IS NULL;