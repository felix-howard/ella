CREATE TABLE IF NOT EXISTS "CompanyVaultCredential" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "toolName" VARCHAR(120) NOT NULL,
  "usernameEncrypted" TEXT,
  "passwordEncrypted" TEXT,
  "noteEncrypted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyVaultCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompanyVaultCredential_organizationId_toolName_idx"
  ON "CompanyVaultCredential"("organizationId", "toolName");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompanyVaultCredential_organizationId_fkey'
  ) THEN
    ALTER TABLE "CompanyVaultCredential"
      ADD CONSTRAINT "CompanyVaultCredential_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
