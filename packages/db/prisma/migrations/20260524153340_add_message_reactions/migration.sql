-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "reactions" JSONB NOT NULL DEFAULT '[]';
