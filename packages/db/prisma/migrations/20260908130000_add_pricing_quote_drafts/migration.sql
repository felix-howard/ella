-- CreateTable
CREATE TABLE "PricingQuoteDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "monthlyTotalCents" INTEGER NOT NULL,
    "setupTotalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingQuoteDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingQuoteDraft_organizationId_name_key" ON "PricingQuoteDraft"("organizationId", "name");

-- CreateIndex
CREATE INDEX "PricingQuoteDraft_organizationId_updatedAt_idx" ON "PricingQuoteDraft"("organizationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "PricingQuoteDraft" ADD CONSTRAINT "PricingQuoteDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
