-- Make PaymentQuote sendable/portal-payable, add RECURRING payment type, and add the
-- notifyOnPaymentFailed staff toggle. Fully additive — no destructive operations.

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'RECURRING';

-- AlterTable
ALTER TABLE "PaymentQuote" ADD COLUMN     "payToken" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "sentByStaffId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "notifyOnPaymentFailed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentQuote_payToken_key" ON "PaymentQuote"("payToken");

-- CreateIndex
CREATE INDEX "PaymentQuote_sentByStaffId_idx" ON "PaymentQuote"("sentByStaffId");

-- AddForeignKey
ALTER TABLE "PaymentQuote" ADD CONSTRAINT "PaymentQuote_sentByStaffId_fkey" FOREIGN KEY ("sentByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
