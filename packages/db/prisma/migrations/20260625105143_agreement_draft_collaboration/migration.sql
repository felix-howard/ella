-- CreateEnum
CREATE TYPE "AgreementSource" AS ENUM ('MANUAL', 'CALCULATOR');

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "lastEditedByUserId" TEXT,
ADD COLUMN     "sentByUserId" TEXT,
ADD COLUMN     "source" "AgreementSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceSnapshot" JSONB;

-- CreateIndex
CREATE INDEX "Agreement_clientId_status_idx" ON "Agreement"("clientId", "status");

-- CreateIndex
CREATE INDEX "Agreement_organizationId_status_idx" ON "Agreement"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
