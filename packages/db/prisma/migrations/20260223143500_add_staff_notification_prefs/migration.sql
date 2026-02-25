-- AlterTable: Add notification preference fields to Staff
ALTER TABLE "Staff" ADD COLUMN "notifyOnUpload" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Staff" ADD COLUMN "notifyAllClients" BOOLEAN NOT NULL DEFAULT false;
