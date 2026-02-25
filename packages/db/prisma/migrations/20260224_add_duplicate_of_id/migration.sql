-- Add duplicateOfId field to track which image a duplicate matches
-- This enables showing "Duplicate of: [filename]" in UI

ALTER TABLE "RawImage" ADD COLUMN IF NOT EXISTS "duplicateOfId" TEXT;
