-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "voidReason" VARCHAR(500),
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Agreement_voidedByUserId_idx" ON "Agreement"("voidedByUserId");

-- CreateIndex
CREATE INDEX "Agreement_voidedAt_idx" ON "Agreement"("voidedAt");

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
