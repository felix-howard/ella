---
phase: 3
title: "Update Team management UX for seat control"
status: completed
priority: P1
effort: "5h"
dependencies: [2]
---

# Phase 3: Update Team management UX for seat control

## Context Links

- [Scout Report](./reports/scout-report.md)
- Phase 2 API contract
- Design guidelines: `/Users/felix/Projects/ella/docs/design-guidelines.md`

## Overview

Update Team page and staff profile UI so admins can understand seat usage and remove Clerk access from the web app. Remove ambiguous DB-only archive wording from primary flows.

Completed in this phase: workspace API reconciliation typing, Team seat summary, Access status badges, profile remove-access modal, invite-again restore path, EN/VI locale parity, focused regression tests, and review fixes for pending-invite repeat prevention plus active-missing-Clerk copy.

## Key Insights

- Current page count uses `members.length`, so `Show Archived` changes count from 17 to 22 while Clerk shows 20. Admins need both counts.
- Existing `api.team.deactivate` already points at `DELETE /team/members/:id` but is not used in the profile danger zone.
- Unarchive as a local DB action is misleading if Clerk membership is absent. Restore access should be invitation-based.

## Requirements

- Functional:
  - Team page shows Staff active/archived counts and Clerk seats used.
  - Team page does not show a configured seat limit.
  - Archived rows show whether they still occupy a Clerk seat.
  - Admin can remove access from active or archived Staff rows.
  - Admin sees clear warning before removing a member:
    - user loses org access,
    - Clerk seat is freed,
    - Staff record and historical assignments remain,
    - managed clients may need reassignment.
  - Restore path is "Invite again" or "Restore access by invitation", not local unarchive.
- Non-functional:
  - Follow existing capability flags (`canManageTeam`).
  - Keep UI dense, operational, and consistent with current Team table.
  - English/Vietnamese locale parity.

## Architecture

Recommended UI changes:

```text
Team header
  Members: 17 active / 22 staff records
  Clerk seats: 20 used
  Show archived toggle
  Invite Member button

Team table
  Name | Email | Role | Managed Clients | Access
  Access badge:
    Active
    Archived
    Seat still occupied
    Missing from Clerk
    Pending invite

Profile danger zone
  Primary destructive action: Remove access
  Secondary action for archived missing-Clerk: Invite again
```

## Related Code Files

- Modify: `/Users/felix/Projects/ella/apps/workspace/src/lib/api-client.ts`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/routes/team/index.tsx`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/routes/team/profile/$staffId.tsx`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/components/team/team-member-table.tsx`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/components/profile/staff-profile-tabs.tsx`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/components/team/invite-member-dialog.tsx`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/locales/en.json`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/locales/vi.json`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/components/profile/__tests__/profile-tabs.test.tsx`
- Modify: `/Users/felix/Projects/ella/apps/workspace/src/components/team/__tests__/team-member-table.test.tsx`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/components/team/team-seat-summary.tsx`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/components/team/team-member-access-badge.tsx`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/components/team/remove-member-access-dialog.tsx`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/components/team/pending-invitation-row.tsx`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/components/profile/staff-access-status-banner.tsx`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/components/profile/use-staff-profile-focus.ts`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/hooks/use-team-member-reconciliation.ts`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/lib/team-reconciliation.ts`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/components/team/__tests__/team-seat-summary.test.tsx`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/components/team/__tests__/remove-member-access-dialog.test.tsx`
- Create: `/Users/felix/Projects/ella/apps/workspace/src/lib/__tests__/team-reconciliation.test.ts`

## Implementation Steps

1. Extend API client types:
   - Add `TeamReconciliationResponse`.
   - Add `team.getReconciliation()`.
   - Rename or alias `team.deactivate` to `team.removeAccess` for clarity.
2. Team index page:
   - Fetch reconciliation only for `canManageTeam`.
   - Keep member list query for rows; join status by staff id.
   - Show seat summary near header with used count only, no limit.
   - Keep pending invitations card but include in seat/status context if API returns it.
3. Team table:
   - Add `Access` column or status badge near name if width is tight.
   - Show `Seat still occupied` for archived staff in Clerk.
   - Keep row click behavior.
4. Profile page:
   - Replace archive mutation with remove-access mutation.
   - For archived records:
     - if Clerk membership exists, show remove access.
     - if no Clerk membership, show archived info and optional "Invite again".
   - Remove direct unarchive mutation from primary flow unless Phase 2 explicitly keeps a safe endpoint.
5. Confirmation dialog:
   - Use a real modal instead of `window.confirm` if local UI patterns already have modal components.
   - Include managed client count warning.
   - Require explicit click on destructive button; typed confirmation optional, not required for small team removal.
6. Locale updates:
   - Update `team.archive*` copy or add new `team.removeAccess*` keys.
   - Keep EN/VI parity.
7. Frontend tests:
   - Seat summary renders counts.
   - Archived still-in-Clerk row shows warning badge.
   - Danger zone uses remove access copy.
   - Self profile does not show destructive admin controls.

## Todo List

- [x] Add workspace API types/methods.
- [x] Add seat summary and status badges.
- [x] Replace profile archive UX with remove access UX.
- [x] Update locale keys in EN and VI.
- [x] Add focused workspace tests.
- [x] Run workspace type-check, tests, and i18n check.

## Success Criteria

- [x] Admin can remove a member from Clerk org from the web app.
- [x] Admin can identify archived Staff that still use Clerk seats.
- [x] UI no longer suggests DB-only archive frees access.
- [x] Restore path does not create DB active / Clerk missing mismatch.

## Validation

- `pnpm -F @ella/workspace test -- src/components/profile src/components/team src/lib/__tests__/team-reconciliation.test.ts` pass, 29 tests
- `pnpm -F @ella/workspace type-check` pass
- `pnpm i18n:check` pass, workspace 3062 keys and portal 531 keys
- Tester subagent validation pass with initial coverage concerns; added focused utility/dialog tests.
- Code-reviewer subagent findings fixed and verified: pending invitations no longer show repeat Invite again, and active-missing-Clerk removal copy no longer claims a Clerk seat will be freed.

## Risk Assessment

- Risk: Adding too much dashboard chrome.
  - Mitigation: Compact summary row, no marketing cards.
- Risk: Long labels crowd table.
  - Mitigation: Use short badges and tooltips if existing UI supports them.
- Risk: Admin removes someone with active clients and forgets reassignment.
  - Mitigation: Confirmation warning and status remains visible in client assignment surfaces.

## Security Considerations

- All controls gated by `canManageTeam`.
- UI is advisory only; server remains authoritative.
- Do not expose destructive controls for own profile.

## Next Steps

- Phase 4 completes tests/docs and production cleanup runbook.
