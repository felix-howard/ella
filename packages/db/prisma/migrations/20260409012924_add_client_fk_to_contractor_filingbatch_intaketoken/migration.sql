-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "ContractorIntakeToken" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "FilingBatch" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "Contractor_clientId_idx" ON "Contractor"("clientId");

-- CreateIndex
CREATE INDEX "ContractorIntakeToken_clientId_isActive_idx" ON "ContractorIntakeToken"("clientId", "isActive");

-- CreateIndex
CREATE INDEX "FilingBatch_clientId_idx" ON "FilingBatch"("clientId");

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorIntakeToken" ADD CONSTRAINT "ContractorIntakeToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingBatch" ADD CONSTRAINT "FilingBatch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
