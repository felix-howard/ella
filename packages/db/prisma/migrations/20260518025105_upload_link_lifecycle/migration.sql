-- AlterTable
ALTER TABLE "MagicLink" ADD COLUMN IF NOT EXISTS "extendedAt" TIMESTAMP(3);
ALTER TABLE "MagicLink" ADD COLUMN IF NOT EXISTS "extendedById" TEXT;
ALTER TABLE "MagicLink" ADD COLUMN IF NOT EXISTS "replacedById" TEXT;
ALTER TABLE "MagicLink" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "MagicLink" ADD COLUMN IF NOT EXISTS "revokedById" TEXT;

-- Backfill legacy active upload portal links so no active PORTAL link remains non-expiring.
UPDATE "MagicLink"
SET "expiresAt" = NOW() + INTERVAL '60 days'
WHERE "type" = 'PORTAL'
  AND "isActive" = true
  AND "expiresAt" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MagicLink_revokedAt_idx" ON "MagicLink"("revokedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MagicLink_replacedById_idx" ON "MagicLink"("replacedById");
