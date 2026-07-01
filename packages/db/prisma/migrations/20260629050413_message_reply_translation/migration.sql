-- CreateEnum
CREATE TYPE "ConversationReplyMode" AS ENUM ('DIRECT', 'EN_TO_VI');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "replyMode" "ConversationReplyMode" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "contentLanguage" "Language",
ADD COLUMN     "staffAuthoredContent" VARCHAR(5000),
ADD COLUMN     "staffAuthoredLanguage" "Language",
ADD COLUMN     "translationEdited" BOOLEAN NOT NULL DEFAULT false;
