-- Resolve schema drift from previous db push usage
-- Aligns migration history with actual DB state

-- Client.firstName: DB already has default '' from db push, this records it in migrations
ALTER TABLE "Client" ALTER COLUMN "firstName" SET DEFAULT '';
