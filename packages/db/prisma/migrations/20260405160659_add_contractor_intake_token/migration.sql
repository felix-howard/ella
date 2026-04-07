-- CreateTable
CREATE TABLE "ContractorIntakeToken" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorIntakeToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorIntakeToken_token_key" ON "ContractorIntakeToken"("token");

-- CreateIndex
CREATE INDEX "ContractorIntakeToken_token_idx" ON "ContractorIntakeToken"("token");

-- CreateIndex
CREATE INDEX "ContractorIntakeToken_businessId_isActive_idx" ON "ContractorIntakeToken"("businessId", "isActive");

-- AddForeignKey
ALTER TABLE "ContractorIntakeToken" ADD CONSTRAINT "ContractorIntakeToken_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
