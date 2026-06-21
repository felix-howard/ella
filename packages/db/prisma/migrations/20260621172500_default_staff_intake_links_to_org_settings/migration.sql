DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Staff'
      AND column_name = 'useOrgUploadLinkDefaults'
  ) THEN
    UPDATE "Staff"
    SET "useOrgUploadLinkDefaults" = true
    WHERE "useOrgUploadLinkDefaults" = false;
  END IF;
END $$;
