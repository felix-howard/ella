-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "businessAddress" TEXT,
ADD COLUMN     "businessCity" TEXT,
ADD COLUMN     "businessState" TEXT,
ADD COLUMN     "businessType" "BusinessType",
ADD COLUMN     "businessZip" TEXT,
ADD COLUMN     "einEncrypted" TEXT;
