-- DropForeignKey
ALTER TABLE "StaffPaymentInfo" DROP CONSTRAINT "StaffPaymentInfo_updatedByStaffId_organizationId_fkey";

-- AddForeignKey
ALTER TABLE "StaffPaymentInfo" ADD CONSTRAINT "StaffPaymentInfo_updatedByStaffId_fkey" FOREIGN KEY ("updatedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
