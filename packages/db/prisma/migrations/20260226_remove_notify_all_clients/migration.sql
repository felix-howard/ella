-- Drop notifyAllClients column from Staff
-- Logic simplified: Admin + notifyOnUpload=true gets ALL client uploads
-- Staff + notifyOnUpload=true gets only assigned client uploads

ALTER TABLE "Staff" DROP COLUMN "notifyAllClients";
