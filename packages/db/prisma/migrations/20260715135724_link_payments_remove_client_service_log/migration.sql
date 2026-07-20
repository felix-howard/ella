/*
  Warnings:

  - You are about to drop the `ClientServiceLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClientServiceLog" DROP CONSTRAINT "ClientServiceLog_clientId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ClientServiceLog" DROP CONSTRAINT "ClientServiceLog_createdById_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ClientServiceLog" DROP CONSTRAINT "ClientServiceLog_deletedById_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ClientServiceLog" DROP CONSTRAINT "ClientServiceLog_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ClientServiceLog" DROP CONSTRAINT "ClientServiceLog_updatedById_organizationId_fkey";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paymentQuoteId" TEXT;

-- DropTable
DROP TABLE "ClientServiceLog";

-- DropEnum
DROP TYPE "ClientServiceStatus";

-- DropEnum
DROP TYPE "ClientServiceType";

-- CreateIndex
CREATE INDEX "Payment_paymentQuoteId_idx" ON "Payment"("paymentQuoteId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentQuoteId_fkey" FOREIGN KEY ("paymentQuoteId") REFERENCES "PaymentQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
