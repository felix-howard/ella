# Phase 04 Validation Docs Rollout

## Context Links

- Plan: `plans/260520-1605-operational-filed-retention-workflow/plan.md`
- Rollout doc: `docs/security-upload-portal-hardening.md`
- Architecture doc: `docs/system-architecture.md`
- Changelog: `docs/project-changelog.md`
- Roadmap: `docs/project-roadmap.md`
- Codebase summary: `docs/codebase-summary.md`

## Overview

- Priority: High
- Status: complete
- Goal: prove operational filed retention workflow works end to end and document production rollout expectations.

## Key Insights

- This change is operationally sensitive because filed action schedules deletion of identity docs.
- Production rollout should verify due counts before enabling retention job.
- Docs must clearly say retention is tied to `Mark return filed`, not review/verify.

## Requirements

- Run targeted API tests for:
  - mark filed
  - reopen
  - extend retention
  - retention delete job
- Run workspace tests/type-check for:
  - filed action visibility
  - confirmation rendering
  - filed/reopen/extend API calls if covered
- Run full package checks appropriate to touched files:
  - `pnpm -F @ella/api test`
  - `pnpm -F @ella/workspace type-check`
  - `pnpm type-check`
  - `pnpm lint` if time allows
- Update docs:
  - retention trigger is `Mark return filed`
  - review/verify are not prerequisites
  - what deletion job deletes and preserves
  - production SQL preflight queries
  - rollback/reopen behavior
- Update plan statuses to complete.

## Architecture

- Documentation should treat retention as a security control with manual business trigger.
- Rollout checklist should include counts for due retention rows before scheduler is enabled.

## Related Code Files

- Modify: `docs/security-upload-portal-hardening.md`
- Modify: `docs/system-architecture.md`
- Modify: `docs/codebase-summary.md`
- Modify: `docs/project-changelog.md`
- Modify: `docs/project-roadmap.md`
- Modify: `plans/260520-1605-operational-filed-retention-workflow/plan.md`
- Modify: phase files as implementation completes

## Implementation Steps

1. Run targeted tests from phases 01-03.
2. Run broader API/workspace validation.
3. Fix any regressions without weakening tests.
4. Update docs with exact operational workflow.
5. Add rollout SQL:
   - due retention rows
   - scheduled identity docs
   - already storage-deleted docs
6. Update plan and phase statuses.
7. Summarize validation and remaining rollout risk.

## Todo List

- [x] Run targeted API tests.
- [x] Run workspace checks.
- [x] Run broad type-check/lint as feasible.
- [x] Update docs.
- [x] Update plan statuses.
- [x] Report rollout checklist.

## Validation

- `pnpm -F @ella/api test -- src/routes/cases/__tests__/case-filed-actions.test.ts src/routes/cases/__tests__/case-status-transitions.test.ts src/services/__tests__/identity-doc-retention.test.ts src/jobs/__tests__/delete-expired-identity-docs.test.ts` pass, 32 tests.
- `pnpm -F @ella/workspace test -- case-filed-action.test.tsx` pass, 5 tests.
- `pnpm -F @ella/api test` pass, 2397 tests.
- `pnpm -F @ella/workspace type-check` pass.
- `pnpm type-check` pass across 8 packages.
- `pnpm lint` pass with 0 errors and 27 pre-existing warnings.

## Success Criteria

- Tests pass.
- Docs match real behavior.
- Plan state is complete.
- User has clear production expectations before merge/deploy.

## Risk Assessment

- Existing lint warnings may remain; report if unrelated.
- Full API suite can be slower but should be run before merge because retention is high risk.

## Security Considerations

- Production rollout must verify due retention row count before scheduler runs.
- Backups/PITR/R2 recovery posture should be confirmed before enabling automated deletion.

## Next Steps

- Plan complete. Before production enablement, run rollout SQL preflight from `docs/security-upload-portal-hardening.md`.

## Completion Notes

- Completed 2026-05-20.
- Updated rollout docs to state identity retention is triggered by `Mark return filed`, not review, verification, checklist, data entry, or Files tab workflows.
- Added production SQL preflight queries for scheduled, due, and already storage-deleted identity retention rows.
- Moved SQL preflight before API/Inngest enablement and documented pause/disable guidance if the function is already deployed.
- Documented extension semantics and late post-filed upload/reclassification due-count risk.
- Updated architecture, codebase summary, roadmap, and changelog to reflect the complete 4-phase workflow.
- Validation passed; repo lint still reports existing non-blocking React Refresh and hook dependency warnings unrelated to this phase.

## Unresolved Questions

- None.
