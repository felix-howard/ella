-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "smsLanguage" "Language" NOT NULL DEFAULT 'VI';
ALTER TABLE "Organization" ADD COLUMN "missedCallTextBack" BOOLEAN NOT NULL DEFAULT false;
