# Portal Filename Privacy Phase 04

**Date**: 2026-05-18 10:57
**Severity**: High
**Component**: Public portal upload API
**Status**: Resolved

## What Happened

Phase 04 stopped the public upload portal from exposing uploaded filenames back to clients. `GET /portal/:token?caseId=` now returns safe upload summaries only, and `POST /portal/:token/upload` returns the same safe shape instead of echoing original filenames.

## Technical Details

Implemented in:
- `apps/api/src/routes/portal/index.ts`
- `apps/api/src/routes/portal/__tests__/portal-upload-privacy.test.ts`
- `apps/portal/src/lib/api-client.ts`
- `apps/portal/src/components/uploaded-file-row.tsx`
- `apps/portal/src/locales/en.json`
- `apps/portal/src/locales/vi.json`

Public responses now use `safeLabel`, `status`, `createdAt`, and `sequenceNumber`. Original filenames still store internally for CPA workflows, but public portal JSON and UI no longer render `filename` or `displayName`.

Review found a concurrent upload sequence risk. Fixed by assigning POST response sequence numbers inside a per-case advisory-lock transaction.

Validation passed:
- `pnpm -F @ella/api test -- portal`
- `pnpm -F @ella/portal type-check`
- `pnpm -F @ella/api type-check`

## Lessons Learned

Public API response contracts need privacy tests, not just UI changes. Safe labels also need deterministic behavior under concurrent uploads, because clients can use POST responses directly even when the UI refetches.

## Next Steps

Continue with Phase 05 identity document retention backend.
