-- AddEnumValue: Add TAX_RETURNS to DocCategory enum
-- This value supports classification of tax return documents (1040 family, state returns, transcripts)

ALTER TYPE "DocCategory" ADD VALUE IF NOT EXISTS 'TAX_RETURNS';
