# Phase 01 Backend Filed Action Semantics

## Context Links

- Plan: `plans/260520-1605-operational-filed-retention-workflow/plan.md`
- Existing route: `apps/api/src/routes/cases/index.ts`
- Existing service: `apps/api/src/services/identity-doc-retention.ts`
- Existing job: `apps/api/src/jobs/delete-expired-identity-docs.ts`
- Existing client API: `apps/workspace/src/lib/api-client.ts`
- Existing schema: `packages/db/prisma/schema.prisma`

## Overview

- Priority: High
- Status: complete
- Goal: make `mark-filed` the canonical operational action, independent of review/verify workflow, and keep status fields internally consistent.

## Key Insights

- Current `mark-filed` endpoint already does not require `isInReview`.
- UI currently gates filed action behind `isInReview`.
- Current endpoint sets `isFiled` and `filedAt`, but does not set `status = FILED`.
- Some code still filters active cases using `status !== 'FILED'`, so status drift can cause filed cases to appear active.
- Reopen should reverse both filed flag and enum status.

## Requirements

- `POST /cases/:id/mark-filed` must be valid for any org-scoped non-filed case.
- Mark filed must set:
  - `isFiled = true`
  - `isInReview = false`
  - `status = 'FILED'`
  - `filedAt = now`
  - `lastActivityAt = now`
- Mark filed must schedule identity retention in same transaction.
- Response should include enough data for UI: `success`, `caseId`, `status`, `isFiled`, `filedAt`, `scheduledIdentityDocs`.
- `POST /cases/:id/reopen` must clear pending retention and set:
  - `isFiled = false`
  - `isInReview = false` or `true` only if product wants review queue; choose `false` for real operations simplicity
  - `status = 'IN_PROGRESS'` or previous workflow state if available; choose `IN_PROGRESS` without schema change
  - `filedAt = null`
  - `lastActivityAt = now`
- Response should include `clearedIdentityDocs`.
- `PATCH /cases/:id` behavior must not create conflicting filed semantics. Prefer direct filed/reopen endpoints as canonical.

## Architecture

- Keep existing DB fields.
- Use scoped conditional transaction in route:
  - update `TaxCase` only when org scope and expected filed state still match
  - call `scheduleIdentityRetentionForFiledCase`
  - return update + scheduled count
- Reopen transaction:
  - update `TaxCase` only when org scope and expected filed state still match
  - call `clearScheduledIdentityRetentionForCase`
  - return cleared count
- Keep Inngest job gates unchanged: it still requires filed case plus due retention metadata.

## Related Code Files

- Modify: `apps/api/src/routes/cases/index.ts`
- Modify: `apps/workspace/src/lib/api-client.ts`
- Added: `apps/api/src/routes/cases/__tests__/case-filed-actions.test.ts`
- Added: `apps/api/src/routes/cases/__tests__/case-status-transitions.test.ts`

## Implementation Steps

1. Add response types in workspace API client for mark-filed and reopen. Done.
2. Update backend mark-filed route to set enum status and clear review flag. Done.
3. Return scheduled retention count. Done.
4. Update backend reopen route to clear status consistently and return cleared count. Done.
5. Reject generic `PATCH /cases/:id` filed/reopen transitions and require canonical endpoints. Done.
6. Add API tests. Done:
   - non-review case can be marked filed
   - mark filed schedules identity docs
   - mark filed sets `status = FILED`
   - reopen clears pending retention
   - already filed returns 400
   - org scoping still enforced
   - failed scoped writes do not schedule/clear retention
   - valid transition metadata does not advertise generic filed/reopen transitions

## Todo List

- [x] Update `mark-filed` route semantics.
- [x] Update `reopen` route semantics.
- [x] Update API client response types.
- [x] Add/adjust route tests.
- [x] Run targeted API tests.

## Validation

- `pnpm -F @ella/api test -- src/routes/cases/__tests__/case-filed-actions.test.ts src/routes/cases/__tests__/case-status-transitions.test.ts` pass, 13 tests.
- `pnpm -F @ella/api test -- src/services/__tests__/identity-doc-retention.test.ts src/jobs/__tests__/delete-expired-identity-docs.test.ts` pass, 14 tests.
- `pnpm -F @ella/api type-check` pass.
- `pnpm -F @ella/workspace type-check` pass.
- `git diff --check` pass.

## Success Criteria

- Backend supports real workflow without review prerequisite.
- Filed case has no status drift between enum and manual flags.
- Retention schedule/clear behavior remains transactional.

## Risk Assessment

- Changing `status` to `FILED` can affect active-case selection. This is desired, but UI must handle selecting older filed cases in history.
- Reopen to `IN_PROGRESS` is a product choice. Avoid previous-state restoration because no prior-state column exists.

## Security Considerations

- Mark filed schedules deletion of high-risk identity storage objects after retention window.
- Route must stay org-scoped.
- Audit logs from retention schedule must avoid filenames, R2 keys, OCR text, SSN.

## Next Steps

- Phase 02 updates UX to expose this action in the real workflow.

## Unresolved Questions

- None.
