-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('SOLE_PROPRIETORSHIP', 'LLC', 'PARTNERSHIP', 'S_CORP', 'C_CORP');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "businessAddress" TEXT,
ADD COLUMN     "businessCity" TEXT,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "businessState" TEXT,
ADD COLUMN     "businessType" "BusinessType",
ADD COLUMN     "businessZip" TEXT,
ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "einEncrypted" TEXT;

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "ssnEncrypted" TEXT NOT NULL,
    "ssnLast4" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "tax1099RecipientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contractor_clientId_idx" ON "Contractor"("clientId");

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
