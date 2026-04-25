-- AlterTable
ALTER TABLE "NdaAgreement" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "NdaAgreement_clientId_idx" ON "NdaAgreement"("clientId");

-- AddForeignKey
ALTER TABLE "NdaAgreement" ADD CONSTRAINT "NdaAgreement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
