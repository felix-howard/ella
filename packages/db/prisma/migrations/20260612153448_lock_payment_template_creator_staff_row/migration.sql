-- Serialize payment template creator validation with Staff.organizationId updates.
CREATE OR REPLACE FUNCTION enforce_payment_template_created_by_staff_org_scope()
RETURNS trigger AS $$
DECLARE
    staff_organization_id TEXT;
BEGIN
    IF NEW."createdByStaffId" IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT s."organizationId"
    INTO staff_organization_id
    FROM "Staff" s
    WHERE s."id" = NEW."createdByStaffId"
    FOR SHARE;

    IF NOT FOUND OR staff_organization_id IS DISTINCT FROM NEW."organizationId" THEN
        RAISE EXCEPTION 'PaymentTemplate.createdByStaffId organization mismatch for templateId=% createdByStaffId=% organizationId=%',
            NEW."id",
            NEW."createdByStaffId",
            NEW."organizationId"
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
