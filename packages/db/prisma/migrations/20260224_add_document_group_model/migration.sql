-- CreateTable
CREATE TABLE "DocumentGroup" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "documentType" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add multi-page grouping fields to RawImage
ALTER TABLE "RawImage" ADD COLUMN "documentGroupId" TEXT;
ALTER TABLE "RawImage" ADD COLUMN "pageNumber" INTEGER;
ALTER TABLE "RawImage" ADD COLUMN "totalPages" INTEGER;
ALTER TABLE "RawImage" ADD COLUMN "groupConfidence" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "DocumentGroup_caseId_idx" ON "DocumentGroup"("caseId");

-- CreateIndex
CREATE INDEX "DocumentGroup_caseId_createdAt_idx" ON "DocumentGroup"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "RawImage_documentGroupId_idx" ON "RawImage"("documentGroupId");

-- CreateIndex
CREATE INDEX "RawImage_caseId_documentGroupId_idx" ON "RawImage"("caseId", "documentGroupId");

-- AddForeignKey
ALTER TABLE "RawImage" ADD CONSTRAINT "RawImage_documentGroupId_fkey" FOREIGN KEY ("documentGroupId") REFERENCES "DocumentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentGroup" ADD CONSTRAINT "DocumentGroup_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
