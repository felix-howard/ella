# Comprehensive User Activity Log Phase 01

**Date**: 2026-05-20 18:16
**Severity**: High
**Component**: Activity log taxonomy, redaction, and timeline delivery
**Status**: Resolved

## What Happened

Phase 01 landed the core user activity log model. We added typed `ActivityLog` taxonomy/actions, display-safe `category`, `target`, and `summary` fields, Prisma migration `20260520110349_add_activity_log_display_fields`, expanded metadata redaction for messages/text/phone/email/address/avatar/signature, safe timeline DTO mapping, trusted-proxy IP capture through `getClientIp`, and enrichment for document, upload-link, portal, and retention logs.

## The Brutal Truth

The old shape was too easy to misuse. Raw metadata and inconsistent action typing make audit trails look complete while still leaking details or lying about what happened. That is a bad place to be for compliance work, and it would have stayed ugly if we had not forced the log layer to become explicit and display-safe.

## Technical Details

Key changes:
- typed `ActivityLog` taxonomy/actions
- display-safe `category`, `target`, `summary`
- Prisma migration `20260520110349_add_activity_log_display_fields`
- metadata redaction expanded to messages, text, phone, email, address, avatar, and signature
- safe timeline DTO mapping
- client IP capture via trusted-proxy `getClientIp`
- enriched log coverage for document, upload-link, portal, and retention events

Validation passed:
- `pnpm -F @ella/db generate`
- `pnpm -F @ella/db exec dotenv -e ../../.env -- prisma migrate status`
- `pnpm -F @ella/api test -- activity-log activity-actions upload-links portal-rate-limit document-access-hardening case-filed-actions identity-doc-retention delete-expired-identity-docs activity-logging`
- `pnpm -F @ella/api type-check`
- `git diff --check`

## What We Tried

- Kept the existing log payloads and only patched the UI layer. That was not enough because the source data itself was still unsafe.
- Redacted only obvious PII fields. That missed enough variants to still be risky, so we widened the redaction set.
- Used raw event data in the timeline DTO. That would have leaked implementation detail into the client, so we switched to a safe mapping layer.

## Root Cause Analysis

The root cause was treating activity logging like a simple append-only record instead of a security-sensitive contract. Once logs started carrying richer metadata, the old model had no clean place to separate operational detail from display-safe output.

## Lessons Learned

If a log can reach a client, it needs a deliberate schema and a redaction boundary. Also, IP capture must be explicit about trusted proxies or it becomes junk data that looks authoritative.

## Next Steps

Phase 01 is done. Verify later phases keep adding actions and enrichment through the same safe mapping path instead of bypassing the taxonomy.

## Unresolved Questions

- Do all deployment paths set trusted proxy handling consistently enough for `getClientIp` to stay accurate?
- Should future activity types share one redaction helper or stay feature-local until the taxonomy settles?
