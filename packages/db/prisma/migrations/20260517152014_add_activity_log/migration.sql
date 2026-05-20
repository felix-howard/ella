-- CreateEnum
CREATE TYPE "ActivityActorType" AS ENUM ('STAFF', 'CLIENT_PORTAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "clientId" TEXT,
    "caseId" TEXT,
    "rawImageId" TEXT,
    "magicLinkId" TEXT,
    "actorType" "ActivityActorType" NOT NULL,
    "actorStaffId" TEXT,
    "action" TEXT NOT NULL,
    "riskLevel" "ActivityRiskLevel" NOT NULL DEFAULT 'LOW',
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "route" TEXT,
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_createdAt_idx" ON "ActivityLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_clientId_createdAt_idx" ON "ActivityLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_caseId_createdAt_idx" ON "ActivityLog"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_rawImageId_createdAt_idx" ON "ActivityLog"("rawImageId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_actorStaffId_createdAt_idx" ON "ActivityLog"("actorStaffId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_magicLinkId_createdAt_idx" ON "ActivityLog"("magicLinkId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");
