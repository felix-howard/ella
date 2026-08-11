-- CreateEnum
CREATE TYPE "GoogleDriveConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ClientDriveFolderStatus" AS ENUM ('NOT_STARTED', 'CREATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "GoogleDriveConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "rootFolderId" TEXT NOT NULL,
  "rootFolderName" TEXT,
  "rootFolderWebUrl" TEXT,
  "adminGroupEmail" TEXT,
  "googleAccountEmail" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT NOT NULL,
  "connectedByStaffId" TEXT,
  "status" "GoogleDriveConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "lastCheckedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GoogleDriveConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDriveFolder" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerClientId" TEXT NOT NULL,
  "clientGroupId" TEXT,
  "folderName" TEXT NOT NULL,
  "rootFolderId" TEXT,
  "rootFolderWebUrl" TEXT,
  "amWorkFolderId" TEXT,
  "amWorkFolderWebUrl" TEXT,
  "corpAdminFolderId" TEXT,
  "corpAdminFolderWebUrl" TEXT,
  "sharedFolderId" TEXT,
  "sharedFolderWebUrl" TEXT,
  "status" "ClientDriveFolderStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "inputSnapshot" JSONB NOT NULL DEFAULT '{}',
  "permissionSnapshot" JSONB NOT NULL DEFAULT '{}',
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdByStaffId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientDriveFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleDriveConnection_organizationId_key" ON "GoogleDriveConnection"("organizationId");

-- CreateIndex
CREATE INDEX "GoogleDriveConnection_organizationId_status_idx" ON "GoogleDriveConnection"("organizationId", "status");

-- CreateIndex
CREATE INDEX "GoogleDriveConnection_connectedByStaffId_idx" ON "GoogleDriveConnection"("connectedByStaffId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientDriveFolder_ownerClientId_organizationId_key" ON "ClientDriveFolder"("ownerClientId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientGroup_id_organizationId_key" ON "ClientGroup"("id", "organizationId");

-- CreateIndex
CREATE INDEX "ClientDriveFolder_organizationId_status_idx" ON "ClientDriveFolder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ClientDriveFolder_organizationId_ownerClientId_idx" ON "ClientDriveFolder"("organizationId", "ownerClientId");

-- CreateIndex
CREATE INDEX "ClientDriveFolder_organizationId_clientGroupId_idx" ON "ClientDriveFolder"("organizationId", "clientGroupId");

-- CreateIndex
CREATE INDEX "ClientDriveFolder_createdByStaffId_idx" ON "ClientDriveFolder"("createdByStaffId");

-- AddForeignKey
ALTER TABLE "GoogleDriveConnection" ADD CONSTRAINT "GoogleDriveConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleDriveConnection" ADD CONSTRAINT "GoogleDriveConnection_connectedByStaffId_fkey" FOREIGN KEY ("connectedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDriveFolder" ADD CONSTRAINT "ClientDriveFolder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDriveFolder" ADD CONSTRAINT "ClientDriveFolder_ownerClientId_organizationId_fkey" FOREIGN KEY ("ownerClientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDriveFolder" ADD CONSTRAINT "ClientDriveFolder_clientGroupId_organizationId_fkey" FOREIGN KEY ("clientGroupId", "organizationId") REFERENCES "ClientGroup"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDriveFolder" ADD CONSTRAINT "ClientDriveFolder_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
