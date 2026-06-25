# Team Clerk Membership Cleanup Runbook

**Last updated:** 2026-06-25

Use this runbook after deploying the Team Clerk membership reconciliation changes. Do not write directly to production database tables for this cleanup. The safe path is the admin Team UI, which removes Clerk organization access first and then archives the local Staff record.

## Contract

- Clerk organization membership is source of truth for app access and billable seats.
- `Staff` rows are app records for profile, assignments, documents, and history.
- Removing access means Clerk membership is removed or confirmed absent before `Staff.isActive=false` is persisted.
- Restoring access means sending a new Clerk invitation. Do not DB-unarchive a Staff row without Clerk membership.
- Clerk webhooks still sync membership changes asynchronously, but the UI removal flow does not depend on webhook delivery to complete.

## Pre-Deploy Checks

1. Confirm API and workspace are deployed together from the same build.
2. Confirm an admin can open Workspace > Team.
3. Confirm Team shows a `Clerk seats used` count and archived Staff visibility.
4. Confirm no manual production DB writes or Clerk dashboard deletes are planned for this cleanup.

## Current Cleanup Targets

The audit found 22 Staff rows, 17 active Staff rows, and 20 Clerk memberships. These archived Staff records likely still occupy Clerk seats:

- Nghi La
- Team Tester
- Zairel Gabilagon

## Cleanup Steps

1. Sign in as an org admin.
2. Open Workspace > Team.
3. Confirm `Clerk seats used` is `20` before cleanup.
4. Enable `Show archived`.
5. For each cleanup target, find the archived row and confirm it shows a seat/access mismatch such as `Seat still occupied`.
6. Use `Remove access` on each target:
   - Nghi La
   - Team Tester
   - Zairel Gabilagon
7. Confirm each modal explains Clerk access loss, Staff history retention, and managed-client reassignment risk.
8. Confirm each removal succeeds in the UI.
9. Refresh Team.
10. Confirm `Clerk seats used` becomes `17`.
11. If the count does not drop to `17`, review pending invitations and other reconciliation mismatches before inviting anyone new.

## Verification

- Archived target rows should no longer show `Seat still occupied`.
- `GET /team/reconciliation` should report archived targets as `ARCHIVED_MATCH` when Clerk membership is absent.
- Pending invitations may still appear separately from live memberships.
- Active staff should remain unchanged.
- Historical Staff profile, managed clients, files, and audit records should remain available.

## Rollback

- Code rollback restores the previous UI/API behavior, but it does not recreate removed Clerk memberships.
- To restore a removed user, send a new Team invitation from the app.
- After the user accepts, Clerk's `organizationMembership.created` webhook should reconnect the active Staff record.
- If the user receives a 403 after accepting, check Clerk webhook delivery and replay the membership-created event before trying local database changes.
- If a user was removed accidentally, document who removed access and when, then re-invite through the app. Do not directly edit `Staff.isActive` in production as a substitute for Clerk membership.

## Stop Conditions

Stop and investigate before removing access if:

- `Clerk seats used` is not close to the expected `20` before cleanup.
- A target is active in Staff, not archived.
- A target does not appear in archived rows and cannot be matched by email/name.
- The remove action returns a Clerk error or leaves the row in `Seat still occupied` after refresh.
- The remove action returns `STAFF_ARCHIVE_INCOMPLETE` or reconciliation shows an active Staff row with missing Clerk membership. Retry remove access after checking API logs.
- Any non-target archived row appears to occupy a seat but was not part of this audit.
