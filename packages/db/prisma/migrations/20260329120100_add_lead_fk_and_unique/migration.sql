-- AddForeignKey: Lead.convertedToId -> Client.id
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedToId_fkey" FOREIGN KEY ("convertedToId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: unique constraint on phone + organizationId
CREATE UNIQUE INDEX "Lead_phone_organizationId_key" ON "Lead"("phone", "organizationId");

-- DropIndex: redundant single-column organizationId index (covered by composite)
DROP INDEX "Lead_organizationId_idx";
