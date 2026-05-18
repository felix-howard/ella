# Security Upload Portal Hardening

**Last Updated:** 2026-05-18
**Plan:** `plans/260517-1434-security-hardening-upload-portal/plan.md`

## Current Behavior

- Portal upload links use 32-character random URL-safe tokens at `/upload/:token`.
- Portal links default to 60-day expiry via `MAGIC_LINK_EXPIRY_DAYS`.
- Staff can copy/open, resend SMS, extend 7/14/30/60 days, revoke, or replace links from Files tab.
- Active unexpired links are reused for resend instead of silently replaced.
- Portal public file lists and upload responses expose only safe labels, status, timestamps, and sequence numbers.
- Public portal never returns original filenames, AI-generated filenames, R2 keys, signed URLs, OCR text, SSNs, or raw tokens.
- Portal reads/uploads are rate limited by token hash + IP when trusted proxy headers are enabled; invalid-token probes are throttled separately.
- Current rate-limit buckets are process-local memory. Multi-instance production should use sticky routing or a shared limiter store before treating limits as globally enforced.
- Uploads validate file bytes for PDF, JPEG, PNG, WebP, HEIC, and HEIF before R2 writes or `RawImage` creation.
- Sensitive document signed URLs default to 900 seconds; staff/message proxies use private/no-store cache headers.
- Identity documents are scheduled for storage deletion after a filed case, default 90 days via `IDENTITY_DOC_RETENTION_DAYS`.
- Retention deletion removes the R2 object, preserves metadata, gates staff access with 410/disabled UI, and logs audit events.
- The retention deletion job is registered with Inngest as the daily `delete-expired-identity-docs` cron.

## Not Implemented

- Malware/virus scanning is not implemented.
- Quarantine before CPA preview/download is not implemented.
- Do not tell users uploaded files are virus-scanned until a future scanning phase ships.

## Production Rollout Checklist

- [ ] Apply DB migrations:
  - `20260517152014_add_activity_log`
  - `20260518025105_upload_link_lifecycle`
  - `20260518043301_identity_doc_retention`
- [ ] Verify `pnpm -F @ella/db migrate status` reports in sync.
- [ ] Deploy API.
- [ ] Deploy workspace.
- [ ] Deploy portal.
- [ ] Confirm `MAGIC_LINK_EXPIRY_DAYS=60` unless product chooses a different window.
- [ ] Confirm `IDENTITY_DOC_RETENTION_DAYS=90` unless compliance chooses a different window.
- [ ] Confirm `TRUST_PROXY_HEADERS=true` only when the API is behind a trusted proxy that overwrites `x-real-ip` / `x-forwarded-for`.
- [ ] For multi-instance API deploys, confirm sticky routing or replace the process-local limiter with a shared store.
- [ ] Verify an existing portal link has `expiresAt` populated.
- [ ] Generate a new upload link and confirm URL token is random, not client-name based.
- [ ] Open Files tab link manager and verify copy/open, SMS resend, extend, revoke, and replace controls.
- [ ] Upload a sample file and verify portal shows a safe label, not original filename.
- [ ] Try a renamed fake PDF/JPEG and verify `INVALID_FILE_CONTENT`.
- [ ] Open an identity document on a filed-case sample and verify retention countdown displays.
- [ ] Confirm sensitive file proxy responses include private/no-store headers.
- [ ] Review logs for no R2 keys, signed URLs, original filenames, OCR text, SSNs, or raw tokens.

## Rollback Notes

- Prefer forward-fix over rollback after migrations are applied.
- If API rollback is unavoidable, keep DB migrations in place; new nullable fields are backward-compatible.
- Revoked/replaced upload links should remain inactive after rollback.
- Do not re-enable friendly client-name portal tokens.

## Unresolved Questions

- None.
