-- Add avatar and notes fields to Client model for Overview tab
-- AlterTable
ALTER TABLE "Client" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "Client" ADD COLUMN "notes" TEXT;
ALTER TABLE "Client" ADD COLUMN "notesUpdatedAt" TIMESTAMP(3);
