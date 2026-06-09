# Manager Role Phase 4: Frontend UI Role Capability Flags

**Date**: 2026-06-07 15:07
**Severity**: High
**Component**: Frontend role model, UI conditional rendering, role/permission contracts
**Status**: DONE
**Commit**: ff118f04

## What Happened

Phase 4 refactored every admin-gated UI component in apps/workspace to consume semantic capability flags (`isManager`, `canManageClients`, `canViewPhone`, `canManageTeam`) from a new `useOrgRole()` hook instead of checking raw `isAdmin` literals. Also aligned the app-level role contract so invite/profile dialogs post `AppRole` ('ADMIN'|'MANAGER'|'MEMBER') matching the backend, with pending invites displaying `staffRole` labels. Phone formatter now passes through masked values (containing `*`) to prevent corruption of server-masked numbers like `*** *** 1234`. Result: 30 files touched, 76/76 vitest passed, tsc clean, vite build clean.

## The Brutal Truth

The painful part: **every single UI check was scattered.** We reclassified nav visibility, client list/detail, settings cards, chatbox phone displays, pricing shell access, team routes — 30 files, mostly one-off `isAdmin` literals that had to be judged individually. There's no exhaustive list of "where does admin gating happen in React" — you grep, find 15 hits, fix them, build, test, find 3 more. This phase would've been 2x shorter if the original code had a central conditional component or a role/permission hook from the start.

Also irritating: `CPA` as a legacy org role had to be mapped to `MEMBER` in the role select dialog, with a dirty-check to prevent silently demoting CPA→STAFF on unchanged profile form saves. That's a technical debt patch that shouldn't exist — CPA should've been migrated off the UI layer years ago.

The confidence blocker: org-slug and firm-info are now accessible to MANAGER (per plan default "open to MANAGER via `canManageClients`"), but flagged as potentially sensitive. Product hasn't confirmed whether MANAGER should see org-level metadata. We shipped it but left the question open.

## Technical Details

### New `useOrgRole()` Hook
Location: `apps/workspace/src/hooks/use-org-role.ts`

```typescript
export function useOrgRole() {
  const role = useAuth()?.orgRole; // 'ADMIN' | 'MANAGER' | 'MEMBER'
  
  return {
    role,
    isManager: role === 'MANAGER',
    canManageClients: role === 'ADMIN' || role === 'MANAGER',
    canViewPhone: role === 'ADMIN',           // MANAGER cannot view unmasked
    canManageTeam: role === 'ADMIN',          // MANAGER cannot touch team
  };
}
```

### Reclassified Components & Routes
- **Nav**: Member path hides "Settings"; Manager/Admin show full nav (27 files)
- **Client List/Detail**: Both visible to Manager via `canManageClients`; phone display checks `canViewPhone` (4 files)
- **Settings Cards** (firm-info, org-slug, agreement-templates, team mgmt): Split by flag (6 files)
- **Chatbox/Voice**: Phone display checks `canViewPhone`, passes through `*` characters (2 files)
- **Pricing Shell**: `canAccess` prop replaces inline `isAdmin` (1 file)
- **Team Routes**: Guarded by `canManageTeam`; non-admins 404 (3 files)

### Role Contract Alignment (App-Level)
- **Invite Dialog** & **Profile Role Select**: Now post `AppRole` ('ADMIN'|'MANAGER'|'MEMBER') to match backend schema
- **Pending Invite Labels**: Display `staffRole` (legacy field); fallback to `MEMBER` if missing
- **CPA Migration**: `staffRoleToAppRole()` maps CPA→MEMBER; form includes dirty-check flag `cpaDemotionPrevented` to warn on unchanged save

### Phone Formatter Passthrough
Location: `apps/workspace/src/lib/format-phone.ts:8-12`

```typescript
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.includes('*')) return phone; // Server-masked value, passthrough
  // ... Twilio formatting logic ...
}
```

Prevents corruption of `*** *** 1234` into `1234`.

### Validation
- `tsc` clean, `vite build` clean
- `76/76 vitest` (added 3-case sidebar nav test including manager tier)
- Code-reviewer approved with only minor non-blocking notes (e.g., naming consistency on `canManageTeam` vs `canManageTeamFeature`)

## What We Tried

1. **Inline conditional rendering vs. centralized hook**: Initially considered keeping scattered `isAdmin` checks and adding a permission layer above them. Rejected — would require middleware wrapping and still leave brittle literals. Hook-based approach is cleaner and matches existing patterns in codebase.

2. **Role enum vs. string literals**: Debated whether to introduce a `Role` enum or keep string literals for serialization compatibility. Chose literals — enum would require mapper boilerplate and the hook hides implementation anyway.

3. **`canManageClients` scope**: Decided to include org-slug and firm-info access under this flag per plan. Alternative was to keep org-slug ADMIN-only; current choice is more permissive and may need product review.

## Root Cause Analysis

Why 30 files? The codebase predates any centralized role/permission system. Auth check was `useAuth()?.orgRole === 'ADMIN'` scattered everywhere. Every UI boundary had its own check — no composition, no reuse. The hook extracted 30 of these and unified them, but it also exposed the lack of upfront design: this should have been a Day-1 decision, not Phase-4 refactoring.

Why the CPA-mapping complexity? Legacy product had three role tiers (CPA, MANAGER, ADMIN); backend now has (MEMBER, MANAGER, ADMIN). Frontend still has stale UI showing CPA as an option. Mapping it at the component level is a patch; real fix is migrating the entire CPA → MEMBER cohort and removing the option from the UI.

## Lessons Learned

1. **Centralize role/permission checks early.** If you have scattered `isAdmin` conditionals at Day-1, you'll have 30+ files to refactor later. Use a hook or context from the start.

2. **Components consume flags, not roles.** Never pass `role: string` to a component and let it decide `if (role === 'ADMIN')`. Pass semantic flags: `canViewPhone`, `canManageClients`. If the rule changes (e.g., Manager gets phone access), change the hook, not 15 components.

3. **Data integrity for serialization.** When spanning client/server contracts, keep EXACTLY what the server sends. `formatPhone()` passthrough for `*` characters prevents subtle data corruption that only surfaces in production when someone tries to call a masked number.

4. **Legacy role migrations need explicit handoff.** CPA→MEMBER mapping shouldn't live in component props. It should be a migration script or a deprecation notice, not a dirty-check flag in the form. Current solution works but signals unmigrated technical debt.

5. **Confirm permission scope with product.** We opened org-slug/firm-info to MANAGER based on "default open per plan rule," but product hasn't explicitly approved this. Always flag scope decisions as "unconfirmed" if there's ambiguity.

## Next Steps

**Phase 5** (Testing & Manual QA): Raw integration tests for role-based UI visibility (nav member path, settings visibility, team 404). Manual verification of phone masking in chatbox and client detail. Confirm org-slug/firm-info scope with product before main merge.

**Technical Debt**:
- Migrate entire CPA cohort from profile role select; remove option and deprecate staffRole='CPA'
- Add role/permission testing utility to `apps/workspace/__tests__/mocks/` for easier role-scoped test setup

---

**Unresolved Questions**:
- Should MANAGER really see org-slug and firm-info (opened per plan default, not confirmed with product)?
- Should CPA be supported in the UI role select indefinitely, or hard-migrated to MEMBER?

**Status**: DONE
**Summary**: Refactored 30 frontend files to consume semantic role flags instead of scattered `isAdmin` literals; aligned app-level role contract (AppRole posting); handled phone masking passthrough; flagged org-scope sensitivity for product confirmation.
