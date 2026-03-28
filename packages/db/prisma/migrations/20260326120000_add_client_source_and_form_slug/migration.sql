-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('MANUAL', 'FORM');

-- AlterTable: Client - add source column
ALTER TABLE "Client" ADD COLUMN "source" "ClientSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable: Staff - add formSlug column
ALTER TABLE "Staff" ADD COLUMN "formSlug" TEXT;

-- AlterTable: Organization - add autoSendFormClientUploadLink column
ALTER TABLE "Organization" ADD COLUMN "autoSendFormClientUploadLink" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Client_source_idx" ON "Client"("source");

-- CreateIndex (unique compound, partial - only where formSlug is not null)
CREATE UNIQUE INDEX "Staff_organizationId_formSlug_key" ON "Staff"("organizationId", "formSlug");
