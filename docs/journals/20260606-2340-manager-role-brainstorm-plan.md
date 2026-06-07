# Manager Role Brainstorm & Planning

**Date**: 2026-06-06 23:40
**Severity**: Medium
**Component**: Authentication & Authorization (Staff.role RBAC)
**Status**: DONE

## What Happened

Completed scout → brainstorm → plan session for new MANAGER tier. Owner required assistant role with near-admin visibility (all clients, client assignment, admin config access) but strict boundaries: no team management or client phone access.

## Technical Decisions Made

### 1. Enum Addition (Rejected Alternatives)
- **Decision**: Add `MANAGER` to `StaffRole` Prisma enum
- **Rejected**: Permission-flags table (YAGNI — 5 permission sets don't justify schema complexity)
- **Rejected**: Repurpose CPA model (wrong semantics; CPA is expertise, not role)

### 2. Phone Data Architecture
- **Decision**: Move phone masking SERVER-SIDE via response interceptor; full number only for ADMIN
- **Impact**: Also fixes existing security gap — STAFF currently masked only in frontend, exposing full phone via DevTools network tab
- **Risk Mitigated**: Prevents client data leakage through API inspection

### 3. Clerk Integration
- **Decision**: Keep MANAGER as `org:member` in Clerk; app-level `Staff.role` is source of truth
- **Rationale**: Avoids Clerk org schema changes; Staff.role drives all gating

## Critical Risk Discovered

`syncStaffFromClerkMembership` (apps/api/src/services/auth.ts) unconditionally downgrades any existing Staff record to STAFF when org membership re-syncs. Would silently degrade MANAGER → STAFF on every re-auth.

**Plan Phase 1 addresses**: Add preserve rule to protect custom roles during sync.

## Artifacts Generated

- **Brainstorm Report**: `/plans/reports/brainstorm-260606-2259-GH-20260605-manager-role.md`
- **5-Phase Plan**: `/plans/260606-2259-GH-20260605-manager-role/`
  - Phase 1: DB migration + sync preserve logic
  - Phase 2: Backend gating (MANAGER permissions)
  - Phase 3: Server-side phone masking
  - Phase 4: Frontend UI/flag updates
  - Phase 5: Tests & docs

## Lessons Learned

Frontend-only security controls create false confidence; phone masking must be server-enforced. Sync logic that overwrites application state without validation is a silent corruption vector — add explicit preservation rules during auth flows.

---

**Status**: DONE
