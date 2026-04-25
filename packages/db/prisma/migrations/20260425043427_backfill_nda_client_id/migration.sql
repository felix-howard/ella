-- Backfill NdaAgreement.clientId for already-converted leads.
-- Idempotent: only updates rows where clientId IS NULL.
UPDATE "NdaAgreement" AS n
SET "clientId" = l."convertedToId"
FROM "Lead" AS l
WHERE n."leadId" = l."id"
  AND n."clientId" IS NULL
  AND l."status" = 'CONVERTED'
  AND l."convertedToId" IS NOT NULL;
