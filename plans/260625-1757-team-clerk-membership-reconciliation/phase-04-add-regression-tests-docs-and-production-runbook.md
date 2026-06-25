---
phase: 4
title: "Add regression tests docs and production runbook"
status: complete
priority: P1
effort: "4h"
dependencies: [3]
---

# Phase 4: Add regression tests docs and production runbook

## Context Links

- [Scout Report](./reports/scout-report.md)
- `/Users/felix/Projects/ella/docs/system-architecture.md`
- `/Users/felix/Projects/ella/docs/codebase-summary.md`
- `/Users/felix/Projects/ella/docs/project-changelog.md`

## Overview

Lock in regression coverage, update docs, and provide a production cleanup runbook for the current Ella org mismatch without directly mutating production data during implementation.

Completed in this phase: focused API/workspace regression validation, review-driven API hardening, architecture/summary/changelog updates, and a production cleanup runbook for the three known archived Clerk seat mismatches.

## Key Insights

- Current production cleanup can be done safely through the new UI after deploy.
- Docs already describe `/team/members` and Clerk webhook sync, but not the clarified remove/access/seat contract.
- Clerk webhooks are asynchronous and retryable; the app must not depend on webhook delivery for synchronous removal success.

## Requirements

- Functional:
  - Focused API and workspace tests pass.
  - Docs reflect new Team membership contract.
  - Runbook lists exact current mismatch names from CSV/screenshots.
- Non-functional:
  - No direct production database writes in tests or docs.
  - Manual cleanup steps must be reversible where possible.
  - Include rollback notes.

## Architecture

Regression gates:

```text
API tests
  -> Team removal fail-closed
  -> Reconciliation statuses
  -> Auth inactive staff not reactivated
  -> Webhook created/deleted still syncs Staff state

Workspace tests
  -> Seat summary
  -> Remove access dialog
  -> Archived status badges
  -> No self destructive action

Docs
  -> System architecture Team section
  -> Codebase summary latest update
  -> Project changelog entry
```

## Related Code Files

- Modify: `/Users/felix/Projects/ella/apps/api/src/routes/team/__tests__/team-routes.test.ts`
- Modify: `/Users/felix/Projects/ella/apps/api/src/services/auth/__tests__/auth.test.ts`
- Modify: `/Users/felix/Projects/ella/apps/api/src/services/clerk-webhook/__tests__/clerk-webhook.test.ts` if webhook assumptions change
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/components/profile/__tests__/profile-tabs.test.tsx`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/components/team/__tests__/team-member-table.test.tsx`
- Modify: `/Users/felix/Projects/ella/docs/system-architecture.md`
- Modify: `/Users/felix/Projects/ella/docs/codebase-summary.md`
- Modify: `/Users/felix/Projects/ella/docs/project-changelog.md`
- Create: `/Users/felix/Projects/ella/docs/team-clerk-membership-runbook.md`

## Implementation Steps

1. Run focused API validation:
   - `pnpm -F @ella/api test -- src/routes/team src/services/auth src/services/clerk-webhook`
   - `pnpm -F @ella/api type-check`
2. Run focused workspace validation:
   - `pnpm -F @ella/workspace test -- src/components/profile src/components/team`
   - `pnpm -F @ella/workspace type-check`
   - `pnpm i18n:check`
3. Update docs:
   - `docs/system-architecture.md`: Team endpoints and Clerk/Staff source-of-truth contract.
   - `docs/codebase-summary.md`: latest update summary.
   - `docs/project-changelog.md`: added/fixed notes.
4. Production cleanup runbook:
   - Open Team page as admin after deploy.
   - Confirm `Clerk seats used` equals 20 before cleanup.
   - With Show Archived enabled, remove access for archived records still in Clerk:
     - `Nghi La`
     - `Team Tester`
     - `Zairel Gabilagon`
   - Confirm Clerk seats used becomes 17.
   - Review pending invitations and other mismatches before inviting new members if the count does not drop.
5. Rollback notes:
   - Code rollback restores old UI, but removed Clerk memberships require re-invite.
   - Staff rows remain archived, so historical records are preserved.

## Todo List

- [x] Add/finish regression tests.
- [x] Run focused API validation.
- [x] Run focused workspace validation.
- [x] Run i18n parity check.
- [x] Update architecture, summary, changelog.
- [x] Add production cleanup runbook.

## Success Criteria

- [x] Tests and type-checks pass or failures are documented with exact blockers.
- [x] Docs explain Clerk membership vs Staff record responsibilities.
- [x] User has exact safe steps to free current production seats.
- [x] No production data changed by the implementation session.

## Validation Results

- `pnpm -F @ella/api test -- src/routes/team src/services/auth src/services/clerk-webhook` pass, 107 tests
- `pnpm -F @ella/api type-check` pass
- `pnpm -F @ella/workspace test -- src/components/profile src/components/team` pass, 26 tests
- `pnpm -F @ella/workspace type-check` pass
- `pnpm i18n:check` pass, workspace 3062 keys and portal 531 keys
- `git diff --check` pass

## Risk Assessment

- Risk: Full monorepo test suite too slow.
  - Mitigation: Run focused suites plus type-checks. Note if full suite not run.
- Risk: Production Clerk cleanup is irreversible without re-invite.
  - Mitigation: Runbook names affected users and explains restore by invitation.

## Security Considerations

- Runbook must not include secrets or production credentials.
- Do not paste raw Clerk API keys, env files, or full webhook payloads into docs.
- Audit logs should preserve who removed access.

## Next Steps

- After Phase 4, deploy API + workspace together.
- Then perform UI-based production cleanup.
- Commit and push the completed implementation.
