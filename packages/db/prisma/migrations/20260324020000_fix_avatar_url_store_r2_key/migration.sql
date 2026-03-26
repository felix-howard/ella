-- Data migration: Convert presigned R2 URLs to R2 keys in avatarUrl fields.
-- Presigned URLs expire after 7 days causing 403 errors.
-- The app now stores R2 keys and generates fresh presigned URLs on read.
--
-- Safety: COALESCE ensures if regex extraction fails, the original value is preserved (no data loss).
-- Idempotent: WHERE clause only matches http URLs, so already-converted R2 keys are skipped.

-- Extract R2 key from presigned URLs for staff avatars
-- URL format: https://<bucket>.<account>.r2.cloudflarestorage.com/avatars/<staffId>/<file>?X-Amz-...
UPDATE "Staff"
SET "avatarUrl" = COALESCE(
  SUBSTRING("avatarUrl" FROM '/(avatars/[^?]+)'),
  "avatarUrl"
)
WHERE "avatarUrl" IS NOT NULL
  AND "avatarUrl" LIKE 'http%'
  AND "avatarUrl" LIKE '%/avatars/%';

-- Extract R2 key from presigned URLs for client avatars
-- URL format: https://<bucket>.<account>.r2.cloudflarestorage.com/client-avatars/<clientId>/<file>?X-Amz-...
UPDATE "Client"
SET "avatarUrl" = COALESCE(
  SUBSTRING("avatarUrl" FROM '/(client-avatars/[^?]+)'),
  "avatarUrl"
)
WHERE "avatarUrl" IS NOT NULL
  AND "avatarUrl" LIKE 'http%'
  AND "avatarUrl" LIKE '%/client-avatars/%';
