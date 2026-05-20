-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "category" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetLabel" TEXT,
ADD COLUMN     "targetType" TEXT;

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_category_createdAt_idx" ON "ActivityLog"("organizationId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_targetType_targetId_createdAt_idx" ON "ActivityLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_actorStaffId_category_createdAt_idx" ON "ActivityLog"("actorStaffId", "category", "createdAt");
