-- Keep backfilled IDs compatible with Prisma's cuid-shaped defaults.
UPDATE "ClientManager" cm
SET "id" = candidate."nextId"
FROM (
    SELECT
        "id" AS "oldId",
        'c' || substr(md5("clientId" || ':' || "staffId" || ':client-manager'), 1, 24) AS "nextId"
    FROM "ClientManager"
    WHERE "id" LIKE 'cm\_%'
) candidate
WHERE cm."id" = candidate."oldId"
    AND NOT EXISTS (
        SELECT 1
        FROM "ClientManager" existing
        WHERE existing."id" = candidate."nextId"
    );

-- ClientManager is an authorization boundary, so enforce tenant consistency in the DB.
CREATE OR REPLACE FUNCTION enforce_client_manager_org_scope()
RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "Client" c
        WHERE c."id" = NEW."clientId"
            AND c."organizationId" = NEW."organizationId"
    ) THEN
        RAISE EXCEPTION 'ClientManager client organization mismatch for clientId=% organizationId=%',
            NEW."clientId",
            NEW."organizationId"
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM "Staff" s
        WHERE s."id" = NEW."staffId"
            AND s."organizationId" = NEW."organizationId"
    ) THEN
        RAISE EXCEPTION 'ClientManager staff organization mismatch for staffId=% organizationId=%',
            NEW."staffId",
            NEW."organizationId"
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ClientManager_org_scope_guard" ON "ClientManager";

CREATE TRIGGER "ClientManager_org_scope_guard"
BEFORE INSERT OR UPDATE OF "clientId", "staffId", "organizationId"
ON "ClientManager"
FOR EACH ROW
EXECUTE FUNCTION enforce_client_manager_org_scope();

-- During rollout, existing application code still writes Client.managedById.
-- Mirror that legacy primary-manager field into ClientManager until Phase 02 dual-writes.
CREATE OR REPLACE FUNCTION sync_client_manager_from_legacy_managed_by()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE'
        AND OLD."managedById" IS NOT NULL
        AND (
            OLD."managedById" IS DISTINCT FROM NEW."managedById"
            OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
        )
    THEN
        DELETE FROM "ClientManager"
        WHERE "clientId" = NEW."id"
            AND "staffId" = OLD."managedById"
            AND "organizationId" = OLD."organizationId";
    END IF;

    IF NEW."managedById" IS NOT NULL
        AND NEW."organizationId" IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM "Staff" s
            WHERE s."id" = NEW."managedById"
                AND s."organizationId" = NEW."organizationId"
        )
    THEN
        INSERT INTO "ClientManager" (
            "id",
            "clientId",
            "staffId",
            "organizationId",
            "createdAt",
            "updatedAt"
        )
        VALUES (
            'c' || substr(md5(NEW."id" || ':' || NEW."managedById" || ':client-manager'), 1, 24),
            NEW."id",
            NEW."managedById",
            NEW."organizationId",
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT ("clientId", "staffId") DO UPDATE
        SET "organizationId" = EXCLUDED."organizationId",
            "updatedAt" = CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Client_managedById_client_manager_sync" ON "Client";

CREATE TRIGGER "Client_managedById_client_manager_sync"
AFTER INSERT OR UPDATE OF "managedById", "organizationId"
ON "Client"
FOR EACH ROW
EXECUTE FUNCTION sync_client_manager_from_legacy_managed_by();
