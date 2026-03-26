-- AlterTable
ALTER TABLE "Message" ADD COLUMN "sentById" TEXT;

-- CreateIndex
CREATE INDEX "Message_sentById_idx" ON "Message"("sentById");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
