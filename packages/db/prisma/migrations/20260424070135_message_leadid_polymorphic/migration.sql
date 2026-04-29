-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "leadId" TEXT,
ALTER COLUMN "conversationId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Message_leadId_createdAt_idx" ON "Message"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce polymorphic owner: exactly one of conversationId / leadId must be non-null.
-- Use DO block for idempotency in case migration is re-applied manually.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_owner_xor'
  ) THEN
    ALTER TABLE "Message"
      ADD CONSTRAINT "message_owner_xor"
      CHECK (("conversationId" IS NULL) <> ("leadId" IS NULL));
  END IF;
END$$;

-- Backfill: convert historical SmsSendLog rows (with twilioSid) into lead-owned Messages.
-- Guarded by NOT EXISTS on twilioSid so the statement is safe to re-run.
-- SmsSendLog rows without a twilioSid (failed sends that never reached carrier) are intentionally skipped.
INSERT INTO "Message"
  (id, "leadId", "conversationId", direction, channel, content,
   "twilioSid", "twilioStatus", "sentById", "createdAt", "updatedAt")
SELECT
  'mlg_' || substr(md5(random()::text || clock_timestamp()::text), 1, 22),
  s."leadId",
  NULL,
  'OUTBOUND'::"MessageDirection",
  'SMS'::"MessageChannel",
  LEFT(s.message, 5000),
  s."twilioSid",
  s.status::text,
  s."sentById",
  s."sentAt",
  s."sentAt"
FROM "SmsSendLog" s
WHERE s."twilioSid" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Message" m WHERE m."twilioSid" = s."twilioSid"
  );
