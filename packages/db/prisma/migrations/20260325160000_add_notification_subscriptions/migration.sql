-- CreateTable
CREATE TABLE IF NOT EXISTS "NotificationSubscription" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "targetStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationSubscription_subscriberId_targetStaffId_key" ON "NotificationSubscription"("subscriberId", "targetStaffId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationSubscription_subscriberId_idx" ON "NotificationSubscription"("subscriberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationSubscription_targetStaffId_idx" ON "NotificationSubscription"("targetStaffId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationSubscription_subscriberId_fkey') THEN
    ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationSubscription_targetStaffId_fkey') THEN
    ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_targetStaffId_fkey" FOREIGN KEY ("targetStaffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
