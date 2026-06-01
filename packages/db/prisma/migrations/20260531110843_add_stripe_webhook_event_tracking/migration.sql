-- AlterTable
ALTER TABLE "PaymentQuote"
ADD COLUMN IF NOT EXISTS "lastStripeEventAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastStripeEventId" TEXT;

-- AlterTable
ALTER TABLE "StripeCheckoutSession"
ADD COLUMN IF NOT EXISTS "lastStripeEventAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastStripeEventId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentQuote_lastStripeEventAt_idx" ON "PaymentQuote"("lastStripeEventAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StripeCheckoutSession_lastStripeEventAt_idx" ON "StripeCheckoutSession"("lastStripeEventAt");
