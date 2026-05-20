# Operational Filed Retention Workflow Plan

## Overview

Make identity-document retention match real operations: CPA downloads/uses docs outside app, then explicitly marks the tax return filed. Retention must not depend on verify/review/File-tab workflow.

## Phase Status

| Phase | File | Status | Progress |
|---|---|---:|---:|
| 01 | [Backend Filed Action Semantics](phase-01-backend-filed-action-semantics.md) | complete | 100% |
| 02 | [Workspace Filed Action UX](phase-02-workspace-filed-action-ux.md) | complete | 100% |
| 03 | [Retention Visibility and Extension](phase-03-retention-visibility-and-extension.md) | complete | 100% |
| 04 | [Validation Docs Rollout](phase-04-validation-docs-rollout.md) | complete | 100% |

## Key Dependencies

- Phase 01 before UI phases because actions need stable payloads and status semantics.
- Phase 02 before Phase 03 because filed-state UI anchors retention messaging.
- Phase 04 last after tests and docs are final.

## Global Constraints

- Plan-only handoff; implement one phase per `/ck:cook` session.
- Do not use `prisma db push`.
- No schema changes expected. If implementation discovers schema need, use Prisma migration only.
- Do not tie retention to verify, data entry, review, Files tab usage, or checklist completeness.
- Keep review workflow available but do not make it prerequisite for filing.
- Deletion job still deletes only storage object and preserves DB metadata/audit.

## Target Workflow

1. Client uploads docs.
2. CPA uses/downloads docs as needed.
3. CPA clicks `Mark return filed` on client/case header.
4. App confirms identity docs will be scheduled for deletion after retention window.
5. App schedules identity retention and shows filed/retention state.
6. Inngest deletes due identity storage objects after retention date.

## Success Criteria

- Staff can mark any active case filed without first sending to review or verifying docs.
- Filed action sets consistent `status`, `isFiled`, `filedAt`, and retention schedule state.
- Staff sees clear confirmation before scheduling retention.
- Staff sees filed date and identity retention visibility after filing.
- Staff can reopen filed case and clear pending retention schedule.
- Admin/staff can extend scheduled identity retention for operational exceptions.
- Tests cover filed, reopen, scheduling, clearing, and UI action visibility.

## Progress Notes

- Created 2026-05-20 after security hardening plan exposed mismatch between ideal review workflow and actual CPA operations.
- Existing backend has `POST /cases/:id/mark-filed`, `POST /cases/:id/reopen`, and retention job.
- Existing UI hides `Mark as Filed` unless case is already in review; this plan removes that blocker.
- Phase 01 complete 2026-05-20: filed/reopen endpoints now own filed semantics with scoped conditional writes, retention counts, and typed client responses; generic PATCH no longer performs filed/reopen transitions.
- Phase 02 complete 2026-05-20: workspace header now exposes `Mark return filed` for any active unfiled case, uses confirmation copy for retention/audit consequences, shows `Reopen filing` for filed cases, and toasts backend retention counts.
- Phase 03 complete 2026-05-20: client detail now exposes filed date and unpaginated identity retention summary, workspace header shows filed/retention state, staff can extend scheduled identity retention 30/60/90 days, extension updates are race-guarded, and targeted tests/type-check/lint pass.
- Phase 04 complete 2026-05-20: targeted and broad validation pass, rollout docs state retention is triggered by `Mark return filed`, production SQL preflight queries are documented, and roadmap/changelog/codebase docs are updated.

## Next Phase

Plan complete.

## Unresolved Questions

- None.
