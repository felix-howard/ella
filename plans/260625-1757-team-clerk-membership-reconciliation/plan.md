---
title: "Team Clerk Membership Reconciliation"
description: "Make Clerk organization membership the source of truth for team access and seats, while keeping Staff rows as historical app records."
status: complete
priority: P1
effort: 2d
branch: "feature/team-clerk-membership-reconciliation"
tags: [feature, backend, frontend, auth, team]
blockedBy: []
blocks: []
created: "2026-06-25T11:01:10.165Z"
createdBy: "ck:plan"
source: skill
---

# Team Clerk Membership Reconciliation

## Overview

Fix Team Management mismatch between Clerk organization memberships and DB `Staff` rows.

Current issue: UI archive hides/deactivates `Staff` locally but does not remove Clerk membership, so archived members can still consume Clerk seats. Worse, auth bootstrap can reactivate an inactive Staff row if the Clerk membership still exists. Desired contract: Clerk membership owns access/seat; Staff owns profile/history.

## Key Findings

- Staff CSV has 22 rows: 17 active, 5 archived.
- Clerk org screenshot has 20 memberships.
- Archived but still in Clerk likely: `Nghi La`, `Team Tester`, `Zairel Gabilagon`.
- Current profile danger zone calls `PATCH /team/members/:id/archive`, not `DELETE /team/members/:id`.
- `authMiddleware` can re-sync inactive staff from Clerk and set `isActive=true`.
- Clerk docs confirm `deleteOrganizationMembership({ organizationId, userId })` removes a user from an org; membership list returns `data` and `totalCount`.

## Recommended Contract

- Active member: Clerk membership exists and `Staff.isActive=true`.
- Removed/archived member: Clerk membership absent and `Staff.isActive=false`.
- Restore access: send/re-send Clerk invitation. Do not DB-unarchive without Clerk membership.
- Admin UI must show Clerk seats used and mismatch status; do not show a configured seat limit because Clerk plan limits may change.
- Removal must be Clerk-first. If Clerk removal fails for reasons other than "already not a member", do not silently mark DB inactive.
- Removing a member with managed clients should show a warning only. Do not block removal or require reassignment first; historical assignments remain.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Audit current Team and Clerk contracts](./phase-01-audit-current-team-and-clerk-contracts.md) | Complete |
| 2 | [Implement Clerk-first member removal and reconciliation API](./phase-02-implement-clerk-first-member-removal-and-reconciliation-api.md) | Complete |
| 3 | [Update Team management UX for seat control](./phase-03-update-team-management-ux-for-seat-control.md) | Complete |
| 4 | [Add regression tests docs and production runbook](./phase-04-add-regression-tests-docs-and-production-runbook.md) | Complete |

## Dependencies

- Uses existing Clerk Backend SDK in `apps/api/src/lib/clerk-client.ts`.
- Uses existing Team route, Staff schema, role mapping, webhooks, and profile UI.
- No Prisma migration expected unless implementation decides to persist explicit membership audit snapshots.

## Reports

- [Scout Report](./reports/scout-report.md)

## Validation

- `pnpm -F @ella/api test -- src/routes/team src/services/auth src/services/clerk-webhook`
- `pnpm -F @ella/api type-check`
- Phase 2 completed: `pnpm -F @ella/api test -- src/routes/team src/services/auth src/services/clerk-webhook src/routes/__tests__/manager-role-authorization.test.ts` passed, 127 tests
- `pnpm -F @ella/workspace test -- src/components/profile src/components/team`
- `pnpm -F @ella/workspace type-check`
- `pnpm i18n:check`
- Phase 3 completed: `pnpm -F @ella/workspace test -- src/components/profile src/components/team src/lib/__tests__/team-reconciliation.test.ts` passed, 29 tests
- Phase 3 completed: `pnpm -F @ella/workspace type-check` passed
- Phase 3 completed: `pnpm i18n:check` passed, workspace 3062 keys and portal 531 keys
- Phase 4 completed: `pnpm -F @ella/api test -- src/routes/team src/services/auth src/services/clerk-webhook` passed, 107 tests
- Phase 4 completed: `pnpm -F @ella/api type-check` passed
- Phase 4 completed: `pnpm -F @ella/workspace test -- src/components/profile src/components/team` passed, 26 tests
- Phase 4 completed: `pnpm -F @ella/workspace type-check` passed
- Phase 4 completed: `pnpm i18n:check` passed, workspace 3062 keys and portal 531 keys
- Phase 4 completed: `git diff --check` passed

## Cook Command

After `/clear`, run:

```bash
/ck:cook /Users/felix/Projects/ella/plans/260625-1757-team-clerk-membership-reconciliation/plan.md
```
