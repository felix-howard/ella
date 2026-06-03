-- Keep the transitional Client.managedById field tenant-safe while rollout code still writes it.
CREATE OR REPLACE FUNCTION enforce_client_managed_by_org_scope()
RETURNS trigger AS $$
BEGIN
    IF NEW."managedById" IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW."organizationId" IS NULL THEN
        RAISE EXCEPTION 'Client.managedById requires Client.organizationId for clientId=% managedById=%',
            NEW."id",
            NEW."managedById"
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM "Staff" s
        WHERE s."id" = NEW."managedById"
            AND s."organizationId" = NEW."organizationId"
    ) THEN
        RAISE EXCEPTION 'Client.managedById organization mismatch for clientId=% managedById=% organizationId=%',
            NEW."id",
            NEW."managedById",
            NEW."organizationId"
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Client_managedById_org_scope_guard" ON "Client";

CREATE TRIGGER "Client_managedById_org_scope_guard"
BEFORE INSERT OR UPDATE OF "managedById", "organizationId"
ON "Client"
FOR EACH ROW
EXECUTE FUNCTION enforce_client_managed_by_org_scope();
