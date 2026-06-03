-- Report any legacy primary-manager rows that did not become ClientManager links.
DO $$
DECLARE
    skipped_null_org INTEGER;
    skipped_missing_staff INTEGER;
    skipped_cross_org INTEGER;
    missing_join INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO skipped_null_org
    FROM "Client" c
    WHERE c."managedById" IS NOT NULL
        AND c."organizationId" IS NULL;

    SELECT COUNT(*)
    INTO skipped_missing_staff
    FROM "Client" c
    LEFT JOIN "Staff" s ON s."id" = c."managedById"
    WHERE c."managedById" IS NOT NULL
        AND c."organizationId" IS NOT NULL
        AND s."id" IS NULL;

    SELECT COUNT(*)
    INTO skipped_cross_org
    FROM "Client" c
    INNER JOIN "Staff" s ON s."id" = c."managedById"
    WHERE c."managedById" IS NOT NULL
        AND c."organizationId" IS NOT NULL
        AND s."organizationId" IS DISTINCT FROM c."organizationId";

    SELECT COUNT(*)
    INTO missing_join
    FROM "Client" c
    WHERE c."managedById" IS NOT NULL
        AND c."organizationId" IS NOT NULL
        AND NOT EXISTS (
            SELECT 1
            FROM "ClientManager" cm
            WHERE cm."clientId" = c."id"
                AND cm."staffId" = c."managedById"
                AND cm."organizationId" = c."organizationId"
        );

    RAISE NOTICE 'ClientManager backfill audit: null_org=%, missing_staff=%, cross_org=%, missing_join=%',
        skipped_null_org,
        skipped_missing_staff,
        skipped_cross_org,
        missing_join;

    IF missing_join > 0 THEN
        RAISE WARNING 'ClientManager backfill has % legacy managed clients without join rows', missing_join;
    END IF;
END $$;
