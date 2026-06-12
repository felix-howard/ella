-- CreateTable
CREATE TABLE "PaymentTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "items" JSONB NOT NULL,
    "createdByStaffId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentTemplate_organizationId_archivedAt_updatedAt_idx" ON "PaymentTemplate"("organizationId", "archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "PaymentTemplate_organizationId_name_idx" ON "PaymentTemplate"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTemplate_active_organizationId_name_key"
ON "PaymentTemplate"("organizationId", "name")
WHERE "archivedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "PaymentTemplate" ADD CONSTRAINT "PaymentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTemplate" ADD CONSTRAINT "PaymentTemplate_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
