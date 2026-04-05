-- Add tag field to Campaign (default to slug for existing rows)
ALTER TABLE "Campaign" ADD COLUMN "tag" TEXT;

-- Populate tag from slug for existing campaigns
UPDATE "Campaign" SET "tag" = "slug" WHERE "tag" IS NULL;

-- Make tag NOT NULL
ALTER TABLE "Campaign" ALTER COLUMN "tag" SET NOT NULL;

-- Add unique constraint (tag, organizationId)
CREATE UNIQUE INDEX "Campaign_tag_organizationId_key" ON "Campaign"("tag", "organizationId");
