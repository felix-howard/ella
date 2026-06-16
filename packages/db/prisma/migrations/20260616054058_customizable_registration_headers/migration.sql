-- CreateEnum
CREATE TYPE "RegistrationHeaderMode" AS ENUM ('DEFAULT', 'CUSTOM', 'HIDDEN');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "formHeaderMode" "RegistrationHeaderMode" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "formSubtitle" VARCHAR(240),
ADD COLUMN     "formTitle" VARCHAR(120);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "registrationHeaderMode" "RegistrationHeaderMode" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "registrationSubtitle" VARCHAR(240),
ADD COLUMN     "registrationTitle" VARCHAR(120);
