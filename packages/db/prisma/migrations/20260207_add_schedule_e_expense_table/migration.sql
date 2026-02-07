-- AlterEnum
ALTER TYPE "MagicLinkType" ADD VALUE 'SCHEDULE_E';

-- CreateEnum
CREATE TYPE "ScheduleEStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- CreateTable
CREATE TABLE "ScheduleEExpense" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "status" "ScheduleEStatus" NOT NULL DEFAULT 'DRAFT',
    "properties" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionHistory" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEExpense_taxCaseId_key" ON "ScheduleEExpense"("taxCaseId");
CREATE INDEX "ScheduleEExpense_status_idx" ON "ScheduleEExpense"("status");
CREATE INDEX "ScheduleEExpense_taxCaseId_status_idx" ON "ScheduleEExpense"("taxCaseId", "status");
CREATE INDEX "ScheduleEExpense_lockedById_idx" ON "ScheduleEExpense"("lockedById");

-- AddForeignKey
ALTER TABLE "ScheduleEExpense" ADD CONSTRAINT "ScheduleEExpense_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "TaxCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
