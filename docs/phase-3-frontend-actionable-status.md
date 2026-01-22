# Phase 3: Frontend - Actionable Client Status System

**Status:** Complete & Production-Ready
**Date:** 2026-01-21
**Branch:** feature/client-page-enhancement

---

## Overview

Phase 3 Frontend delivers **UI components & utilities** for the Actionable Client Status system. Enables staff to:
- View computed case status (read-only badges)
- See action badges (missing docs, verify needed, entry needed, stale)
- Sort client list by activity/name
- Transition case status (Send to Review → Mark Filed → Reopen)

---

## New Components

### 1. ComputedStatusBadge

**Location:** `apps/workspace/src/components/clients/computed-status-badge.tsx` (~40 LOC)

Read-only status display component used in client list & client detail header.

**Props:**
```typescript
interface ComputedStatusBadgeProps {
  status: TaxCaseStatus | null  // INTAKE, WAITING_DOCS, IN_PROGRESS, READY_FOR_ENTRY, ENTRY_COMPLETE, REVIEW, FILED
  size?: 'sm' | 'md'            // Badge size (default: 'md')
}
```

**Rendering:**
- Uses `CASE_STATUS_LABELS` & `CASE_STATUS_COLORS` from constants
- Displays human-readable Vietnamese labels with color coding
- Shows "Chưa có hồ sơ" when status is null

**Integration Points:**
- Client List Table (status column)
- Client Detail Header (primary status indicator)

---

### 2. ActionBadge

**Location:** `apps/workspace/src/components/clients/action-badge.tsx` (~80 LOC)

Displays actionable indicators for work prioritization.

**Types & Colors:**

| Type | Label | Color | Use Case |
|------|-------|-------|----------|
| `missing` | "thiếu" | error/red | Missing documents |
| `verify` | "cần xác minh" | warning/orange | Docs need verification |
| `entry` | "cần nhập" | primary/blue | Docs need data entry |
| `stale` | "không hoạt động" | orange | No activity (7+ days) |
| `ready` | "Sẵn sàng" | success/green | Ready for next step |
| `new-activity` | "Mới" | purple | Unread messages |

**Props:**
```typescript
interface ActionBadgeProps {
  type: BadgeType
  count?: number    // For missing, verify, entry counts
  days?: number     // For stale badge (e.g., "10d không hoạt động")
}
```

**Memoization:** `memo()` for performance in client list re-renders

---

## Frontend Utilities

### 3. computeStatus() - Client Utility

**Location:** `apps/workspace/src/lib/computed-status.ts` (~40 LOC)

Mirrors backend logic for client-side status computation (read-only, no mutations).

**Input:**
```typescript
interface ComputedStatusInput {
  hasIntakeAnswers: boolean
  missingDocsCount: number        // ChecklistItem.status = MISSING
  extractedDocsCount: number      // DigitalDoc.status = EXTRACTED
  unverifiedDocsCount: number     // DigitalDoc.status != VERIFIED
  pendingEntryCount: number       // DigitalDoc.entryCompleted = false
  isInReview: boolean             // Manual review flag
  isFiled: boolean                // Manual filed flag
}
```

**Priority Logic:**
```
1. FILED (if isFiled)
2. REVIEW (if isInReview)
3. INTAKE (if !hasIntakeAnswers)
4. WAITING_DOCS (if missingDocsCount > 0)
5. IN_PROGRESS (if unverifiedDocsCount > 0)
6. READY_FOR_ENTRY (if pendingEntryCount > 0)
7. ENTRY_COMPLETE (default)
```

**Usage:**
```typescript
import { computeStatus } from '@ella/shared/lib/computed-status'

const status = computeStatus({
  hasIntakeAnswers: true,
  missingDocsCount: 0,
  unverifiedDocsCount: 2,
  pendingEntryCount: 0,
  isInReview: false,
  isFiled: false,
})
// → 'IN_PROGRESS'
```

---

## Data Enhancements

### 4. TaxCaseSummary Type Update

**Location:** `apps/workspace/src/lib/api-client.ts`

```typescript
export interface TaxCaseSummary {
  id: string
  taxYear: number
  taxTypes: string[]
  isInReview?: boolean      // NEW: Manual review flag
  isFiled?: boolean         // NEW: Manual filed flag
  lastActivityAt?: string   // NEW: Activity timestamp for sorting
}
```

**Integration:** Used in `ClientWithActions` for latest case metadata

---

## Constants & Configuration

### 5. New Constants

**Location:** `apps/workspace/src/lib/constants.ts`

```typescript
// ACTION_BADGE_LABELS (line 202)
export const ACTION_BADGE_LABELS = {
  missing: 'thiếu',
  verify: 'cần xác minh',
  entry: 'cần nhập',
  stale: 'không hoạt động',
}

// STALE_THRESHOLD_DAYS (line 212)
export const STALE_THRESHOLD_DAYS = 7

// CLIENT_SORT_OPTIONS (line 215)
export const CLIENT_SORT_OPTIONS = [
  { label: 'Hoạt động gần đây', value: 'activity' },
  { label: 'Tên', value: 'name' },
  { label: 'Hết hạn', value: 'stale' },
]

export type ClientSortOption = typeof CLIENT_SORT_OPTIONS[number]['value']
```

---

## Modified Files

### 6. ClientListTable (`client-list-table.tsx`)

**Changes:**
- Now accepts `ClientWithActions[]` instead of `Client[]`
- Displays `ComputedStatusBadge` in status column
- Renders multiple `ActionBadge` components for action counts
- Shows stale indicator (days inactive) when applicable

**Row Structure:**
```
[Checkbox] [Avatar] [Name/Phone] [Status Badge] [Action Badges] [Menu]
                                                  ├─ Missing (red)
                                                  ├─ Verify (orange)
                                                  ├─ Entry (blue)
                                                  ├─ Stale (orange, days)
                                                  └─ New Activity (purple)
```

---

### 7. Clients Index Route (`routes/clients/index.tsx`)

**Changes:**
- Added sort state: `useState<ClientSortOption>('activity')`
- Added sort options UI (dropdown with activity/name/stale options)
- Query params: `sort`, `status`, `search` sent to API
- Debounced search (300ms)
- Improved query key tracking for React Query caching

**Sort Options:**
| Option | DB Query | Display |
|--------|----------|---------|
| `activity` | `orderBy: { lastActivityAt: 'desc' }` | Newest first |
| `name` | `orderBy: { name: 'asc' }` | A-Z |
| `stale` | Custom sort (staleDays DESC) | Stale first |

---

### 8. Client Detail Route (`routes/clients/$clientId.tsx`)

**New Mutations:**
1. `sendToReviewMutation` - POST `/cases/:id/send-to-review`
2. `markFiledMutation` - POST `/cases/:id/mark-filed`
3. `reopenMutation` - POST `/cases/:id/reopen`

**Header Status:**
- Replaced manual StatusSelector with read-only `ComputedStatusBadge`
- Added 3 action buttons below status:
  - "Gửi kiểm tra" → sendToReview()
  - "Đánh dấu nộp" → markFiled()
  - "Mở lại" → reopen() (only if filed)

**State Transitions:**
```
INTAKE → WAITING_DOCS → IN_PROGRESS → READY_FOR_ENTRY → ENTRY_COMPLETE
                                            ↓
                                        [Send to Review]
                                            ↓
                                         REVIEW
                                            ↓
                                      [Mark Filed]
                                            ↓
                                          FILED
                                            ↓
                                        [Reopen]
```

**Query Invalidation:**
- On action success: `queryClient.invalidateQueries({ queryKey: ['client', clientId] })`
- Refetches client data with updated status

**Toast Notifications:**
- Success: "Đã gửi hồ sơ đi kiểm tra"
- Success: "Đã đánh dấu hồ sơ đã nộp"
- Success: "Đã mở lại hồ sơ"
- Error: Generic error messages

---

## API Client Methods

**Location:** `apps/workspace/src/lib/api-client.ts`

```typescript
export const cases = {
  // NEW: Transition endpoints
  sendToReview: (caseId: string) => apiRequest('POST', `/cases/${caseId}/send-to-review`)
  markFiled: (caseId: string) => apiRequest('POST', `/cases/${caseId}/mark-filed`)
  reopen: (caseId: string) => apiRequest('POST', `/cases/${caseId}/reopen`)
}
```

**Error Handling:**
- Catches API errors, displays toast
- Prevents double-submission (button disabled during mutation)

---

## Integration with Backend Phase 2

Frontend components consume Phase 2 API responses:

**GET /clients Response:**
```json
{
  "data": [
    {
      "id": "client123",
      "name": "John Doe",
      "computedStatus": "IN_PROGRESS",
      "actionCounts": {
        "missingDocs": 2,
        "toVerify": 1,
        "toEnter": 3,
        "staleDays": 10,
        "hasNewActivity": true
      },
      "latestCase": {
        "isInReview": false,
        "isFiled": false,
        "lastActivityAt": "2026-01-20T14:30:00Z"
      }
    }
  ]
}
```

---

## UX Flow

### Client List Page

1. Staff opens Clients page
2. See list sorted by activity (most recent first)
3. Each row shows:
   - Client name, phone
   - Status badge (INTAKE, IN_PROGRESS, etc.)
   - Action badges:
     - Red "2 thiếu" (2 missing docs)
     - Orange "1 cần xác minh" (1 doc to verify)
     - Blue "3 cần nhập" (3 docs to enter)
     - Orange "10d không hoạt động" (stale, if applicable)
     - Purple "Mới" (if unread messages)
4. Can filter by status, search by name/phone, sort by activity/name

### Client Detail Page

1. Staff clicks on client
2. Sees read-only status badge in header
3. Below status, action buttons:
   - If status not REVIEW/FILED: "Gửi kiểm tra" (Send to Review)
   - If status REVIEW: "Đánh dấu nộp" (Mark Filed)
   - If status FILED: "Mở lại" (Reopen)
4. Clicks action button, sees success toast, status updates
5. Changes reflected in all views (list, detail) via React Query invalidation

---

## Testing

**Recommended Test Cases:**

1. **Status Computation:**
   - Verify FILED always takes priority
   - Verify REVIEW overrides computed status
   - Verify INTAKE when no intake answers
   - Verify WAITING_DOCS with missing checklist items

2. **Action Badges:**
   - Render correct count + label per type
   - Stale badge shows days + label
   - New activity badge pulses/highlights

3. **Mutations:**
   - Send to Review: Disables button, shows toast, invalidates query
   - Mark Filed: Updates status badge, shows toast
   - Reopen: Only available if filed, returns to REVIEW state

4. **Client List:**
   - Sort by activity works (newest first)
   - Sort by name works (A-Z)
   - Status filter works (shows only selected status)
   - Search debounces correctly (300ms delay)

---

## Performance Notes

- `ActionBadge` memoized to prevent re-renders
- `computeStatus()` is pure function (no side effects)
- Client list uses React Query caching (default 5 min)
- Sort/filter via API (server-side) to avoid large data transfers
- Stale threshold (7 days) prevents false positives

---

## Browser & Accessibility

- All badges have `role="status"` + `aria-label` for screen readers
- Vietnamese labels for all UI text
- Dark mode support via Tailwind dark: classes
- Responsive design (badges stack on mobile)

---

## Next Steps

1. **E2E Tests:** Add Playwright tests for status transitions
2. **Analytics:** Track action button usage (Send to Review, Mark Filed counts)
3. **Batch Operations:** Add "Send All to Review" for selected clients
4. **Dashboard:** Create activity dashboard showing status breakdown pie chart
5. **Notifications:** Webhook events when case status changes (for integrations)

---

## Related Documentation

- **Backend Phase 2:** [phase-2-actionable-status-api.md](./phase-2-actionable-status-api.md)
- **Database Schema:** [phase-1-database-backend-actionable-status.md](./phase-1-database-backend-actionable-status.md)
- **System Architecture:** [system-architecture.md](./system-architecture.md)
- **API Client:** [codebase-summary.md#api-client](./codebase-summary.md#api-client)

---

**Last Updated:** 2026-01-21
**Status:** Production-Ready
**Component Count:** 2 new (ComputedStatusBadge, ActionBadge)
**Modified Files:** 3 (client-list-table, routes/clients/index, routes/clients/$clientId)
