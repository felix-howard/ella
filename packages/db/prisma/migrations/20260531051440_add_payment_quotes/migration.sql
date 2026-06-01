-- CreateTable
CREATE TABLE "PaymentQuote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "clientId" TEXT,
    "leadId" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "businessName" TEXT,
    "inputSnapshot" JSONB NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "monthlyTotalCents" INTEGER NOT NULL,
    "setupTotalCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_checkout',
    "createdByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeCheckoutSession" (
    "id" TEXT NOT NULL,
    "paymentQuoteId" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "status" TEXT NOT NULL,
    "url" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentQuote_organizationId_createdAt_idx" ON "PaymentQuote"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentQuote_clientId_idx" ON "PaymentQuote"("clientId");

-- CreateIndex
CREATE INDEX "PaymentQuote_leadId_idx" ON "PaymentQuote"("leadId");

-- CreateIndex
CREATE INDEX "PaymentQuote_createdByStaffId_idx" ON "PaymentQuote"("createdByStaffId");

-- CreateIndex
CREATE INDEX "PaymentQuote_status_idx" ON "PaymentQuote"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StripeCheckoutSession_stripeSessionId_key" ON "StripeCheckoutSession"("stripeSessionId");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_paymentQuoteId_idx" ON "StripeCheckoutSession"("paymentQuoteId");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_status_idx" ON "StripeCheckoutSession"("status");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_stripeCustomerId_idx" ON "StripeCheckoutSession"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_stripeSubscriptionId_idx" ON "StripeCheckoutSession"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "StripeCheckoutSession_stripePaymentIntentId_idx" ON "StripeCheckoutSession"("stripePaymentIntentId");

-- AddForeignKey
ALTER TABLE "PaymentQuote" ADD CONSTRAINT "PaymentQuote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentQuote" ADD CONSTRAINT "PaymentQuote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentQuote" ADD CONSTRAINT "PaymentQuote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentQuote" ADD CONSTRAINT "PaymentQuote_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripeCheckoutSession" ADD CONSTRAINT "StripeCheckoutSession_paymentQuoteId_fkey" FOREIGN KEY ("paymentQuoteId") REFERENCES "PaymentQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
