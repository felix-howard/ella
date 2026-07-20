-- AlterTable
ALTER TABLE "StripeWebhookEventLog" ADD COLUMN     "chargeFullyRefunded" BOOLEAN,
ADD COLUMN     "stripePaymentIntentId" TEXT;

-- CreateIndex
CREATE INDEX "StripeWebhookEventLog_eventType_stripeObjectId_chargeFullyR_idx" ON "StripeWebhookEventLog"("eventType", "stripeObjectId", "chargeFullyRefunded");

-- CreateIndex
CREATE INDEX "StripeWebhookEventLog_eventType_stripePaymentIntentId_charg_idx" ON "StripeWebhookEventLog"("eventType", "stripePaymentIntentId", "chargeFullyRefunded");
