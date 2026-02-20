-- Simplify MessageTemplateCategory enum from 8 values to 3:
-- Keep: SCHEDULE_C, SCHEDULE_E
-- Rename: WELCOME -> PORTAL_LINK
-- Remove: REMINDER, MISSING, BLURRY, COMPLETE, GENERAL

-- Step 1: Delete templates with categories that will be removed
DELETE FROM "MessageTemplate" WHERE category IN ('REMINDER', 'MISSING', 'BLURRY', 'COMPLETE', 'GENERAL');

-- Step 2: Create new enum with desired values
CREATE TYPE "MessageTemplateCategory_new" AS ENUM ('PORTAL_LINK', 'SCHEDULE_C', 'SCHEDULE_E');

-- Step 3: Update existing WELCOME templates to PORTAL_LINK (via text conversion)
ALTER TABLE "MessageTemplate"
  ALTER COLUMN "category" TYPE text;

UPDATE "MessageTemplate" SET category = 'PORTAL_LINK' WHERE category = 'WELCOME';

-- Step 4: Convert to new enum type
ALTER TABLE "MessageTemplate"
  ALTER COLUMN "category" TYPE "MessageTemplateCategory_new" USING category::"MessageTemplateCategory_new";

-- Step 5: Drop old enum and rename new one
DROP TYPE "MessageTemplateCategory";
ALTER TYPE "MessageTemplateCategory_new" RENAME TO "MessageTemplateCategory";
