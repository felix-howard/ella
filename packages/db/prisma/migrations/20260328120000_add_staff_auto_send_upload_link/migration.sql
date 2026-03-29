-- AlterTable: Add autoSendUploadLink to Staff
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "autoSendUploadLink" BOOLEAN NOT NULL DEFAULT false;
