-- Backfill multi-manager links from the legacy primary manager column.
INSERT INTO "ClientManager" (
    "id",
    "clientId",
    "staffId",
    "organizationId",
    "createdAt",
    "updatedAt"
)
SELECT
    'cm_' || substr(md5(c."id" || ':' || c."managedById"), 1, 22),
    c."id",
    c."managedById",
    c."organizationId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Client" c
INNER JOIN "Staff" s
    ON s."id" = c."managedById"
    AND s."organizationId" = c."organizationId"
WHERE c."managedById" IS NOT NULL
    AND c."organizationId" IS NOT NULL
ON CONFLICT ("clientId", "staffId") DO NOTHING;
