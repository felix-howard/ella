ALTER TABLE "CompanyVaultCredential"
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "CompanyVaultCredential_organizationId_sortOrder_idx"
  ON "CompanyVaultCredential"("organizationId", "sortOrder");
