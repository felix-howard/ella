# Phase 03 Retention Visibility And Extension

## Context Links

- Plan: `plans/260520-1605-operational-filed-retention-workflow/plan.md`
- Retention badge: `apps/workspace/src/components/files/identity-retention-badge.tsx`
- Retention helper: `apps/workspace/src/components/files/identity-retention.ts`
- Files tab: `apps/workspace/src/components/files/files-tab.tsx`
- Backend service: `apps/api/src/services/identity-doc-retention.ts`
- Backend routes: `apps/api/src/routes/cases/index.ts`

## Overview

- Priority: Medium
- Status: complete
- Goal: make filed/retention state visible and provide a simple operational escape hatch to extend scheduled deletion.

## Key Insights

- Files tab already shows per-file retention countdown, but CPA may not use Files tab.
- Header should communicate filed state.
- Extension is useful for exceptions without disabling retention globally.
- Excluding individual files from retention is powerful but higher-risk; defer unless explicitly needed.

## Requirements

- Add `filedAt` to `TaxCaseSummary` and client detail response if missing.
- Show filed date in client/case header when `isFiled`.
- Show retention summary message:
  - if filed: identity docs follow retention policy
  - if scheduled docs exist and data available: show next deletion date/count
  - if no data available: use policy wording without false precision
- Add backend endpoint to extend scheduled identity retention for a case:
  - `POST /cases/:id/identity-retention/extend`
  - body: `{ days: 30 | 60 | 90 }` or `{ until: ISO date }`; choose days for simpler UI
  - only affects docs with `retentionPolicy = IDENTITY_DOCUMENT_AFTER_FILED`, `retentionDeleteAt != null`, not deleted
  - sets `retentionDeleteAt = max(current retentionDeleteAt, now + days)`
  - logs audit action without filenames/keys
- Add UI menu/button on filed case:
  - `Extend identity retention`
  - choices: 30, 60, 90 days
  - confirmation text explains this delays deletion for scheduled identity docs
- Reuse existing Files tab badges; do not duplicate per-file list in header.

## Architecture

- Backend route under cases keeps org scoping.
- Service helper can update scheduled docs in bulk and return count + newest/earliest date.
- UI can live near filed/reopen action or in Files tab notice.
- No schema change.

## Related Code Files

- Modify: `apps/api/src/routes/cases/index.ts`
- Modify: `apps/api/src/services/identity-doc-retention.ts`
- Modify: `apps/workspace/src/lib/api-client.ts`
- Modify: `apps/workspace/src/routes/clients/$clientId.tsx`
- Modify: `apps/workspace/src/components/cases/case-filed-action.tsx`
- Modify: `packages/ui/src/components/modal.tsx`
- Modify: `apps/workspace/src/locales/en.json`
- Modify: `apps/workspace/src/locales/vi.json`
- Add/modify tests:
  - `apps/api/src/services/__tests__/identity-doc-retention.test.ts`
  - `apps/api/src/jobs/__tests__/delete-expired-identity-docs.test.ts`
  - `apps/api/src/routes/cases/__tests__/case-filed-actions.test.ts`
  - `apps/workspace/src/components/cases/case-filed-action.test.tsx`

## Implementation Steps

1. Add `filedAt` to client detail API payload and TypeScript types.
2. Add service helper `extendScheduledIdentityRetentionForCase(caseId, days, db)`.
3. Add org-scoped route and zod body schema.
4. Add audit activity for extension.
5. Add workspace API client method.
6. Add filed-state display in header.
7. Add extend retention UI with confirmation.
8. Keep per-file badge behavior unchanged.

## Todo List

- [x] Add filedAt to client detail typing/payload.
- [x] Add extension service helper.
- [x] Add extension endpoint and tests.
- [x] Add workspace API method.
- [x] Add header filed/retention display.
- [x] Add extend retention UI.
- [x] Run API and workspace targeted tests.

## Validation

- `pnpm -F @ella/api test -- src/services/__tests__/identity-doc-retention.test.ts src/jobs/__tests__/delete-expired-identity-docs.test.ts src/routes/cases/__tests__/case-filed-actions.test.ts` pass, 27 tests.
- `pnpm -F @ella/workspace test -- case-filed-action.test.tsx` pass, 5 tests.
- `pnpm -F @ella/api type-check` pass.
- `pnpm -F @ella/workspace type-check` pass.
- `pnpm -F @ella/api lint` pass.
- `pnpm -F @ella/workspace lint` pass with 0 errors and 9 pre-existing warnings outside touched files.
- `git diff --check` pass.

## Success Criteria

- Staff can see a case is filed without opening Files tab.
- Staff can delay pending identity deletion for exceptions.
- Extension cannot resurrect already-deleted storage objects.
- Audit logs preserve sensitive-data redaction.

## Risk Assessment

- Bulk extension must not touch non-identity docs.
- Header summary should not imply exact deletion dates unless backend data supports it.

## Security Considerations

- Extension should be logged at medium/high risk.
- Do not add file names, R2 keys, signed URLs, OCR, or SSN to extension metadata.

## Next Steps

- Phase 04 validates full workflow and updates docs.

## Completion Notes

- Completed 2026-05-20.
- Added `POST /cases/:id/identity-retention/extend` with 30/60/90 day choices, org-scoped filed-case checks, awaited audit logging, and redacted metadata.
- Extension uses guarded `updateMany` predicates so it cannot race deleted or in-progress retention rows, and refresh preserves later manual extension dates.
- Client detail now returns an unpaginated `identityRetentionSummary` per case; the header uses this summary instead of the first `/images` page.
- Filed header displays filed date plus retention policy/count/date. Extend action appears only when scheduled identity docs exist.
- Mark-filed, reopen, and extend invalidate client, case image, and group-image caches.
- Shared modal now traps focus and restores prior focus for confirmation dialogs.

## Unresolved Questions

- None.
