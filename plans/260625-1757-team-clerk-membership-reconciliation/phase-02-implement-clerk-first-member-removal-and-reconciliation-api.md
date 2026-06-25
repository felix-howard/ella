---
phase: 2
title: "Implement Clerk-first member removal and reconciliation API"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: Implement Clerk-first member removal and reconciliation API

## Context Links

- [Scout Report](./reports/scout-report.md)
- Phase 1 status contract
- Clerk remove membership docs: https://clerk.com/docs/reference/backend/organization/delete-organization-membership
- Clerk list membership docs: https://clerk.com/docs/reference/backend/organization/get-organization-membership-list

## Overview

Make backend behavior Clerk-first and fail-closed. Add an admin-only reconciliation endpoint so the UI can show Staff vs Clerk mismatch without requiring manual dashboard checks.

Completed in this phase: backend removal, legacy archive alias, auth bootstrap guard, reconciliation API, Clerk error sanitization, and focused regression coverage.

## Key Insights

- Current `DELETE /team/members/:staffId` catches Clerk removal failure and still deactivates DB. That creates mismatch.
- Current `PATCH /archive` intentionally does not remove Clerk membership. This should stop being the primary team removal path.
- `authMiddleware` should not reactivate deliberately inactive staff merely because Clerk membership exists.

## Requirements

- Functional:
  - Admin can remove a member from Clerk org and archive Staff row in one action.
  - Admin can remove Clerk access for already-archived Staff that still occupy a Clerk seat.
  - Admin can see reconciliation statuses and Clerk membership count.
  - Login cannot reactivate inactive Staff from Clerk membership.
  - Existing invite and role flows continue to work.
- Non-functional:
  - Fail closed on Clerk API errors.
  - Idempotent handling for "already not a Clerk member".
  - No direct Staff deletion.
  - No Prisma migration unless strictly necessary.

## Architecture

Added extracted helpers under `apps/api/src/routes/team/`:

- `team-member-access-removal.ts`: Clerk-first remove/archive flow, admin guard reservations, and role-demotion guard.
- `team-clerk-membership-access.ts`: membership lookup by `clerkId`, fallback lookup by email, and idempotent Clerk removal.
- `team-clerk-errors.ts`: sanitized public Clerk errors and HTTP status mapping.
- `team-membership-reconciliation.ts`: live Staff/Clerk comparison DTO.

```ts
type TeamMembershipStatus =
  | 'ACTIVE_MATCH'
  | 'ARCHIVED_MATCH'
  | 'ARCHIVED_STILL_IN_CLERK'
  | 'ACTIVE_MISSING_CLERK'
  | 'CLERK_MISSING_STAFF'
  | 'PENDING_INVITATION'
```

Backend flow for remove access:

```text
Admin request
  -> verify not self
  -> verify Staff belongs to org
  -> take short org-scoped advisory lock
  -> reserve active admin mutation if needed and verify not last admin
  -> release DB transaction before Clerk network call
  -> if clerkId or email exists:
       lookup Clerk membership by clerkId, then email fallback
       call Clerk deleteOrganizationMembership
       if not_found: continue as idempotent already-removed
       if other error: clear admin reservation, return 400/429/502, do not DB-deactivate
  -> take short org-scoped advisory lock
  -> update Staff isActive=false, deactivatedAt=now
  -> activity log with status and clerkRemovalResult
```

Auth bootstrap change:

```text
if staff exists in same Clerk org and isActive=false:
  throw 403 disabled
  do not call syncStaffFromClerkMembership()

if no staff, no org, or org mismatch:
  bootstrap from Clerk membership as today
```

## Related Code Files

- Modify: `/Users/felix/Projects/ella/apps/api/src/middleware/auth.ts`
- Modify: `/Users/felix/Projects/ella/apps/api/src/routes/team/index.ts`
- Modify: `/Users/felix/Projects/ella/apps/api/src/services/auth/index.ts` if helper contract needs adjustment
- Modify: `/Users/felix/Projects/ella/apps/api/src/routes/team/__tests__/team-routes.test.ts`
- Modify: `/Users/felix/Projects/ella/apps/api/src/services/auth/__tests__/auth.test.ts`
- Modify: `/Users/felix/Projects/ella/apps/api/src/routes/__tests__/manager-role-authorization.test.ts`
- Create: `/Users/felix/Projects/ella/apps/api/src/routes/team/team-clerk-errors.ts`
- Create: `/Users/felix/Projects/ella/apps/api/src/routes/team/team-clerk-membership-access.ts`
- Create: `/Users/felix/Projects/ella/apps/api/src/routes/team/team-member-access-removal.ts`
- Create: `/Users/felix/Projects/ella/apps/api/src/routes/team/team-membership-reconciliation.ts`
- Read: `/Users/felix/Projects/ella/apps/api/src/services/clerk-webhook/index.ts`
- Read: `/Users/felix/Projects/ella/apps/api/src/lib/staff-role-mapping.ts`

## Implementation Steps

1. Update auth middleware:
   - Do not include `!staff.isActive` in the generic bootstrap trigger when staff belongs to selected org.
   - Explicitly return 403 for inactive Staff before sync.
   - Keep bootstrap for missing Staff, missing org, or org mismatch.
2. Replace/remove unsafe archive semantics:
   - Keep existing endpoint only if needed for backward compatibility, but do not use it in UI.
   - Prefer making `DELETE /team/members/:staffId` the canonical "remove access" endpoint.
   - Allow delete endpoint to target inactive Staff if Clerk membership still exists.
3. Make Clerk removal fail-closed:
   - Remove current catch-and-continue behavior.
   - Continue only for known "membership not found" responses.
   - Return structured error for rate limits, permission failures, network errors.
4. Add reconciliation read endpoint:
   - Suggested: `GET /team/reconciliation` admin-only.
   - Fetch DB Staff rows for org.
   - Fetch Clerk organization memberships with pagination (`limit` up to Clerk max).
   - Fetch pending invitations.
   - Return counts plus row statuses.
5. Add optional repair endpoint only if needed after Phase 1:
   - Preferred minimal approach: use same remove endpoint for `ARCHIVED_STILL_IN_CLERK`.
   - Do not add bulk repair yet.
6. Activity log:
   - Log member removed from Clerk org and local archive result.
   - Include safe metadata: staffId, previousRole, hadClerkMembership, clerkRemovalResult.
   - Do not log tokens or full raw Clerk error payloads.
7. Tests:
   - Remove access calls Clerk then deactivates DB.
   - Clerk failure prevents DB deactivation.
   - Already missing Clerk membership deactivates DB idempotently.
   - Archived member still in Clerk can be removed.
   - Inactive Staff login is rejected, not reactivated.
   - Reconciliation endpoint returns all mismatch states.

## Todo List

- [x] Patch `authMiddleware` inactive-staff behavior.
- [x] Patch canonical remove endpoint to be Clerk-first and fail-closed.
- [x] Convert legacy archive endpoint to same safe removal flow.
- [x] Add reconciliation endpoint and DTO.
- [x] Add backend tests.
- [x] Run API type-check and focused tests.

## Success Criteria

- [x] No endpoint can silently create Staff/Clerk mismatch on removal.
- [x] Archived Staff who still occupy Clerk seats are visible and removable.
- [x] Inactive Staff cannot regain access via auth bootstrap.
- [x] Backend tests cover success, failure, idempotent missing-membership, and mismatch states.

## Validation

- `pnpm -F @ella/api type-check` pass
- `pnpm -F @ella/api test -- src/routes/team src/services/auth src/services/clerk-webhook src/routes/__tests__/manager-role-authorization.test.ts` pass, 127 tests
- `git diff --check` pass

## Risk Assessment

- Risk: Clerk SDK error shape differs by version.
  - Mitigation: Add defensive helper that checks common Clerk `errors[0].code`, status, and message. Unknown errors fail closed.
- Risk: Re-invited inactive staff may hit API before webhook reactivates.
  - Mitigation: Accept this as safer. UI should show invitation pending; user retries after accept/webhook.
- Risk: Team route file grows too large.
  - Mitigation: Extracted Clerk errors, membership removal, access-removal flow, and reconciliation helpers under `apps/api/src/routes/team/`.

## Security Considerations

- Admin-only via existing `requireOrgAdmin`.
- Self-removal remains blocked.
- Last active admin protection should apply to role demotion and removal.
- Never delete Staff rows; keep audit and historical assignments.

## Next Steps

- Phase 3 wires reconciliation and remove access into workspace UI.
