-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'LEAD_REPLIED';

-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "leadId" TEXT,
ALTER COLUMN "caseId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Action_leadId_idx" ON "Action"("leadId");

-- CreateIndex
CREATE INDEX "Action_leadId_type_isCompleted_idx" ON "Action"("leadId", "type", "isCompleted");

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce polymorphic owner: exactly one of caseId / leadId must be non-null.
-- Use DO block for idempotency in case migration is re-applied manually.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'action_owner_xor'
  ) THEN
    ALTER TABLE "Action"
      ADD CONSTRAINT "action_owner_xor"
      CHECK (("caseId" IS NULL) <> ("leadId" IS NULL));
  END IF;
END$$;
