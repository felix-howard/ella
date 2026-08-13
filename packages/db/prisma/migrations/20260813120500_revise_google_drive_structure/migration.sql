-- Preserve existing folder ids while renaming the admin folder contract.
ALTER TABLE "ClientDriveFolder" RENAME COLUMN "corpAdminFolderId" TO "officeAdminFolderId";
ALTER TABLE "ClientDriveFolder" RENAME COLUMN "corpAdminFolderWebUrl" TO "officeAdminFolderWebUrl";

-- Staff Google Drive targets. Empty array means fall back to Staff.email.
ALTER TABLE "Staff" ADD COLUMN "driveEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Durable Drive node records for fixed folders and per-business folder trees.
CREATE TABLE "ClientDriveFolderNode" (
  "id" TEXT NOT NULL,
  "clientDriveFolderId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerClientId" TEXT NOT NULL,
  "businessClientId" TEXT,
  "role" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "driveFolderId" TEXT,
  "webViewLink" TEXT,
  "parentDriveFolderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientDriveFolderNode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientDriveFolderNode_folder_role_business_key"
  ON "ClientDriveFolderNode"("clientDriveFolderId", "role", "businessClientId");

CREATE UNIQUE INDEX "ClientDriveFolderNode_fixed_role_unique"
  ON "ClientDriveFolderNode"("clientDriveFolderId", "role")
  WHERE "businessClientId" IS NULL;

CREATE INDEX "ClientDriveFolderNode_organization_owner_idx"
  ON "ClientDriveFolderNode"("organizationId", "ownerClientId");

CREATE INDEX "ClientDriveFolderNode_organization_business_idx"
  ON "ClientDriveFolderNode"("organizationId", "businessClientId");

CREATE INDEX "ClientDriveFolderNode_clientDriveFolderId_idx"
  ON "ClientDriveFolderNode"("clientDriveFolderId");

CREATE INDEX "ClientDriveFolderNode_driveFolderId_idx"
  ON "ClientDriveFolderNode"("driveFolderId");

CREATE UNIQUE INDEX "ClientDriveFolder_id_organizationId_key"
  ON "ClientDriveFolder"("id", "organizationId");

ALTER TABLE "ClientDriveFolderNode" ADD CONSTRAINT "ClientDriveFolderNode_clientDriveFolderId_organizationId_fkey"
  FOREIGN KEY ("clientDriveFolderId", "organizationId") REFERENCES "ClientDriveFolder"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientDriveFolderNode" ADD CONSTRAINT "ClientDriveFolderNode_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientDriveFolderNode" ADD CONSTRAINT "ClientDriveFolderNode_ownerClientId_organizationId_fkey"
  FOREIGN KEY ("ownerClientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientDriveFolderNode" ADD CONSTRAINT "ClientDriveFolderNode_businessClientId_organizationId_fkey"
  FOREIGN KEY ("businessClientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
