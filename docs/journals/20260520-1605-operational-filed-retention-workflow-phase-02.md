# Operational Filed Retention Workflow Phase 02

**Date**: 2026-05-20 16:05
**Severity**: Medium
**Component**: Workspace client case header and filed-case actions
**Status**: Resolved

## What Happened

Phase 02 finished the workspace-side retention workflow for filed and unfiled cases. The client header now exposes `Mark return filed` for any active unfiled case without the old review/verify/checklist/File tab gating, and filed cases now show `Reopen filing` with a confirmation flow that explains what gets cleared for not-yet-deleted identity docs.

## The Brutal Truth

The old gating was too scattered. We had action availability split across UI state, review status, and tab visibility, which made the workflow harder to reason about than it should have been. This was annoying because the feature was not conceptually complex, but the implementation made it look fragile.

## Technical Details

Added `CaseFiledAction` in `apps/workspace/src/components/cases/case-filed-action.tsx` with an accessible confirmation modal. The modal copy now explains identity retention scheduling and DB metadata/audit retention before a case is marked filed. Success toasts use backend counts from `scheduledIdentityDocs` and `clearedIdentityDocs`.

Touched files:
- `apps/workspace/src/routes/clients/$clientId.tsx`
- `apps/workspace/src/components/cases/case-filed-action.tsx`
- `apps/workspace/src/components/cases/case-filed-action.test.tsx`
- `apps/workspace/src/locales/en.json`
- `apps/workspace/src/locales/vi.json`
- `docs/project-changelog.md`
- `docs/project-roadmap.md`
- `docs/codebase-summary.md`
- `plans/260520-1605-operational-filed-retention-workflow/plan.md`
- `plans/260520-1605-operational-filed-retention-workflow/phase-02-workspace-filed-action-ux.md`

Validation passed:
- `pnpm -F @ella/workspace type-check`
- `pnpm -F @ella/workspace test -- case-filed-action.test.tsx`
- `pnpm -F @ella/workspace lint` 0 errors, 9 pre-existing warnings outside touched files
- `git diff --check`

## What We Tried

- Kept the existing gating and only added the new action entrypoint. That was too brittle and still left the workflow split across unrelated conditions.
- Moved the confirmation logic into a dedicated component. That was the correct call because it collapsed copy, behavior, and test coverage into one place.

## Root Cause Analysis

The root cause was over-distributed UI logic. Filing state, retention timing, and action visibility were encoded in separate places, so the feature depended on implicit rules instead of a single source of truth. Once the retention workflow had to explain actual deletion schedules, the old approach stopped being safe enough.

## Lessons Learned

Keep action gating close to the action itself. If a workflow needs retention-specific confirmation text, success counters, and reopen semantics, it should be a dedicated component instead of a scattered set of conditionals. Also, backend counts should drive user-facing success copy, not guessed UI state.

## Next Steps

No immediate follow-up code work is blocked. Monitor later phases for any copy drift between EN/VI locale strings and backend retention behavior.

## Unresolved Questions

None.
