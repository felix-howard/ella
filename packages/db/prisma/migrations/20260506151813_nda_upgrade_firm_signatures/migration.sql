-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "clientAuthRepName" TEXT,
ADD COLUMN     "clientAuthRepTitle" TEXT,
ADD COLUMN     "firmSignaturePngKey" TEXT,
ADD COLUMN     "firmSignedAt" TIMESTAMP(3),
ADD COLUMN     "firmSignerEmail" TEXT,
ADD COLUMN     "firmSignerName" TEXT,
ADD COLUMN     "firmSignerTitle" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "governingCounty" TEXT,
ADD COLUMN     "governingState" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "zip" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "signaturePngKey" TEXT,
ADD COLUMN     "signatureUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT;
