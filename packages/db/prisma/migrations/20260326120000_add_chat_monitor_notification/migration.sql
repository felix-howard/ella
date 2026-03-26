-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionType') THEN
    CREATE TYPE "SubscriptionType" AS ENUM ('UPLOAD', 'CHAT');
  END IF;
END $$;

-- AlterTable: Add type column with default UPLOAD
ALTER TABLE "NotificationSubscription" ADD COLUMN IF NOT EXISTS "type" "SubscriptionType" NOT NULL DEFAULT 'UPLOAD';

-- Backfill existing rows (safety net)
UPDATE "NotificationSubscription" SET "type" = 'UPLOAD' WHERE "type" IS NULL;

-- Drop old unique constraint
DROP INDEX IF EXISTS "NotificationSubscription_subscriberId_targetStaffId_key";

-- CreateIndex: New unique constraint including type
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationSubscription_subscriberId_targetStaffId_type_key" ON "NotificationSubscription"("subscriberId", "targetStaffId", "type");

-- AlterTable: Add notifyOnChat to Staff
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "notifyOnChat" BOOLEAN NOT NULL DEFAULT false;
