---
phase: 1
title: "Audit current Team and Clerk contracts"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Audit current Team and Clerk contracts

## Context Links

- [Scout Report](./reports/scout-report.md)
- Clerk remove membership docs: https://clerk.com/docs/reference/backend/organization/delete-organization-membership
- Clerk list membership docs: https://clerk.com/docs/reference/backend/organization/get-organization-membership-list
- Clerk webhook docs: https://clerk.com/docs/guides/development/webhooks/overview

## Overview

Establish the exact source-of-truth contract and current mismatch states before changing behavior. This phase is read-only except tests/docs added for current behavior where useful.

## Key Insights

- DB-only archive is unsafe because `authMiddleware` can reactivate inactive staff from Clerk membership.
- Current production mismatch is explainable from CSV + screenshots: 17 active Staff, 5 archived Staff, 20 Clerk memberships.
- The UI has a hidden correct-ish API (`DELETE /team/members/:id`) but exposes the wrong action (`archive`).

## Requirements

- Functional:
  - Confirm current Team API and auth bootstrap behavior with focused tests or documented assertions.
  - Produce a mismatch taxonomy used by later API/UI phases.
  - Decide exact user-facing language for "Remove access" vs "Archived".
- Non-functional:
  - No production DB writes.
  - No destructive Clerk calls.
  - Keep plan compatible with one-phase-per-cook execution.

## Architecture

Target contract:

```text
Clerk organization membership
  -> source of truth for login access and billable seat

Staff row
  -> app profile, role overlay, client assignment history, docs/invoices, audit trail

Team UI
  -> active list from Staff + live Clerk membership status for admins
  -> archived list keeps Staff rows but shows whether Clerk seat is still occupied
```

## Related Code Files

- Modify: `/Users/felix/Projects/ella/apps/api/src/routes/team/__tests__/team-routes.test.ts`
- Modify: `/Users/felix/Projects/ella/apps/api/src/services/auth/__tests__/auth.test.ts`
- Read: `/Users/felix/Projects/ella/apps/api/src/middleware/auth.ts`
- Read: `/Users/felix/Projects/ella/apps/api/src/routes/team/index.ts`
- Read: `/Users/felix/Projects/ella/apps/api/src/services/auth/index.ts`
- Read: `/Users/felix/Projects/ella/apps/api/src/services/clerk-webhook/index.ts`

## Implementation Steps

1. Add a short test or test TODO around inactive staff login behavior:
   - Current behavior likely reactivates if Clerk membership exists.
   - Mark as failing only if using TDD for Phase 2; otherwise document in test comments.
2. Define mismatch statuses:
   - `ACTIVE_MATCH`: Staff active, Clerk member exists.
   - `ARCHIVED_MATCH`: Staff inactive, Clerk member absent.
   - `ARCHIVED_STILL_IN_CLERK`: Staff inactive, Clerk member exists, seat still used.
   - `ACTIVE_MISSING_CLERK`: Staff active, Clerk member absent, DB stale.
   - `CLERK_MISSING_STAFF`: Clerk member exists, no Staff row.
   - `PENDING_INVITATION`: Clerk invitation pending, no Staff row yet.
3. Confirm how role mapping should display:
   - Clerk role remains `org:admin|org:member`.
   - App role remains `Staff.role`, including MANAGER.
4. Apply managed-client removal decision:
   - Decision: do not block. Show warning. Keep historical assignments.
   - Assignment selectors already use active staff only.
5. Record final contract in phase notes before coding Phase 2.

## Todo List

- [ ] Verify existing route/auth behavior with focused test coverage.
- [ ] Finalize mismatch status names and response DTO shape.
- [ ] Finalize user-facing terms: "Remove access" and "Archived records".
- [ ] Ensure response DTO exposes Clerk seats used but no fixed seat limit.
- [ ] Confirm no DB migration is required.

## Success Criteria

- [ ] Current failure mode is documented in tests or notes.
- [ ] Phase 2 has exact DTO and behavior contract.
- [ ] No production data or Clerk org membership changed.

## Risk Assessment

- Risk: Overbuilding a sync subsystem.
  - Mitigation: Keep Phase 2 to live comparison and explicit admin repair actions only.
- Risk: Blocking staff restoration due to webhook race.
  - Mitigation: Restore by Clerk invite; UI can show pending invitation and ask user to retry after accept.

## Security Considerations

- Treat inactive Staff as denied even if Clerk membership still exists.
- Do not expose Clerk user IDs beyond admin-only team surfaces.
- Do not log sensitive user PII beyond existing staff name/email audit norms.

## Next Steps

- Phase 2 implements backend behavior and reconciliation API.
