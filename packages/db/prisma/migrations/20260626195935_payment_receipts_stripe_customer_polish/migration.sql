-- Add Stripe customer and receipt facts to the app-side payment ledger.
-- Fully additive: no dropped tables, dropped columns, deletes, or data rewrites.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeCustomerLinkedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeInvoiceId" TEXT,
ADD COLUMN     "stripeChargeId" TEXT,
ADD COLUMN     "stripeReceiptUrl" TEXT,
ADD COLUMN     "stripeReceiptNumber" TEXT,
ADD COLUMN     "stripeHostedInvoiceUrl" TEXT,
ADD COLUMN     "stripeInvoicePdfUrl" TEXT,
ADD COLUMN     "paymentMethodBrand" TEXT,
ADD COLUMN     "paymentMethodLast4" TEXT,
ADD COLUMN     "receiptSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StripeCheckoutSession" ADD COLUMN     "stripeInvoiceId" TEXT;

-- CreateTable
CREATE TABLE "StripeWebhookEventLog" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "stripeObjectId" TEXT,
    "livemode" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeWebhookEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_stripeCustomerId_key" ON "Client"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Payment_stripeCustomerId_idx" ON "Payment"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Payment_stripeInvoiceId_idx" ON "Payment"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Payment_stripeChargeId_idx" ON "Payment"("stripeChargeId");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_stripeInvoiceId_idx" ON "StripeCheckoutSession"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEventLog_stripeEventId_key" ON "StripeWebhookEventLog"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEventLog_status_receivedAt_idx" ON "StripeWebhookEventLog"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "StripeWebhookEventLog_eventType_idx" ON "StripeWebhookEventLog"("eventType");

-- CreateIndex
CREATE INDEX "StripeWebhookEventLog_stripeObjectId_idx" ON "StripeWebhookEventLog"("stripeObjectId");
