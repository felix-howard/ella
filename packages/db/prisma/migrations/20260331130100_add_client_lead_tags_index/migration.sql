-- Record existing GIN indexes in migration history (already exist in DB)
CREATE INDEX IF NOT EXISTS "Client_tags_idx" ON "Client" USING gin ("tags");
CREATE INDEX IF NOT EXISTS "Lead_tags_idx" ON "Lead" USING gin ("tags");
