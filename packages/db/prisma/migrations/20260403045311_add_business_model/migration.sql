/*
  Warnings:

  - You are about to drop the column `businessAddress` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `businessCity` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `businessName` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `businessState` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `businessType` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `businessZip` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `clientType` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `einEncrypted` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `Contractor` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `FilingBatch` table. All the data in the column will be lost.
  - Added the required column `businessId` to the `Contractor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `businessId` to the `FilingBatch` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Contractor" DROP CONSTRAINT "Contractor_clientId_fkey";

-- DropForeignKey
ALTER TABLE "FilingBatch" DROP CONSTRAINT "FilingBatch_clientId_fkey";

-- DropIndex
DROP INDEX "Contractor_clientId_idx";

-- DropIndex
DROP INDEX "FilingBatch_clientId_idx";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "businessAddress",
DROP COLUMN "businessCity",
DROP COLUMN "businessName",
DROP COLUMN "businessState",
DROP COLUMN "businessType",
DROP COLUMN "businessZip",
DROP COLUMN "clientType",
DROP COLUMN "einEncrypted";

-- AlterTable
ALTER TABLE "Contractor" DROP COLUMN "clientId",
ADD COLUMN     "businessId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FilingBatch" DROP COLUMN "clientId",
ADD COLUMN     "businessId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "ClientType";

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessType" NOT NULL,
    "einEncrypted" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Business_clientId_idx" ON "Business"("clientId");

-- CreateIndex
CREATE INDEX "Contractor_businessId_idx" ON "Contractor"("businessId");

-- CreateIndex
CREATE INDEX "FilingBatch_businessId_idx" ON "FilingBatch"("businessId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingBatch" ADD CONSTRAINT "FilingBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
