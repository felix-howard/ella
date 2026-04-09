-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "clientGroupId" TEXT,
ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL';

-- CreateTable
CREATE TABLE "ClientGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientGroup_organizationId_idx" ON "ClientGroup"("organizationId");

-- CreateIndex
CREATE INDEX "Client_clientType_idx" ON "Client"("clientType");

-- CreateIndex
CREATE INDEX "Client_clientGroupId_idx" ON "Client"("clientGroupId");

-- AddForeignKey
ALTER TABLE "ClientGroup" ADD CONSTRAINT "ClientGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "ClientGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
