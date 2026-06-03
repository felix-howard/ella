/*
  Warnings:

  - A unique constraint covering the columns `[id,organizationId]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Staff` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "ClientManager" DROP CONSTRAINT "ClientManager_clientId_fkey";

-- DropForeignKey
ALTER TABLE "ClientManager" DROP CONSTRAINT "ClientManager_staffId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Client_id_organizationId_key" ON "Client"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_id_organizationId_key" ON "Staff"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "ClientManager" ADD CONSTRAINT "ClientManager_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "Client"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientManager" ADD CONSTRAINT "ClientManager_staffId_organizationId_fkey" FOREIGN KEY ("staffId", "organizationId") REFERENCES "Staff"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
