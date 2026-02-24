-- Phase 02: Fallback Smart Rename
-- Add aiMetadata JSON field to RawImage for storing fallback rename data and multi-page detection info

ALTER TABLE "RawImage" ADD COLUMN "aiMetadata" JSONB;

-- COMMENT: aiMetadata stores { fallbackRename: boolean, documentTitle: string, pageInfo: {...}, reasoning: string }
