DO $$
DECLARE
  staff_record RECORD;
  candidate_slug TEXT;
BEGIN
  FOR staff_record IN
    SELECT id, "organizationId"
    FROM "Staff"
    WHERE "formSlug" IS NULL
      AND "organizationId" IS NOT NULL
    ORDER BY "createdAt", id
  LOOP
    LOOP
      candidate_slug := lpad(floor(random() * 1000000)::text, 6, '0');

      IF NOT EXISTS (
        SELECT 1
        FROM "Staff"
        WHERE "organizationId" = staff_record."organizationId"
          AND "formSlug" = candidate_slug
      ) THEN
        UPDATE "Staff"
        SET "formSlug" = candidate_slug
        WHERE id = staff_record.id
          AND "formSlug" IS NULL;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;
