-- Record existing index in migration history (already exists in DB)
CREATE INDEX IF NOT EXISTS "RawImage_aiMetadata_idx" ON "RawImage"("aiMetadata");
