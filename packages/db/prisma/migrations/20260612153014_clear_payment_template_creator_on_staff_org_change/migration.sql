-- If a staff member moves organizations, clear payment template creator
-- attribution that would otherwise become cross-tenant.
CREATE OR REPLACE FUNCTION clear_payment_template_creator_on_staff_org_change()
RETURNS trigger AS $$
BEGIN
    IF OLD."organizationId" IS NOT DISTINCT FROM NEW."organizationId" THEN
        RETURN NEW;
    END IF;

    UPDATE "PaymentTemplate" pt
    SET "createdByStaffId" = NULL
    WHERE pt."createdByStaffId" = NEW."id"
        AND pt."organizationId" IS DISTINCT FROM NEW."organizationId";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Staff_payment_template_creator_org_change_guard" ON "Staff";

CREATE TRIGGER "Staff_payment_template_creator_org_change_guard"
AFTER UPDATE OF "organizationId"
ON "Staff"
FOR EACH ROW
EXECUTE FUNCTION clear_payment_template_creator_on_staff_org_change();
