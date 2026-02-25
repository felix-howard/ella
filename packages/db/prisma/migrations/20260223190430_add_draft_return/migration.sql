-- CreateEnum
CREATE TYPE "DraftReturnStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'SUPERSEDED');

-- AlterEnum
ALTER TYPE "MagicLinkType" ADD VALUE 'DRAFT_RETURN';

-- AlterTable
ALTER TABLE "MagicLink" ADD COLUMN "draftReturnId" TEXT;

-- CreateTable
CREATE TABLE "DraftReturn" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "status" "DraftReturnStatus" NOT NULL DEFAULT 'ACTIVE',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftReturn_taxCaseId_idx" ON "DraftReturn"("taxCaseId");

-- CreateIndex
CREATE INDEX "DraftReturn_taxCaseId_status_idx" ON "DraftReturn"("taxCaseId", "status");

-- CreateIndex
CREATE INDEX "DraftReturn_status_idx" ON "DraftReturn"("status");

-- CreateIndex
CREATE INDEX "MagicLink_draftReturnId_idx" ON "MagicLink"("draftReturnId");

-- AddForeignKey
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_draftReturnId_fkey" FOREIGN KEY ("draftReturnId") REFERENCES "DraftReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftReturn" ADD CONSTRAINT "DraftReturn_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftReturn" ADD CONSTRAINT "DraftReturn_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
