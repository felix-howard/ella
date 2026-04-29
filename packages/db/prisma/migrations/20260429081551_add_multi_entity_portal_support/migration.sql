-- CreateEnum
CREATE TYPE "UploadSource" AS ENUM ('PORTAL_EXPLICIT', 'PORTAL_AI', 'CPA_MANUAL');

-- CreateEnum
CREATE TYPE "MagicLinkScope" AS ENUM ('CASE', 'GROUP');

-- AlterTable
ALTER TABLE "MagicLink" ADD COLUMN     "clientGroupId" TEXT,
ADD COLUMN     "scope" "MagicLinkScope" NOT NULL DEFAULT 'CASE',
ALTER COLUMN "caseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RawImage" ADD COLUMN     "uploadSource" "UploadSource" NOT NULL DEFAULT 'PORTAL_AI';

-- CreateIndex
CREATE INDEX "MagicLink_clientGroupId_idx" ON "MagicLink"("clientGroupId");

-- CreateIndex
CREATE INDEX "RawImage_uploadSource_idx" ON "RawImage"("uploadSource");

-- AddForeignKey
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "ClientGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
