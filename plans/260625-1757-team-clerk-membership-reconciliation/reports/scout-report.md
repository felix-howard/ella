---
type: scout-report
created: 2026-06-25
scope: team-clerk-membership-reconciliation
---

# Scout Report

## Summary

Team Management currently has two different meanings for "inactive":
- `PATCH /team/members/:staffId/archive` only sets `Staff.isActive=false`; it does not remove Clerk org membership.
- `DELETE /team/members/:staffId` calls Clerk `deleteOrganizationMembership`, but UI does not expose this path from the Team profile danger zone.

This explains production mismatch:
- Web app active members: 17.
- Web app active + archived: 22.
- Staff CSV rows: 22.
- Clerk organization memberships: 20.
- Archived Staff still consuming Clerk seats: likely `Nghi La`, `Team Tester`, `Zairel Gabilagon`.
- Archived Staff already absent from Clerk: likely `Team 4 Guy`, archived `NANCY NGUYEN` (`nancyn83@gmail.com`).

## Critical Finding

`authMiddleware` treats inactive staff as a reason to run `syncStaffFromClerkMembership()`:

```ts
const needsMembershipSync = clerkOrgId && (
  !staff ||
  !staff.organizationId ||
  staff.organization?.clerkOrgId !== clerkOrgId ||
  !staff.isActive
)
```

`syncStaffFromClerkMembership()` sets `isActive: true` if Clerk membership exists. Therefore a DB-only archived member who remains in Clerk can potentially be reactivated on login. This is worse than only a billing-seat mismatch.

## Relevant Files

- `/Users/felix/Projects/ella/apps/api/src/routes/team/index.ts`
  - `GET /team/members`
  - `POST /team/invite`
  - `PATCH /team/members/:staffId/role`
  - `DELETE /team/members/:staffId`
  - `PATCH /team/members/:staffId/archive`
  - `PATCH /team/members/:staffId/unarchive`
- `/Users/felix/Projects/ella/apps/api/src/middleware/auth.ts`
  - Inactive staff can be bootstrapped back from Clerk membership.
- `/Users/felix/Projects/ella/apps/api/src/services/auth/index.ts`
  - `syncStaffFromClerkMembership()` always writes `isActive: true`.
- `/Users/felix/Projects/ella/apps/api/src/services/clerk-webhook/index.ts`
  - Membership webhooks sync created, updated, deleted.
- `/Users/felix/Projects/ella/apps/api/src/lib/staff-role-mapping.ts`
  - App role to Clerk role mapping. MANAGER remains Clerk `org:member`.
- `/Users/felix/Projects/ella/apps/workspace/src/routes/team/profile/$staffId.tsx`
  - Danger zone calls `api.team.archive(staffId)`.
- `/Users/felix/Projects/ella/apps/workspace/src/components/profile/staff-profile-tabs.tsx`
  - Renders archive danger zone.
- `/Users/felix/Projects/ella/apps/workspace/src/routes/team/index.tsx`
  - Shows active count and archived toggle.
- `/Users/felix/Projects/ella/apps/workspace/src/lib/api-client.ts`
  - Has both `team.deactivate` and `team.archive`; UI uses archive.
- `/Users/felix/Projects/ella/apps/api/src/routes/team/__tests__/team-routes.test.ts`
  - Existing backend tests for list, invite, role, delete.
- `/Users/felix/Projects/ella/apps/workspace/src/components/profile/__tests__/profile-tabs.test.tsx`
  - Existing profile danger-zone tests.
- `/Users/felix/Projects/ella/apps/workspace/src/components/team/__tests__/team-member-table.test.tsx`
  - Existing team table tests.

## Clerk Docs Checked

- Remove org membership: https://clerk.com/docs/reference/backend/organization/delete-organization-membership
- List org memberships: https://clerk.com/docs/reference/backend/organization/get-organization-membership-list
- Organization membership metadata: https://clerk.com/docs/reference/backend/organization/update-organization-membership-metadata
- Webhooks async/retry behavior: https://clerk.com/docs/guides/development/webhooks/overview

## Recommended Contract

Use Clerk membership as the source of truth for seat/access.

Staff DB is the app profile and historical record:
- Active staff: Clerk membership exists and `Staff.isActive=true`.
- Removed/archived staff: Clerk membership absent and `Staff.isActive=false`.
- Restore access: send Clerk invitation; do not local-unarchive until membership is accepted or confirmed.
- Mismatch states must be visible to admins and fixable.

## Resolved Decisions

- Do not configure or display a fixed seat limit. Show only Clerk seats currently used (`totalCount`) and invite/remove failures.
- Removing a member with managed clients should warn only. Do not block removal or force reassignment before freeing Clerk access.
