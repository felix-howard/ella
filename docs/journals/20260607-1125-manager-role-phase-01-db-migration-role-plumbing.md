# Manager Role Phase 1: DB Migration & Role Plumbing

**Date**: 2026-06-07 11:25
**Severity**: High
**Component**: Authentication & Authorization (Staff.role RBAC)
**Status**: DONE
**Commit**: 53f81822

## What Happened

Implemented Phase 1 of the 5-phase MANAGER role rollout: added MANAGER enum value to Prisma, created additive migration, and built core role-syncing infrastructure with explicit preservation rules to prevent silent downgrades.

## The Brutal Truth

This phase exposed a pre-existing bug in auth sync logic that would have corrupted custom roles silently on every re-auth. We designed preservation rules that trust Clerk only during initial onboarding, not during re-syncs. That's good engineering, but it also means our auth layer now has *two separate trust models* (Clerk-first for new users, app-state-first for existing members), which adds cognitive load and risk surface if not documented ruthlessly.

The team API contract is now broken between backend (app-level enum) and frontend (still expects Clerk roles). This is acceptable per plan because Phase 4 unifies it, but it's a window where a careless merge could ship an incoherent state.

## Technical Details

### DB Migration
- **File**: `packages/db/prisma/migrations/20260607040712_add_manager_role/migration.sql`
- **Change**: Added `'MANAGER'` to `StaffRole` enum (additive, zero downtime)
- **Status**: `prisma migrate status` confirms DB in sync
- Schema update in `packages/db/prisma/schema.prisma`: `StaffRole` now includes `MANAGER`

### Role Mapping Module
- **File**: `apps/api/src/lib/staff-role-mapping.ts` (73 lines, new)
- **Purpose**: Single source of truth for bidirectional role translation
  - App roles: `['ADMIN', 'MANAGER', 'MEMBER']`
  - Clerk org role: all non-admin map to `'org:member'` (no Clerk schema change)
  - Staff.role in database: canonical authority for authorization gating
- **Key Function**: `resolveStaffRoleFromClerk(clerkRole, isActiveMember, existingStaffRole)`
  - Encodes the preserve rule: MANAGER/CPA never downgrade during sync
  - Only `ADMIN` ↔ non-admin transitions are Clerk-driven
  - Returns `existingStaffRole` if user is active member in org

### Auth Sync Preserve Rule (Critical Design)
**Problem**: `syncStaffFromClerkMembership` was unconditionally overwriting Staff.role on every membership event, causing MANAGER→STAFF silent degradation.

**Solution**: Implemented three-layer trust logic:
1. **Fresh Joins** (no Staff record OR not active member): Trust Clerk invitation metadata `publicMetadata.staffRole` 
   - Discriminator: `isActiveMember` checks `organizationId` assignment
   - Caught during code review: initial fix trusted metadata unconditionally; fix added activation check since `user.created` webhook pre-creates records with null `organizationId`
2. **Re-syncs** (already active member): Preserve existing `Staff.role`
   - Clerk-driven changes only if org-level membership structure changes (removal)
3. **Non-admin Clerk roles** (`'org:member'`): Always map to app-level `MEMBER` to prevent future inflation

**Code Sites**:
- `apps/api/src/services/auth/index.ts:43-70`: `syncStaffFromClerkMembership` with preserve logic
- `apps/api/src/services/clerk-webhook/index.ts:86-125`: `membership.updated` webhook resyncing without downgrade risk

### Team API Contract Change
- **File**: `apps/api/src/routes/team/index.ts` & `schemas.ts`
- **Before**: API returned Clerk roles (`org:admin`, `org:member`, `org:owner`)
- **After**: Returns app-level enum (`ADMIN`, `MANAGER`, `MEMBER`)
- **Impact**: Web client is now out of contract until Phase 4
  - Tests updated (74 lines of new test cases, 35 new unit tests for preserve rule)
  - Contract breakage is localized to team roster endpoint
  - Accepted because unification happens in Phase 4 same branch

### Known Risk: ADMIN↔MANAGER Race Condition
- **Scenario**: Admin clicks "Demote to MANAGER" (direct DB PATCH), simultaneously Clerk webhook fires `membership.updated`
- **Window**: Milliseconds between DB write and webhook processing
- **Outcome**: Could leave user as ADMIN while sync tries to apply MANAGER
- **Mitigation**: Documented in code comment (M1) as accepted ms-scale race; not critical because:
  - Window is tiny (webhook latency ~50ms)
  - Next re-auth cycle corrects it
  - Admin UI refresh would show stale state but not break security
- **Alternative Rejected**: Event sourcing or distributed locks (YAGNI for current scale)

## What We Tried

1. **Unconditional metadata trust**: Initial implementation trusted Clerk metadata on every sync → code review caught it → added `isActiveMember` discriminator
2. **Preserving Clerk org roles**: Rejected because it requires Clerk schema changes and adds external dependency
3. **Flat permission model**: Rejected (YAGNI) for role enum approach used

## Root Cause Analysis

The pre-existing sync-overwrites-role bug existed because auth logic was written without explicit trust boundaries. The fix codifies two separate mental models:
- **Onboarding trust model**: Clerk metadata is authoritative for initial role assignment
- **Existing-member trust model**: App state is authoritative; Clerk only signals membership changes

This dual-model design prevents data loss but adds complexity. The real root cause of needing it: Clerk webhooks fire asynchronously and app needs to survive stale metadata from prior operations.

## Lessons Learned

1. **Auth sync logic is a data corruption vector**: Unconditional overwrites of application state during bootstrap flows are silent failures. Always have an explicit preservation rule.
2. **Two-phase trust models need guard clauses**: The `isActiveMember` discriminator based on `organizationId` assignment order matters — code must document the initialization sequence.
3. **API contract breakage needs windows**: Breaking a team endpoint API contract is acceptable *only if* the window is bounded (Phase 4 is 1-2 dev days away) and tests cover both sides.
4. **Millisecond races are real but livable**: We could eliminate the ADMIN→MANAGER race with distributed locks, but at current scale it's not worth the complexity. Document it and move on.

## Next Steps

**Phase 2**: Backend authorization gating (June 7)
- Add `canAccessClient`, `canManageAssignments`, `canAccessPhoneData` checks using new role mapping
- Test all permission transitions
- Verify MANAGER gets correct scopes

**Unresolved**: Should we add Prisma middleware to prevent future accidental role overwrites? Could catch this at DB level. Low priority; code review now catches it.

---

**Status**: DONE
