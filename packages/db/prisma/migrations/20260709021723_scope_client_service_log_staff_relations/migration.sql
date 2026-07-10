-- DropForeignKey
ALTER TABLE "ClientServiceLog" DROP CONSTRAINT "ClientServiceLog_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ClientServiceLog" DROP CONSTRAINT "ClientServiceLog_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "ClientServiceLog" DROP CONSTRAINT "ClientServiceLog_updatedById_fkey";

-- AddForeignKey
ALTER TABLE "ClientServiceLog" ADD CONSTRAINT "ClientServiceLog_createdById_organizationId_fkey" FOREIGN KEY ("createdById", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServiceLog" ADD CONSTRAINT "ClientServiceLog_updatedById_organizationId_fkey" FOREIGN KEY ("updatedById", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientServiceLog" ADD CONSTRAINT "ClientServiceLog_deletedById_organizationId_fkey" FOREIGN KEY ("deletedById", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
