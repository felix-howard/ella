-- Prevent parent org changes from making existing ClientManager rows cross-tenant.
CREATE OR REPLACE FUNCTION prevent_client_manager_client_org_change()
RETURNS trigger AS $$
BEGIN
    IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
        AND EXISTS (
            SELECT 1
            FROM "ClientManager" cm
            WHERE cm."clientId" = NEW."id"
        )
    THEN
        RAISE EXCEPTION 'Cannot change Client.organizationId while ClientManager links exist for clientId=%',
            NEW."id"
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Client_client_manager_org_change_guard" ON "Client";

CREATE TRIGGER "Client_client_manager_org_change_guard"
BEFORE UPDATE OF "organizationId"
ON "Client"
FOR EACH ROW
EXECUTE FUNCTION prevent_client_manager_client_org_change();

CREATE OR REPLACE FUNCTION prevent_client_manager_staff_org_change()
RETURNS trigger AS $$
BEGIN
    IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
        AND EXISTS (
            SELECT 1
            FROM "ClientManager" cm
            WHERE cm."staffId" = NEW."id"
        )
    THEN
        RAISE EXCEPTION 'Cannot change Staff.organizationId while ClientManager links exist for staffId=%',
            NEW."id"
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Staff_client_manager_org_change_guard" ON "Staff";

CREATE TRIGGER "Staff_client_manager_org_change_guard"
BEFORE UPDATE OF "organizationId"
ON "Staff"
FOR EACH ROW
EXECUTE FUNCTION prevent_client_manager_staff_org_change();
