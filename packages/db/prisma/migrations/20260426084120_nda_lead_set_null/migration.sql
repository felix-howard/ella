-- DropForeignKey
ALTER TABLE "NdaAgreement" DROP CONSTRAINT "NdaAgreement_leadId_fkey";

-- AlterTable
ALTER TABLE "NdaAgreement" ALTER COLUMN "leadId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "NdaAgreement" ADD CONSTRAINT "NdaAgreement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
