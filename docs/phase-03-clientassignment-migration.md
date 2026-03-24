# Phase 3: Frontend UI Updates - ClientAssignment N:N to managedById FK Migration

**Date:** 2026-03-25 | **Status:** Complete | **Branch:** fix/more-bug

**In One Sentence:** Migrated client-manager relationship from N:N ClientAssignment model to N:1 managedById foreign key, eliminating multi-staff assignment UIs.

---

## Overview

Architectural change from many-to-many staff-client assignments to single-manager design:
- **Before:** Client.ClientAssignment[] → multiple staff members can manage one client
- **After:** Client.managedById → exactly one staff member manages each client

**Impact:** Simplifies client ownership model, eliminates complex assignment dialogs, reduces database queries.

---

## Key Changes

### Database Schema (Phase 2, Referenced)
- ❌ Removed: `ClientAssignment` model (N:N bridge table)
- ✅ Added: `Client.managedById` (FK to Staff)
- Migration created: `prisma/migrations/[timestamp]_client_managed_by`

### API Layer (Phase 2, Referenced)
- `GET /team/members/:staffId/profile` - Response property renamed from `assignedClients` → `managedClients`
- `GET /clients` - Includes `managedBy` relation with staff details
- No assignment create/delete endpoints needed

### Frontend Type Changes
- **File:** `apps/workspace/src/lib/api-client.ts`
- ❌ Removed: `ClientAssignment` type, `assignmentClient`, `unassignmentClient` methods
- ✅ Added: `managedBy: { id, fullName, avatarUrl }` on Client type

### Deleted Components (Assignment Features)
1. `client-assignment-section.tsx` - Removed whole component
2. `bulk-assign-dialog.tsx` - Removed multi-select staff dialog
3. `member-assignments-panel.tsx` - Removed staff assignment panel in team page

---

## Components & Pages Modified

### Client Overview Tab
**File:** `apps/workspace/src/components/clients/client-overview-tab/`

**Changes:**
- ❌ Removed `InlineAssignment` component (edit manager)
- ✅ Replaced with read-only manager display in `client-assigned-staff.tsx`
- Shows `managedBy.fullName` with staff avatar
- Single manager display (no multiple assignments)
- No inline edit capability (edit via team member profile instead)

**Related:** `index.tsx` updated to match component API

### Client List Table
**File:** `apps/workspace/src/components/clients/client-list-table.tsx`

**Changes:**
- ✅ Added "Managed By" column (display name only)
- Column only visible to admins (`isAdmin` prop required)
- Reads from `managedBy.fullName`
- Click-through to staff member profile

**Implementation:** Added `isAdmin` prop passed from parent route

### Client Detail Route
**File:** `apps/workspace/src/routes/clients/$clientId.tsx`

**Changes:**
- ❌ Removed `InlineAssignment` import/usage
- ❌ Removed `AssignDropdown` import/usage
- Client detail tabs unchanged except Overview tab
- Bulk assignment actions removed

### Clients Index Route
**File:** `apps/workspace/src/routes/clients/index.tsx`

**Changes:**
- ✅ Added `isAdmin` prop extraction from `useOrgRole()`
- Pass to `ClientListTable` for conditional "Managed By" column
- No API changes (same endpoint structure)

### Team Member Components
**File:** `apps/workspace/src/components/team/team-member-table.tsx`

**Changes:**
- ✅ Replaced `assignedClients: ClientAssignment[]` with `managedClients: Client[]`
- Shows count of clients managed by each staff member
- Simplified query (no join needed)
- Link to member profile shows `managedClients` list

**Related:** `index.ts` exports updated (removed deleted component exports)

### Team Member Profile
**File:** `apps/workspace/src/routes/team/profile/$staffId.tsx`

**Changes:**
- ✅ Uses `managedClients` instead of assigned clients
- Calls `GET /team/members/:staffId/profile`
- Displays single list of managed clients
- No assignment UI

### Assigned Clients List (Profile)
**File:** `apps/workspace/src/components/profile/assigned-clients-list.tsx`

**Changes:**
- i18n key updates: `assignment.*` → `managed.*` keys
- Component logic unchanged (maps over array)
- Updated labels to reflect single-manager semantics

---

## Localization (i18n) Updates

**Files Modified:**
- `apps/workspace/src/locales/en.json`
- `apps/workspace/src/locales/vi.json`

**Key Replacements:**

| English (en.json) | Vietnamese (vi.json) | Usage |
|---|---|---|
| `managed.heading` | `Khách hàng được quản lý` | Client overview section header |
| `managed.noAssignment` | `Chưa được gán nhân viên` | When no manager assigned |
| `managed.manager` | `Quản lý bởi` | "Managed by" label |
| `team.managedCount` | `Quản lý {count} khách hàng` | Staff member card |

**Removed Keys:**
- `assignment.*` (old many-to-many terminology)
- `assignment.add`, `assignment.remove`, `assignment.bulk`

---

## Related API Response Updates

**Endpoint:** `GET /team/members/:staffId/profile`
**File:** `apps/api/src/routes/team/index.ts`

**Response Changes:**
```typescript
// Before
{
  staff: { id, fullName, role },
  assignedClients: ClientAssignment[] // N:N join result
}

// After
{
  staff: { id, fullName, role },
  managedClients: Client[] // Direct FK query
}
```

**Endpoint:** `GET /clients`
**File:** `apps/api/src/routes/clients/index.ts`

**Response Changes:**
```typescript
// Includes managedBy relation
clients: [{
  id,
  fullName,
  // ... other fields
  managedBy: {
    id,
    fullName,
    avatarUrl
  }
}]
```

---

## Migration Summary

| Category | Deleted | Added | Modified |
|---|---|---|---|
| **Components** | 3 (assignment dialogs/panels) | 0 | 2 (overview tab, profile list) |
| **Pages** | 0 | 0 | 3 (clients list, detail, team profile) |
| **API Types** | ClientAssignment, 2 methods | None | Client type |
| **i18n Keys** | 12 (assignment.*) | 4 (managed.*) | Various labels |
| **API Endpoints** | 0 | 0 | 2 (response renamed) |

---

## Testing Checklist

- [x] Client list shows "Managed By" column (admin only)
- [x] Single manager displayed in client overview
- [x] Team member shows managed client count
- [x] Staff profile route fetches managedClients
- [x] All i18n keys updated (EN/VI)
- [x] TypeScript compilation passes
- [x] No dead component imports
- [x] API response structure matches

---

## Files Changed

**Frontend Deletions:**
- `apps/workspace/src/components/clients/client-assignment-section.tsx`
- `apps/workspace/src/components/clients/bulk-assign-dialog.tsx`
- `apps/workspace/src/components/team/member-assignments-panel.tsx`

**Frontend Modifications:**
- `apps/workspace/src/lib/api-client.ts` (types)
- `apps/workspace/src/components/clients/client-overview-tab/client-assigned-staff.tsx` (read-only display)
- `apps/workspace/src/components/clients/client-overview-tab/index.tsx` (component cleanup)
- `apps/workspace/src/components/clients/client-list-table.tsx` (new column)
- `apps/workspace/src/routes/clients/$clientId.tsx` (remove assignment UI)
- `apps/workspace/src/routes/clients/index.tsx` (add isAdmin prop)
- `apps/workspace/src/components/team/team-member-table.tsx` (managedClients)
- `apps/workspace/src/components/team/index.ts` (export cleanup)
- `apps/workspace/src/components/profile/assigned-clients-list.tsx` (i18n updates)
- `apps/workspace/src/routes/team/profile/$staffId.tsx` (managedClients)
- `apps/workspace/src/locales/en.json` (i18n)
- `apps/workspace/src/locales/vi.json` (i18n)

**Backend Modifications:**
- `apps/api/src/routes/team/index.ts` (response property renamed)
- `apps/api/src/routes/clients/index.ts` (managedBy include)

---

## Architectural Notes

### Data Flow Simplification
**Before:** Client lookup → ClientAssignment filter → Staff list → Render multiple managers
**After:** Client lookup → Direct managedBy relation → Single staff object → Render manager

### Permission Model Impact
- Admin can still view all clients + their manager assignments
- Staff can only view their own managed clients (scoped via `buildClientScopeFilter`)
- No cross-staff visibility changes

### UI Pattern Change
- Moved from "assign multiple staff" to "set one manager"
- Assignment now implicit in client ownership
- Clearer responsibility model for staff accountability

---

## Next Steps

1. **Testing:** Run full frontend test suite (vitest)
2. **Database:** Verify migration applied on staging/production
3. **Deployment:** Deploy backend first (API changes), then frontend (UI changes)
4. **QA:** Verify client list, team page, and profile pages render correctly
5. **Monitoring:** Check for orphaned clients (no manager assigned) in production

---

## Rollback Plan

If issues occur:
1. Revert branch to previous commit
2. Run migration rollback: `prisma migrate resolve --rolled-back [migration-name]`
3. Restore deleted components from git history
4. Re-deploy backend + frontend

---

## Questions/Blockers

- None at this time. Phase 2 (database) and Phase 3 (frontend) are complete.
