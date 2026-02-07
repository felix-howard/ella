-- AlterEnum (drop-and-recreate to work inside transaction)
CREATE TYPE "MagicLinkType_new" AS ENUM ('PORTAL', 'SCHEDULE_C', 'SCHEDULE_E');
ALTER TABLE "MagicLink" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "MagicLink" ALTER COLUMN "type" TYPE "MagicLinkType_new" USING ("type"::text::"MagicLinkType_new");
ALTER TYPE "MagicLinkType" RENAME TO "MagicLinkType_old";
ALTER TYPE "MagicLinkType_new" RENAME TO "MagicLinkType";
DROP TYPE "MagicLinkType_old";
ALTER TABLE "MagicLink" ALTER COLUMN "type" SET DEFAULT 'PORTAL';
