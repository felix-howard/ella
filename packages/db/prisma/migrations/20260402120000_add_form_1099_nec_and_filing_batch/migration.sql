-- CreateEnum
CREATE TYPE "Form1099Status" AS ENUM ('DRAFT', 'VALIDATED', 'IMPORTED', 'PDF_READY', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Form1099NEC" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "batchId" TEXT,
    "taxYear" INTEGER NOT NULL,
    "amountBox1" DECIMAL(12,2) NOT NULL,
    "amountBox4" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pdfStorageKey" TEXT,
    "status" "Form1099Status" NOT NULL DEFAULT 'DRAFT',
    "tax1099FormId" INTEGER,
    "validationErrors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "efileSubmittedAt" TIMESTAMP(3),
    "efileStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form1099NEC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilingBatch" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Form1099NEC_contractorId_taxYear_key" ON "Form1099NEC"("contractorId", "taxYear");

-- CreateIndex
CREATE INDEX "Form1099NEC_batchId_idx" ON "Form1099NEC"("batchId");

-- CreateIndex
CREATE INDEX "Form1099NEC_status_idx" ON "Form1099NEC"("status");

-- CreateIndex
CREATE INDEX "FilingBatch_clientId_idx" ON "FilingBatch"("clientId");

-- AddForeignKey
ALTER TABLE "Form1099NEC" ADD CONSTRAINT "Form1099NEC_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form1099NEC" ADD CONSTRAINT "Form1099NEC_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FilingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingBatch" ADD CONSTRAINT "FilingBatch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
