-- AlterEnum: Add DELIVERED and UNDELIVERED to SmsSendStatus
ALTER TYPE "SmsSendStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "SmsSendStatus" ADD VALUE IF NOT EXISTS 'UNDELIVERED';

-- CreateIndex: Add index on twilioSid for SmsSendLog (status webhook lookup)
CREATE INDEX IF NOT EXISTS "SmsSendLog_twilioSid_idx" ON "SmsSendLog"("twilioSid");
