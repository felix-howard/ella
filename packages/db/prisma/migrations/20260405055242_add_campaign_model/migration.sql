-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_organizationId_status_idx" ON "Campaign"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_organizationId_key" ON "Campaign"("slug", "organizationId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
