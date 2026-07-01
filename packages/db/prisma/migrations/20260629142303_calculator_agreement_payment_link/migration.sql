/*
  Warnings:

  - A unique constraint covering the columns `[paymentQuoteId]` on the table `Agreement` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AgreementPaymentPortalMode" AS ENUM ('NONE', 'AUTO_SEND', 'STAFF_REVIEW');

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "paymentPortalMode" "AgreementPaymentPortalMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "paymentQuoteId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "calculatorAgreementPaymentMode" "AgreementPaymentPortalMode" NOT NULL DEFAULT 'AUTO_SEND';

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_paymentQuoteId_key" ON "Agreement"("paymentQuoteId");

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_paymentQuoteId_fkey" FOREIGN KEY ("paymentQuoteId") REFERENCES "PaymentQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
