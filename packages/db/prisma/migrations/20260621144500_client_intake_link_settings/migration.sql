DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Organization'
      AND column_name = 'defaultUploadLinkLanguage'
  ) THEN
    ALTER TABLE "Organization"
    ADD COLUMN "defaultUploadLinkLanguage" "Language";

    UPDATE "Organization"
    SET "defaultUploadLinkLanguage" = "smsLanguage";

    ALTER TABLE "Organization"
    ALTER COLUMN "defaultUploadLinkLanguage" SET DEFAULT 'EN',
    ALTER COLUMN "defaultUploadLinkLanguage" SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Staff'
      AND column_name = 'useOrgUploadLinkDefaults'
  ) THEN
    ALTER TABLE "Staff"
    ADD COLUMN "useOrgUploadLinkDefaults" BOOLEAN;

    UPDATE "Staff"
    SET "useOrgUploadLinkDefaults" = NOT (
      "formSlug" IS NOT NULL
      OR "autoSendUploadLink" = true
      OR "defaultUploadLinkTemplateId" IS NOT NULL
    );

    ALTER TABLE "Staff"
    ALTER COLUMN "useOrgUploadLinkDefaults" SET DEFAULT true,
    ALTER COLUMN "useOrgUploadLinkDefaults" SET NOT NULL;
  END IF;
END $$;

ALTER TABLE "Staff"
ADD COLUMN IF NOT EXISTS "defaultUploadLinkLanguage" "Language";
