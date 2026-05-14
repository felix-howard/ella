DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Organization_defaultUploadLinkTemplateId_check'
  ) THEN
    ALTER TABLE "Organization"
      ADD CONSTRAINT "Organization_defaultUploadLinkTemplateId_check"
      CHECK (
        "defaultUploadLinkTemplateId" IS NULL
        OR "defaultUploadLinkTemplateId" IN ('official-channel', 'tax-documents')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Staff_defaultUploadLinkTemplateId_check'
  ) THEN
    ALTER TABLE "Staff"
      ADD CONSTRAINT "Staff_defaultUploadLinkTemplateId_check"
      CHECK (
        "defaultUploadLinkTemplateId" IS NULL
        OR "defaultUploadLinkTemplateId" IN ('official-channel', 'tax-documents')
      );
  END IF;
END $$;
