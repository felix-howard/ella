-- CreateEnum
CREATE TYPE "StaffFileKind" AS ENUM ('PERSONAL_DOCUMENT', 'INVOICE');

-- CreateEnum
CREATE TYPE "StaffInvoiceStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "StaffFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "uploadedByStaffId" TEXT NOT NULL,
    "kind" "StaffFileKind" NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "r2Key" TEXT NOT NULL,
    "checksumSha256" TEXT,
    "invoiceYear" INTEGER,
    "invoiceMonth" INTEGER,
    "invoiceStatus" "StaffInvoiceStatus",
    "replacedById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reviewedByStaffId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffFile_organizationId_staffId_kind_idx" ON "StaffFile"("organizationId", "staffId", "kind");

-- CreateIndex
CREATE INDEX "StaffFile_organizationId_kind_invoiceYear_invoiceMonth_idx" ON "StaffFile"("organizationId", "kind", "invoiceYear", "invoiceMonth");

-- CreateIndex
CREATE INDEX "StaffFile_r2Key_idx" ON "StaffFile"("r2Key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StaffFile_one_active_invoice_per_month_idx"
ON "StaffFile" ("organizationId", "staffId", "invoiceYear", "invoiceMonth")
WHERE "kind" = 'INVOICE' AND "isActive" = true AND "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "StaffFile" ADD CONSTRAINT "StaffFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFile" ADD CONSTRAINT "StaffFile_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFile" ADD CONSTRAINT "StaffFile_uploadedByStaffId_fkey" FOREIGN KEY ("uploadedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
