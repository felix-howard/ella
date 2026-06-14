-- DropForeignKey
ALTER TABLE "StaffFile" DROP CONSTRAINT IF EXISTS "StaffFile_staffId_fkey";

-- DropForeignKey
ALTER TABLE "StaffFile" DROP CONSTRAINT IF EXISTS "StaffFile_uploadedByStaffId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "StaffFile_r2Key_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StaffFile_r2Key_key" ON "StaffFile"("r2Key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StaffFile_id_organizationId_key" ON "StaffFile"("id", "organizationId");

-- AddConstraint
ALTER TABLE "StaffFile"
ADD CONSTRAINT "StaffFile_invoice_metadata_check"
CHECK (
  (
    "kind" = 'INVOICE'
    AND "invoiceYear" IS NOT NULL
    AND "invoiceMonth" IS NOT NULL
    AND "invoiceMonth" BETWEEN 1 AND 12
    AND "invoiceStatus" IS NOT NULL
  )
  OR (
    "kind" = 'PERSONAL_DOCUMENT'
    AND "invoiceYear" IS NULL
    AND "invoiceMonth" IS NULL
    AND "invoiceStatus" IS NULL
    AND "paidAt" IS NULL
  )
);

-- AddForeignKey
ALTER TABLE "StaffFile" ADD CONSTRAINT "StaffFile_staffId_organizationId_fkey" FOREIGN KEY ("staffId", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFile" ADD CONSTRAINT "StaffFile_uploadedByStaffId_organizationId_fkey" FOREIGN KEY ("uploadedByStaffId", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFile" ADD CONSTRAINT "StaffFile_replacedById_organizationId_fkey" FOREIGN KEY ("replacedById", "organizationId") REFERENCES "StaffFile"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFile" ADD CONSTRAINT "StaffFile_reviewedByStaffId_organizationId_fkey" FOREIGN KEY ("reviewedByStaffId", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFile" ADD CONSTRAINT "StaffFile_deletedByStaffId_organizationId_fkey" FOREIGN KEY ("deletedByStaffId", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
