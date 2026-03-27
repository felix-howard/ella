-- CreateTable
CREATE TABLE IF NOT EXISTS "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfR2Key" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TermsAcceptance_staffId_version_key" ON "TermsAcceptance"("staffId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TermsAcceptance_staffId_idx" ON "TermsAcceptance"("staffId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TermsAcceptance_version_idx" ON "TermsAcceptance"("version");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TermsAcceptance_staffId_fkey'
    ) THEN
        ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
