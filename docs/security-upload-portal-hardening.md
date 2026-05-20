# Security Upload Portal Hardening

**Last Updated:** 2026-05-20
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
- Identity documents become retention-eligible when staff explicitly uses `Mark return filed` on a case, default 90 days via `IDENTITY_DOC_RETENTION_DAYS`.
- Review, verification, checklist completion, data entry, and Files tab usage are not prerequisites for identity retention scheduling.
- Filed cases show filed date plus identity retention count/date in the workspace header when scheduled identity docs exist.
- Staff can reopen a filed case to clear pending identity retention for not-yet-deleted docs.
- Staff can extend scheduled identity retention for operational exceptions by 30, 60, or 90 days.
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
- [ ] Confirm PostgreSQL PITR/backups and R2 recovery posture before enabling automated identity storage deletion.
- [ ] Before deploying/syncing the API Inngest function, run the SQL preflight queries below and review due/deleted counts.
- [ ] If the API is already deployed, pause or disable the Inngest `delete-expired-identity-docs` function until due counts are approved.
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
- [ ] Mark a sample active case with identity docs as filed using `Mark return filed`; verify no review/verify step is required.
- [ ] Confirm the workspace header shows filed date plus identity retention count/date.
- [ ] Reopen the sample filed case and verify pending identity retention clears for not-yet-deleted docs.
- [ ] Re-file the sample case and verify extension choices set a minimum deletion date from now without shortening later dates.
- [ ] On a near-due or already-due scheduled identity sample, extend retention and verify deletion dates move later.
- [ ] Upload or reclassify an identity doc on an already-filed case and verify the header reflects the newly scheduled retention row before enabling the job.
- [ ] Open an identity document on a filed-case sample and verify retention countdown displays.
- [ ] Confirm sensitive file proxy responses include private/no-store headers.
- [ ] Review logs for no R2 keys, signed URLs, original filenames, OCR text, SSNs, or raw tokens.

## Retention SQL Preflight

Run before deploying/syncing, enabling, or re-enabling the scheduled deletion job in production:

```sql
-- Identity docs pending scheduled deletion, including rows already due.
select count(*) as scheduled_identity_docs
from "RawImage"
where "retentionPolicy" = 'IDENTITY_DOCUMENT_AFTER_FILED'
  and "retentionDeleteAt" is not null
  and "retentionDeletedAt" is null
  and "isStorageDeleted" = false;

-- Identity docs due now; review this count before the first job run.
select count(*) as due_identity_docs
from "RawImage"
where "retentionPolicy" = 'IDENTITY_DOCUMENT_AFTER_FILED'
  and "retentionDeleteAt" <= now()
  and "retentionDeletedAt" is null
  and "isStorageDeleted" = false;

-- Identity docs already storage-deleted by retention.
select count(*) as retention_deleted_identity_docs
from "RawImage"
where "retentionPolicy" = 'IDENTITY_DOCUMENT_AFTER_FILED'
  and "retentionDeletedAt" is not null
  and "isStorageDeleted" = true;
```

## Operational Retention Workflow

1. Client uploads documents through the portal.
2. Staff reviews, downloads, or uses documents as needed outside Ella.
3. Staff clicks `Mark return filed` on the client/case header when the return is actually filed.
4. Ella sets the case filed state and schedules eligible identity docs for deletion after the configured retention window.
5. The daily Inngest job deletes only due storage objects, then preserves DB metadata and audit history.
6. Staff can reopen a filed case before deletion to clear pending retention, or extend scheduled retention by 30/60/90 days for exceptions.

Extension choices set a minimum deletion date from the current time and never shorten a later scheduled deletion date. For example, extending a freshly filed case by 30 days is usually a no-op when the default filed-case retention window is 90 days.

Late uploads or reclassification on an already-filed case can schedule identity retention after the original `Mark return filed` click. Those schedules still use the case `filedAt` plus the retention window, so identity docs added to an old filed case can become due immediately. Check due counts before enabling the job.

## Rollback Notes

- Prefer forward-fix over rollback after migrations are applied.
- If API rollback is unavoidable, keep DB migrations in place; new nullable fields are backward-compatible.
- Revoked/replaced upload links should remain inactive after rollback.
- Reopening a filed case is the application rollback path for pending identity retention; it clears schedules only for docs not already storage-deleted.
- Do not re-enable friendly client-name portal tokens.

## Unresolved Questions

- None.
