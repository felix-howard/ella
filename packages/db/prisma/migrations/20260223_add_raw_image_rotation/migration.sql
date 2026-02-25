-- Add rotation field to RawImage for persisting document orientation
-- Values: 0, 90, 180, 270 (degrees clockwise)

ALTER TABLE "RawImage" ADD COLUMN "rotation" INTEGER NOT NULL DEFAULT 0;
