-- AlterTable
ALTER TABLE "RawImage" ADD COLUMN     "isStorageDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retentionDeleteAt" TIMESTAMP(3),
ADD COLUMN     "retentionDeleteReason" TEXT,
ADD COLUMN     "retentionDeletedAt" TIMESTAMP(3),
ADD COLUMN     "retentionPolicy" TEXT,
ADD COLUMN     "storageDeletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RawImage_retentionDeleteAt_idx" ON "RawImage"("retentionDeleteAt");

-- CreateIndex
CREATE INDEX "RawImage_retentionDeletedAt_idx" ON "RawImage"("retentionDeletedAt");

-- CreateIndex
CREATE INDEX "RawImage_category_retentionDeleteAt_idx" ON "RawImage"("category", "retentionDeleteAt");

-- CreateIndex
CREATE INDEX "RawImage_isStorageDeleted_idx" ON "RawImage"("isStorageDeleted");
