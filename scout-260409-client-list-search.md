# Scout Report: Client List Page & Search/Filter Logic

Status: Complete - All files located and analyzed

## Key Files Found

### Frontend Components
- C:\Users\Admin\Desktop\ella\apps\workspace\src\routes\clients\index.tsx
- C:\Users\Admin\Desktop\ella\apps\workspace\src\components\clients\client-list-table.tsx
- C:\Users\Admin\Desktop\ella\apps\workspace\src\hooks\use-debounced-value.ts
- C:\Users\Admin\Desktop\ella\apps\workspace\src\lib\api-client.ts

### Backend API
- C:\Users\Admin\Desktop\ella\apps\api\src\routes\clients\index.ts
- C:\Users\Admin\Desktop\ella\apps\api\src\routes\client-groups\index.ts

## Client List Page (/apps/workspace/src/routes/clients/index.tsx)

### Search & Filter Controls
- **Search Input**: Debounced 300ms, searches name/phone fields
- **Managed By Dropdown**: Admin-only filter by staff member
- **Tag Filter**: Single tag selection from available tags
- **Client Type Filter**: All / Individuals / Businesses toggle buttons
- **Attention Chips**: New Uploads, Needs Verification, Stale, Ready for Entry

### State Management
```
searchQuery → useDebouncedValue (300ms) → useQuery queryKey includes all filters
managedById, tagFilter, attention, clientTypeFilter
```

### API Integration
- Calls `api.clients.list()` with all filter parameters
- Uses React Query with `keepPreviousData` for smooth UX
- Receives `ClientWithActions[]` + `attentionSummary`

## Client List Table (/apps/workspace/src/components/clients/client-list-table.tsx)

### Business-Individual Linking
The `groupClients()` function (lines 33-78):
- Groups clients by `clientGroupId`
- Sorts within groups: INDIVIDUAL first, then BUSINESS
- BUSINESS rows indented and labeled "Linked to: [Owner Name]"
- Groups appear at position of first member in API order

### Table Columns
1. Name + Avatar (Business icon or initials)
2. Phone (masked for non-admin)
3. Tax Year
4. Tags
5. Document Count
6. Managed By (admin only)
7. Created Date
8. Uploads (new count + latest time)
9. Action Badges

## Backend Search Logic (/apps/api/src/routes/clients/index.ts)

### GET /clients Search (lines 106-120)
Searches across:
- firstName (case-insensitive)
- lastName (case-insensitive)
- name (case-insensitive)
- phone (normalized: strip non-digits, match >= 3 digits)

### Filter Logic (lines 122-134)
- `managedById`: Staff member (admin only)
- `tag`: Client tags array
- `clientType`: INDIVIDUAL or BUSINESS

### Attention Filter (lines 319-336)
Post-fetch filtering on computed fields:
- newUploads: uploads.newCount > 0
- needsVerification: actionCounts.toVerify > 0
- stale: actionCounts.staleDays >= 7
- readyForEntry: computedStatus === 'READY_FOR_ENTRY'

### Upload Stats (lines 188-221)
Raw SQL query per client:
- totalCount: All RawImage records
- newCount: RawImages without DocumentView for current staff
- latestAt: Most recent upload date

### Response Structure
```
{
  data: ClientWithActions[]
  pagination: { page, limit, total, totalPages }
  attentionSummary: {
    newUploads: number,
    needsVerification: number,
    stale: number,
    readyForEntry: number
  }
}
```

## Client Groups System (/apps/api/src/routes/client-groups/index.ts)

### Linking Mechanism
- ClientGroup record holds group metadata
- Clients have `clientGroupId` field pointing to group
- POST /client-groups: Create group and link clients
- PATCH /client-groups/:id: Add/remove clients from group
- DELETE /client-groups/:id: Delete group and unlink all

### Client Detail Cross-Links
- Fetches `clientGroup.clients` (excluding self)
- Displays in banner showing sibling clients
- Quick navigation links between linked accounts

## Business-Individual Client Handling

### In Search Results
- Both INDIVIDUAL and BUSINESS appear in results
- clientGroupId preserved for grouping
- Frontend reconstructs groups via groupClients() function

### In Detail Page
- Cross-link banner shows all group members
- Sibling clients displayed as quick navigation
- Auto-excludes current client

### Filtering by Type
- clientType=INDIVIDUAL: Only individuals
- clientType=BUSINESS: Only businesses
- Can filter within a linked group

## Key Implementation Details

### Debouncing
- useDebouncedValue hook (300ms delay)
- Returns [debouncedValue, isPending]
- Prevents excessive API calls while typing
- Loading spinner shows during pending state

### Org Scope
- buildClientScopeFilter(user) applied at DB level
- Multi-tenant: organizationId filter
- Staff scope: Non-admins see only own clients

### Phone Normalization
- Strips non-digits for matching
- Requires >= 3 digits to avoid false positives
- Database stores E.164 format

### Pagination
- Limit: 100 (hardcoded in frontend)
- Page parameter in query
- Attention filter applied post-fetch (client-side)

## API Client (Workspace)

### api.clients.list(params)
Parameters:
- page?: number
- limit?: number
- search?: string (name or phone)
- managedById?: string (staff ID)
- attention?: 'newUploads' | 'needsVerification' | 'stale' | 'readyForEntry'
- tag?: string
- clientType?: 'INDIVIDUAL' | 'BUSINESS'

### api.clients.tags()
- Fetches distinct tag list for filter dropdown
- Uses raw SQL: SELECT DISTINCT unnest(tags)

### Related Methods
- api.clients.get(id): Single client with clientGroup data
- api.clients.searchByPhone(phone): Search by phone normalization

## Type Definitions

### ClientWithActions
- id, firstName, lastName, name
- phone, email, language, source
- tags, clientType, clientGroupId, businessType
- createdAt, updatedAt
- computedStatus: TaxCaseStatus | null
- managedBy: { id, name, avatarUrl } | null
- actionCounts: { missingDocs, toVerify, toEnter, staleDays, hasNewActivity }
- uploads: { newCount, totalCount, latestAt }
- hasUploadLink: boolean
- latestCase: { id, taxYear, taxTypes, isInReview, isFiled, lastActivityAt }

### AttentionSummary
```
{
  newUploads: number
  needsVerification: number
  stale: number
  readyForEntry: number
}
```

## Summary

Complete client list implementation with:
- Server-side search (name/phone)
- Multiple filter types (staff, tags, entity type, attention status)
- Business-individual client grouping system
- Debounced search for performance
- Real-time attention status badges
- Responsive table with mobile-aware columns
- Cross-link navigation between grouped clients
