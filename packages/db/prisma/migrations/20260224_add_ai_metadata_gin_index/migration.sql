-- Phase 02: Add GIN index for aiMetadata JSONB queries (Phase 03 preparation)
-- This index enables efficient querying of pageInfo for multi-page document detection

CREATE INDEX IF NOT EXISTS "RawImage_aiMetadata_idx" ON "RawImage" USING GIN ("aiMetadata");
