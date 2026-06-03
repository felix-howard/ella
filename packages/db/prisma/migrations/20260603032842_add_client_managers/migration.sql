-- CreateTable
CREATE TABLE "ClientManager" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientManager_staffId_idx" ON "ClientManager"("staffId");

-- CreateIndex
CREATE INDEX "ClientManager_clientId_idx" ON "ClientManager"("clientId");

-- CreateIndex
CREATE INDEX "ClientManager_organizationId_staffId_idx" ON "ClientManager"("organizationId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientManager_clientId_staffId_key" ON "ClientManager"("clientId", "staffId");

-- AddForeignKey
ALTER TABLE "ClientManager" ADD CONSTRAINT "ClientManager_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientManager" ADD CONSTRAINT "ClientManager_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientManager" ADD CONSTRAINT "ClientManager_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
