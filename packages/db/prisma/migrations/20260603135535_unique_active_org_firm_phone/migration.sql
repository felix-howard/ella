-- Enforce unique Twilio firm phone ownership for active organizations.
-- Inbound voice/SMS webhooks depend on this as a tenant-routing boundary.
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_active_firmPhone_key"
ON "Organization"("firmPhone")
WHERE "isActive" = true
  AND "firmPhone" IS NOT NULL;
