# Portal Rate Limits Phase 07

**Date**: 2026-05-18 14:04
**Severity**: High
**Component**: Public portal read/upload rate limiting
**Status**: Resolved

## What Happened

Phase 07 hardened the public portal with token-aware and IP-aware rate limits for reads and uploads. We added hashed token buckets, invalid-token pre-validation throttling, audit logs for valid-token rate-limit hits, `Retry-After` 429 responses, localized 429 handling in the portal, React Query retry suppression for `RATE_LIMITED` and expired/invalid links, and delayed magic-link usage stats until the request survives rate-limit checks.

## The Brutal Truth

This was not clean work. The first pass still trusted spoofable forwarded headers, did DB work before the invalid-token cooldown fired, and let usage mutations run on valid 429 responses. That is exactly the kind of sloppy edge-case handling that burns security hardening effort and makes the limiter look finished when it is not.

## Technical Details

Implemented and fixed in the portal/API path with:
- `TRUST_PROXY_HEADERS` for trusted proxy header handling
- hashed token + IP bucket keys instead of raw token keys
- invalid-token cooldown before any expensive DB work
- valid-token rate-limit audit logging
- `Retry-After` on 429 responses
- localized portal 429 UI handling
- React Query retry suppression for `RATE_LIMITED`, invalid, and expired links
- magic-link usage stats only after rate-limit pass

Regression coverage landed for:
- invalid-token cooldown
- spoofed forwarded headers
- token isolation
- 50-file upload
- valid upload/read throttling

Validation passed:
- `pnpm -F @ella/api test -- portal-rate-limit`
- `pnpm -F @ella/api test -- portal-upload-privacy`
- `pnpm -F @ella/api type-check`
- `pnpm -F @ella/portal type-check`

## What We Tried

- Started with token-only rate limiting, then switched to hashed token + IP buckets after review.
- Moved invalid-token throttling earlier to stop useless DB work.
- Removed retry amplification on the client after 429s kept triggering follow-up requests.

## Root Cause Analysis

We treated rate limiting like a single middleware problem when it was really a cross-cutting security path. The bug came from trusting the wrong request metadata and from letting downstream mutations continue after a hard reject. The limiter needed to own the whole request lifecycle, not just the response code.

## Lessons Learned

Security hardening needs tests for spoofing, retry loops, and side effects after rejection. If a 429 still mutates state or triggers retries, the fix is incomplete.

## Next Steps

Phase 07 is done. Next work should start from the portal security backlog and keep proxy trust rules, retry behavior, and mutation side effects in the same review surface.
