-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "defaultUploadLinkTemplateId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "defaultUploadLinkTemplateId" TEXT;
