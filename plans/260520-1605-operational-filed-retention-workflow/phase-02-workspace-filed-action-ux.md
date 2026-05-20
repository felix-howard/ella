# Phase 02 Workspace Filed Action UX

## Context Links

- Plan: `plans/260520-1605-operational-filed-retention-workflow/plan.md`
- Client route: `apps/workspace/src/routes/clients/$clientId.tsx`
- Existing confirm modal pattern: `apps/workspace/src/components/upload-links/upload-link-confirm-modal.tsx`
- Locale files: `apps/workspace/src/locales/en.json`, `apps/workspace/src/locales/vi.json`
- API client: `apps/workspace/src/lib/api-client.ts`

## Overview

- Priority: High
- Status: complete
- Goal: expose a simple `Mark return filed` action in the client/case header, not blocked by review/verify workflow.

## Key Insights

- Current UI only shows filed action when `isInReview && !isFiled`.
- CPA real workflow: upload docs, use docs outside app, file tax return, then mark filed.
- Confirmation is required because the action starts identity retention countdown.

## Requirements

- Show primary `Mark return filed` button whenever:
  - active case exists
  - active case is not filed
  - user has permission to update case
- Do not require `ENTRY_COMPLETE`, `REVIEW`, verified docs, Files tab usage, or checklist completion.
- Keep `Send to review` available only as secondary workflow, not prerequisite.
- On click, open confirmation modal:
  - explain case will be marked filed
  - explain identity docs will be scheduled for storage deletion after configured retention window
  - mention DB metadata/audit remains
- On confirm, call `api.cases.markFiled`.
- On success:
  - invalidate client query
  - toast with scheduled count if returned
  - close modal
- Filed state should show `Reopen filing` action with confirmation:
  - explain pending identity deletion schedule will be cleared for not-yet-deleted docs
  - call `api.cases.reopen`
- Rename labels from generic `Mark as Filed` to operational language:
  - English: `Mark return filed`
  - Vietnamese: `Đánh dấu đã nộp tờ khai`

## Architecture

- Add small local confirmation state in `clients/$clientId.tsx`, or extract `case-filed-action.tsx` if header gets too large.
- Reuse modal primitives from `@ella/ui`.
- Avoid new global state.
- Keep action next to upload/messages/agreement actions in header.

## Related Code Files

- Modify: `apps/workspace/src/routes/clients/$clientId.tsx`
- Modify: `apps/workspace/src/locales/en.json`
- Modify: `apps/workspace/src/locales/vi.json`
- Possibly create: `apps/workspace/src/components/cases/case-filed-action.tsx`
- Possibly test: `apps/workspace/src/components/cases/case-filed-action.test.tsx`

## Implementation Steps

1. Add locale strings for filed confirmation, reopen confirmation, scheduled-count toast.
2. Change filed button visibility to `activeCase && !isFiled`.
3. Add confirmation modal before mutation.
4. Add filed-state confirmation for reopen.
5. Keep `Send to Review` as secondary and do not block filing.
6. Update mutation success handlers to use new backend payload.
7. Add component test if action extracted:
   - non-review case shows mark filed
   - filed case shows reopen
   - confirmation text mentions retention

## Todo List

- [x] Add/adjust i18n strings.
- [x] Add confirmation state and modal.
- [x] Change filed action visibility.
- [x] Add reopen confirmation.
- [x] Update toasts.
- [x] Run workspace type-check and targeted tests.

## Success Criteria

- Staff can find and use filed action without touching review/verify flows.
- Staff sees retention consequence before confirming.
- Filed/reopen actions refresh UI correctly.

## Risk Assessment

- Header already has many actions on mobile. Button text may need responsive layout or icon+short label.
- If no test infra exists for route component, keep tests scoped to extracted action component.

## Security Considerations

- Confirmation reduces accidental retention scheduling.
- Reopen confirmation prevents accidental clearing of retention schedule.

## Next Steps

- Phase 03 adds visibility after action and retention extension.

## Completion Notes

- Completed 2026-05-20.
- Extracted `CaseFiledAction` with accessible confirmation modal for mark-filed and reopen actions.
- Filed action now appears for any active unfiled case; it no longer depends on review, verification, data entry, Files tab, or checklist state.
- Success toasts use backend `scheduledIdentityDocs` and `clearedIdentityDocs` counts.
- Validation passed:
  - `pnpm -F @ella/workspace type-check`
  - `pnpm -F @ella/workspace test -- case-filed-action.test.tsx`
  - `pnpm -F @ella/workspace lint` (0 errors, 9 pre-existing warnings outside touched files)

## Unresolved Questions

- None.
