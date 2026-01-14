# Phase 2: Make It Usable (Core Workflow)

**Status:** Complete
**Completed:** 2026-01-14
**Focus:** Workflow automation, status management, document verification

---

## Overview

Phase 2 transforms Ella from a data collection tool into a functional workflow platform. It introduces state management for tax cases, document verification processes, and efficient search capabilities. This phase enables staff to manage cases through their lifecycle and verify documents before filing.

## Core Features

### 1. Tax Case Status Transitions

**Workflow States (7-state model):**
```
INTAKE (start)
   ↓
WAITING_DOCS (expecting documents)
   ↓
IN_PROGRESS (documents received, validating)
   ↓
READY_FOR_ENTRY (ready for data entry)
   ↓
ENTRY_COMPLETE (all fields entered)
   ↓
REVIEW (final review)
   ↓
FILED (submitted to tax authority)
```

**Key Implementation:**
- File: `packages/shared/src/constants/case-status.ts`
- Functions:
  - `isValidStatusTransition(current, next)` - Boolean validation
  - `getValidNextStatuses(current)` - Returns current + valid transitions
- Single source of truth for both API & frontend
- Prevents invalid state transitions

**API Endpoints:**
- `PATCH /cases/:id` - Update status with validation
- `GET /cases/:id/valid-transitions` - Fetch valid transitions for UI

**Database Timestamps:**
- `entryCompletedAt` - Set when status becomes ENTRY_COMPLETE
- `filedAt` - Set when status becomes FILED
- `updatedAt` - Automatic on every change

**Backend Validation:**
```typescript
// In routes/cases/index.ts PATCH handler
if (!isValidStatusTransition(currentStatus, newStatus)) {
  const validNext = getValidNextStatuses(currentStatus)
  return c.json({
    error: 'INVALID_TRANSITION',
    validTransitions: validNext,
  }, 400)
}
```

### 2. Document Verification Workflow

**Problem Solved:**
- OCR extraction confidence varies (80-99%)
- Manual verification needed before case progression
- Quick reject/resend workflow

**Solution:**
- Staff reviews pending documents
- Accept (VERIFIED) or reject with notes
- Rejected docs trigger resend request via SMS/action

**API Endpoints:**
- `POST /docs/:id/verify-action` - Verify or reject (NEW)
- `PATCH /docs/:id/verify` - Edit extracted data (existing)

**Verify Action Flow:**

```typescript
// POST /docs/:id/verify-action
{
  "action": "verify" | "reject",
  "notes": "Optional reason for rejection" // Only for reject
}
```

**On Verify (action: "verify"):**
- Atomic transaction:
  - DigitalDoc.status → VERIFIED
  - ChecklistItem.status → VERIFIED
  - Set verifiedAt timestamp
- Result: Document considered complete

**On Reject (action: "reject"):**
- Atomic transaction:
  - DigitalDoc.status → PENDING
  - RawImage.status → BLURRY
  - Create Action { type: BLURRY_DETECTED, priority: HIGH }
  - Store notes in Action.metadata
- Result: Staff action created, SMS reminder can be sent

**Document Status Lifecycle:**
- PENDING → Initial state (awaiting verification)
- EXTRACTED → OCR completed successfully
- PARTIAL → OCR partial success (some fields missing)
- VERIFIED → Manually approved by staff
- FAILED → OCR failed completely
- REJECTED → Explicitly rejected by staff (mapped to PENDING after re-upload)

### 3. Frontend Components

#### StatusSelector Component
**File:** `apps/workspace/src/components/cases/status-selector.tsx`

**Props:**
```typescript
interface StatusSelectorProps {
  caseId: string
  currentStatus: TaxCaseStatus
  onStatusChange?: (newStatus: TaxCaseStatus) => void
  disabled?: boolean
}
```

**Features:**
- Dropdown showing only valid transitions
- Loading spinner during API call
- Toast notifications (success/error)
- Accessibility: aria-haspopup, aria-expanded, focus rings
- Color-coded status badges

**Usage:**
```typescript
<StatusSelector
  caseId={case.id}
  currentStatus={case.status}
  onStatusChange={(newStatus) => setCase({...case, status: newStatus})}
/>
```

#### VerificationPanel Component
**File:** `apps/workspace/src/components/documents/verification-panel.tsx`

**Props:**
```typescript
interface VerificationPanelProps {
  documents: DigitalDoc[]
  onRefresh: () => void
}
```

**Features:**
- Lists pending/extracted/partial documents
- Shows document type, confidence %
- Quick verify button (one-click)
- Reject button with optional notes form
- Loading states during actions
- Empty state when all verified

**Usage:**
```typescript
<VerificationPanel
  documents={caseDocuments}
  onRefresh={() => refetchDocuments()}
/>
```

### 4. Server-Side Search

**Improvement:** Real API calls instead of mock data

**Endpoint:** `GET /clients`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)
- `search` - Search name/phone/email (optional)
- `status` - Filter by client status (optional)

**Response:**
```typescript
{
  data: [
    {
      id: string
      name: string
      phone: string
      email: string
      profile: ClientProfile
      _count: { cases: number }
      createdAt: ISO string
    }
  ],
  pagination: {
    page: number
    limit: number
    total: number
  }
}
```

**Frontend Hook:**
```typescript
const [searchTerm, setSearchTerm] = useState('')
const [debouncedTerm, isPending] = useDebouncedValue(searchTerm, 500)
const { data: clients } = useQuery({
  queryKey: ['clients', debouncedTerm],
  queryFn: () => api.clients.list({ search: debouncedTerm })
})
```

### 5. Pagination System

**Problem:** Large datasets overload browser memory

**Solution:** Standardized pagination across endpoints

**Helper Functions:**
- `getPaginationParams(page, limit)` - Calculate skip, validate page/limit
- `buildPaginationResponse(page, limit, total)` - Format response

**Applied To:**
- `GET /cases` - List cases
- `GET /cases/:id/images` - Raw images for case
- `GET /cases/:id/docs` - Digital docs for case
- `GET /clients` - List clients
- `GET /messages/conversations` - List conversations

**Query Parameters:**
```
page=1 (required, min 1)
limit=20 (required, min 1, max 100)
```

**Response Format:**
```typescript
{
  data: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    hasMore: true
  }
}
```

### 6. Debounced Search Hook

**File:** `apps/workspace/src/hooks/use-debounced-value.ts`

**Purpose:** Prevent excessive API calls while user types

**Signature:**
```typescript
function useDebouncedValue<T>(value: T, delay: number): [T, boolean]
// Returns: [debouncedValue, isPending]
```

**Implementation:**
- Tracks debounced value separately
- Returns pending state when value differs
- Configurable delay (default 500ms for search)

**Usage:**
```typescript
const [search, setSearch] = useState('')
const [debouncedSearch, isSearching] = useDebouncedValue(search, 500)

// Fetch only when debounced value changes
useEffect(() => {
  if (debouncedSearch) {
    fetchClients(debouncedSearch)
  }
}, [debouncedSearch])

// Show loading during typing
{isSearching && <Spinner />}
```

### 7. Shared Constants & Types

**File:** `packages/shared/src/constants/case-status.ts`

**Exports:**
```typescript
export type TaxCaseStatus =
  | 'INTAKE'
  | 'WAITING_DOCS'
  | 'IN_PROGRESS'
  | 'READY_FOR_ENTRY'
  | 'ENTRY_COMPLETE'
  | 'REVIEW'
  | 'FILED'

export const VALID_STATUS_TRANSITIONS: Record<TaxCaseStatus, TaxCaseStatus[]>

export function isValidStatusTransition(
  currentStatus: TaxCaseStatus,
  newStatus: TaxCaseStatus
): boolean

export function getValidNextStatuses(
  currentStatus: TaxCaseStatus
): TaxCaseStatus[]
```

**Why Shared?**
- API validates on server
- Frontend shows valid options
- Both use same logic (no sync issues)
- Easier to add new statuses in future

### 8. Enhanced API Client

**File:** `apps/workspace/src/lib/api-client.ts`

**New Methods:**
```typescript
cases: {
  update(id: string, data: { status: TaxCaseStatus }) => Promise<TaxCase>
  getValidTransitions(id: string) => Promise<{
    currentStatus: TaxCaseStatus
    validTransitions: TaxCaseStatus[]
  }>
}

docs: {
  verifyAction(id: string, data: {
    action: 'verify' | 'reject'
    notes?: string
  }) => Promise<{ success: boolean, message: string }>
}
```

**Type Exports:**
```typescript
export type TaxCaseStatus = ...
export type DigitalDoc = ...
export type TaxCase = ...
```

### 9. Action Creation on Document Reject

**Problem:** Rejected documents need follow-up

**Solution:** Auto-create action on reject

**Trigger:**
```
Staff rejects document
  ↓
POST /docs/:id/verify-action { action: 'reject', notes: '...' }
  ↓
Backend creates:
  Action {
    type: 'BLURRY_DETECTED',
    priority: 'HIGH',
    title: 'Yêu cầu gửi lại tài liệu',
    description: notes || 'Document rejected - resend required',
    metadata: {
      rawImageId: id,
      docType: type,
      rejectedDocId: docId
    }
  }
  ↓
Action appears in /actions queue
  ↓
Staff can send SMS reminder via /messages/send
```

## Database Schema Updates

### TaxCase Model
```prisma
model TaxCase {
  id                  String
  status              TaxCaseStatus     // Enforces valid transitions
  entryCompletedAt    DateTime?         // Set on ENTRY_COMPLETE
  filedAt             DateTime?         // Set on FILED
  updatedAt           DateTime          // Auto on every change
}
```

### DigitalDoc Model
```prisma
model DigitalDoc {
  id                  String
  status              DigitalDocStatus  // PENDING|EXTRACTED|PARTIAL|VERIFIED
  verifiedAt          DateTime?         // Set on verify action
  extractedData       Json              // For manual editing
  aiConfidence        Float             // 0-1 confidence score
  checklistItemId     String?           // Link to requirement
}
```

### Action Model
```prisma
model Action {
  id                  String
  type                ActionType        // NEW: BLURRY_DETECTED type
  priority            ActionPriority    // URGENT|HIGH|NORMAL|LOW
  metadata            Json              // Stores docId, rawImageId, etc
  isCompleted         Boolean
  completedAt         DateTime?
}
```

## API Changes Summary

### New Endpoints (3)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/cases/:id/valid-transitions` | Fetch valid status transitions |
| POST | `/docs/:id/verify-action` | Quick verify or reject |
| GET | `/cases/:id/docs` | List digital docs with pagination |

### Enhanced Endpoints (3)
| Method | Path | Changes |
|--------|------|---------|
| PATCH | `/cases/:id` | Added status validation |
| GET | `/cases/:id/images` | Added pagination support |
| GET | `/clients` | Real API calls (was mock) |

## Frontend Changes Summary

### New Components (2)
1. `StatusSelector` - Case status management dropdown
2. `VerificationPanel` - Document verification interface

### New Hooks (1)
1. `useDebouncedValue` - Debounce values with pending state

### Updated Pages (3)
1. `/clients` - Real API calls, search, pagination
2. `/clients/$clientId` - Status selector, verification panel
3. `/actions` - Shows BLURRY_DETECTED actions from rejections

## Usage Examples

### Status Transition
```typescript
// Frontend
const handleStatusChange = async (newStatus: TaxCaseStatus) => {
  try {
    await api.cases.update(caseId, { status: newStatus })
    toast.success(`Updated to ${newStatus}`)
  } catch (error) {
    toast.error(`Invalid transition: ${error.message}`)
  }
}

// Backend validates
if (!isValidStatusTransition(currentStatus, newStatus)) {
  return error(400, 'Invalid transition')
}
```

### Document Verification
```typescript
// Staff clicks verify
const handleVerify = async (docId: string) => {
  const result = await api.docs.verifyAction(docId, { action: 'verify' })
  toast.success('Document verified')
  refetchDocuments()
}

// Or rejects with notes
const handleReject = async (docId: string, reason: string) => {
  const result = await api.docs.verifyAction(docId, {
    action: 'reject',
    notes: reason
  })
  toast.success('Document rejected - client will be notified')
  refetchDocuments() // Will see action in queue
}
```

### Debounced Search
```typescript
const [search, setSearch] = useState('')
const [debouncedSearch, isSearching] = useDebouncedValue(search, 500)

const { data: clients } = useQuery({
  queryKey: ['clients', debouncedSearch],
  queryFn: () => api.clients.list({ search: debouncedSearch })
})

return (
  <>
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search clients..."
    />
    {isSearching && <Spinner />}
    {clients?.map(c => <ClientRow key={c.id} client={c} />)}
  </>
)
```

## Testing Checklist

- [ ] Status transitions work correctly
- [ ] Cannot transition to invalid states
- [ ] Document verify action succeeds
- [ ] Document reject action succeeds + creates action
- [ ] Client search works with debounce
- [ ] Pagination works for cases/docs/images
- [ ] StatusSelector shows only valid options
- [ ] VerificationPanel updates on action
- [ ] Toast notifications appear on success/error
- [ ] Accessibility: tab navigation, aria labels, focus rings

## Deployment Notes

**No database migration required** - columns already exist in schema from Phase 1.1

**Environment Variables:** None new in Phase 2

**Breaking Changes:** None

**Backward Compatibility:** Fully compatible with Phase 1.x

## Performance Considerations

1. **Pagination** - Limits data transfer, reduces memory usage
2. **Debounced Search** - Reduces API calls by ~80%
3. **Atomic Transactions** - Prevents race conditions on concurrent actions
4. **Indexed Queries** - Status & timestamps should be indexed in PostgreSQL

**Suggested Database Indexes:**
```sql
CREATE INDEX idx_taxcase_status ON "TaxCase"(status);
CREATE INDEX idx_digitaldoc_status ON "DigitalDoc"(status);
CREATE INDEX idx_client_name ON "Client"(name);
CREATE INDEX idx_client_phone ON "Client"(phone);
```

## Future Enhancements

### Phase 2.1 Advanced
- Batch document verification (select multiple, verify all)
- Document search filters (status, type, confidence range)
- CSV export for cases
- Bulk status updates

### Phase 2.2 Advanced
- Action assignment workflow (assign to staff member)
- Priority override (staff can override auto-priority)
- Case scheduling (set dates for status transitions)

### Phase 2.3 Analytics
- Case completion rate by status
- Average time in each status
- Document verification accuracy tracking
- Staff performance metrics

## Related Documentation

- [System Architecture](./system-architecture.md) - Complete API & data flow
- [Code Standards](./code-standards.md) - Coding patterns
- [Project Overview](./project-overview-pdr.md) - Feature roadmap

---

**Last Updated:** 2026-01-14
**Phase Status:** Complete
**Next Phase:** Phase 2.1 Advanced - Batch Processing & Advanced Search
