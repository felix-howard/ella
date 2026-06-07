# Manager Role Phase 2: Backend Authorization Gating

**Date**: 2026-06-07 13:36
**Severity**: High
**Component**: Authorization & Route Gating (Admin Scope)
**Status**: DONE
**Commit**: 4ca30f7e

## What Happened

Opened ~20 admin-gated routes/handlers to MANAGER role, centralizing all role-based authorization into two reusable predicates (`isAdminOrManager`, `canSeeAllClients`) to eliminate scattered role literals. Team management endpoints remained ADMIN-only per design.

## The Brutal Truth

This phase broke 12 test files at import-time because vi.mock factories didn't export the new middleware. The fix was mechanical (add `requireAdminOrManager` to every mock auth module), but it exposed a painful testing pattern: **middleware exports are implicit dependencies — tests don't fail until you try to import them, not at the callsite.** We should have centralized mocks earlier.

Worse, the grep sweep found ~10 authorization gates beyond the original file map — scattered inline checks, PDFs in different routes, billing checkout logic. Each one required judgment: "Is this admin data that MANAGER should see?" With no product spec on MANAGER boundaries, I made rule-strict calls (e.g., billing checkout opened, org-settings opened, contractor PDFs opened) that may need reversal.

## Technical Details

### New Authorization Layer
- **Predicate**: `isAdminOrManager(role)` in `apps/api/src/lib/org-scope.ts:25-30` — single MANAGER literal location
- **Middleware**: `requireAdminOrManager` in `apps/api/src/middleware/auth.ts:45-50` — consumed by Express routes
- **Scope predicate**: `canSeeAllClients` delegates to `isAdminOrManager`, ensuring org-wide visibility

### Routes Opened to MANAGER (Rule: Everything Except Team Mgmt)
- Admin config endpoints: `/routes/admin/index.ts`
- Client/lead/campaign visibility: `/routes/clients`, `/routes/leads`, `/routes/campaigns`
- Agreements & 1099-NEC forms: `/routes/agreements`, `/routes/agreement-templates`
- Billing checkout: `/routes/billing/index.ts:14` (judgment call — may need product confirmation)
- Org settings mutations: `/routes/org-settings.ts:111` (inline gate opened)
- Staff form slugs & compliance PDFs: `/routes/staff/index.ts:120` (inline gate opened)
- Contractor agreement PDFs: `/routes/contractor-agreements.ts:419+480` (inline gates opened)

### Routes Kept ADMIN-Only (Team Management — 8 Gates)
- `createTeam`, `updateTeam`, `deleteTeam` in `/routes/team/*`
- Rationale: Team lifecycle is org-structural; MANAGER shouldn't modify it per design spec

### Test Fallout & Fixes
- **Broken**: 12 files importing mocked auth middleware; `vi.mock('middleware/auth')` factories lacked `requireAdminOrManager`
- **Fix Pattern**: 
  - 9 files: Added `requireAdminOrManager` as alias to existing simple mocks (noop/identity)
  - 3 files with logic tests (`admin.test.ts`, `billing-route-auth.test.ts`, `managed-by-propagation.test.ts`): Renamed mock + added MANAGER semantics
  - 4 org-scope mocks: Added `canSeeAllClients` to export
- **Lesson**: Module-level mocks break silently on new exports even when unused in that test file. Pre-emptive mock exports are better than per-import patching.

## What We Tried

1. **Inline predicate calls vs. middleware**: Chose middleware-first for new routes, predicates for inline checks (e.g., org-settings). Trade-off: two patterns in same codebase, but it matches existing code style.
2. **Central vs. scattered MANAGER literal**: Centralized in `org-scope.ts`; middleware imports it. Slightly exceeds plan's "two helpers" criterion but eliminates risk of drift.
3. **Billing checkout access**: Opened to MANAGER (rule-strict: "everything except team mgmt"). Flagged as unconfirmed.

## Root Cause Analysis

Why test imports broke: Tests mock at the *module level* before the test runner sees the actual middleware. When we added `requireAdminOrManager` to `auth.ts`, the mock stubs didn't include it, causing `import { requireAdminOrManager } from 'middleware/auth'` to fail in route files. The test didn't fail at the assertion — it failed at the import, cascading through 12 test files. **Root cause**: Our mocks are package-level, not interface-level; missing exports block entire test suites, not individual assertions.

## Lessons Learned

1. **Implicit middleware exports are dangerous in test mocks**: When a route adds a new middleware export, *every test file importing that route breaks at import-time*. Solution: Centralize mock auth exports in a shared test helper, import that instead of mocking individually per file.
2. **Authorization gates need explicit spec**: Grep found ~10 unplanned gates (PDFs, billing, org-settings). Without product boundaries on MANAGER access, judge-call decisions leak into code. Flag these for product review before merging to main.
3. **Rule-strict vs. rule-loose trade-off**: Chose rule-strict (open everything except team mgmt). Trade-off: over-permissive now is safer than under-permissive later (easier to restrict than expand). But it exposes gaps in product spec.
4. **Test import failures cascade**: One missing export in mocked middleware → 12 test files fail → manual triage of each one. Detected early in CI, but painful to fix. Centralized mocks would prevent this.

## Next Steps

**Phase 3** (Server-side phone masking): Add field-level access control for phone data in client queries; MANAGER sees only partially masked numbers per spec.

**Product Review Needed** (before main merge):
- Confirm MANAGER should access billing checkout (currently opened)
- Confirm MANAGER should read org-settings mutations (currently opened)
- Confirm MANAGER should access staff form slugs + contractor PDFs (currently opened)
- Define explicit boundary between MANAGER and ADMIN scopes

**Technical Debt**:
- Centralize mock auth exports in `apps/api/src/__tests__/mocks/auth-middleware.ts` to prevent cascading import failures
- Add JSDoc guard clauses on each authorization predicate documenting MANAGER scope

---

**Unresolved Questions**:
- Should billing checkout really be MANAGER-accessible? (Product spec missing)
- Should org-settings mutations be MANAGER-accessible? (Product spec missing)
- Should contractor agreement PDFs be MANAGER-accessible? (Product spec missing)

**Status**: DONE
**Summary**: Opened admin-gated routes to MANAGER role via centralized authorization predicates; fixed 12 test import cascades; flagged 3 product scope ambiguities for review.
