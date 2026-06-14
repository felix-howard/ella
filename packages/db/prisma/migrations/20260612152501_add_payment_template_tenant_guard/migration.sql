-- Keep optional creator attribution tenant-safe. The regular FK preserves
-- ON DELETE SET NULL, while this guard blocks cross-organization staff IDs.
CREATE OR REPLACE FUNCTION enforce_payment_template_created_by_staff_org_scope()
RETURNS trigger AS $$
BEGIN
    IF NEW."createdByStaffId" IS NULL THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM "Staff" s
        WHERE s."id" = NEW."createdByStaffId"
            AND s."organizationId" = NEW."organizationId"
    ) THEN
        RAISE EXCEPTION 'PaymentTemplate.createdByStaffId organization mismatch for templateId=% createdByStaffId=% organizationId=%',
            NEW."id",
            NEW."createdByStaffId",
            NEW."organizationId"
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PaymentTemplate_createdByStaffId_org_scope_guard" ON "PaymentTemplate";

CREATE TRIGGER "PaymentTemplate_createdByStaffId_org_scope_guard"
BEFORE INSERT OR UPDATE OF "createdByStaffId", "organizationId"
ON "PaymentTemplate"
FOR EACH ROW
EXECUTE FUNCTION enforce_payment_template_created_by_staff_org_scope();
