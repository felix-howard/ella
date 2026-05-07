-- Add firm contact fields used by agreement headers/default templates.
ALTER TABLE "Organization"
  ADD COLUMN "firmPhone" TEXT,
  ADD COLUMN "firmEmail" TEXT,
  ADD COLUMN "firmWebsite" TEXT;

-- New agreements default to a 30-day signing window.
-- Existing rows keep their stored expiryDays values.
ALTER TABLE "Agreement"
  ALTER COLUMN "expiryDays" SET DEFAULT 30;
