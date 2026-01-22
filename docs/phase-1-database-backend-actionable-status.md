# Phase 1: Database & Backend Foundation (Actionable Client Status)

**Status:** Completed
**Last Updated:** 2026-01-21
**Branch:** feature/client-page-enhancement

## Overview

Phase 1 establishes the database schema and backend services for tracking actionable client status. Introduces computed status system that dynamically calculates case progress from document/verification state, activity tracking for stale case detection, and action count aggregation for client list badges.

## Database Schema Changes

### TaxCase Model Enhancements

Added three new fields to `TaxCase` for status tracking and activity monitoring:

```prisma
model TaxCase {
  id        String        @id @default(cuid())
  clientId  String
  client    Client        @relation(fields: [clientId], references: [id], onDelete: Cascade)

  taxYear   Int
  taxTypes  TaxType[]
  status    TaxCaseStatus @default(INTAKE)

  // ... existing relations ...

  lastContactAt    DateTime?
  entryCompletedAt DateTime?
  filedAt          DateTime?

  // Manual status flags (REVIEW/FILED are manual transitions)
  isInReview     Boolean   @default(false)
  isFiled        Boolean   @default(false)

  // Activity tracking for sorting & stale detection
  lastActivityAt DateTime  @default(now())

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([clientId, taxYear])
  @@index([status])
  @@index([taxYear])
  @@index([status, taxYear])
  @@index([clientId, status])
  @@index([lastActivityAt])  // NEW: For activity-based sorting
  @@index([isInReview])      // NEW: For review filtering
  @@index([isFiled])         // NEW: For filing status filtering
}
```

**New Fields:**

| Field | Type | Purpose | Default |
|-------|------|---------|---------|
| `isInReview` | Boolean | Manual flag indicating case in review state | false |
| `isFiled` | Boolean | Manual flag indicating case filed with IRS | false |
| `lastActivityAt` | DateTime | Timestamp of last case activity (uploads, messages, verification, entry) | now() |

**New Indexes:**

- `lastActivityAt` - Enables sorting/filtering by recency for stale case detection
- `isInReview` - Efficient review state filtering for dashboards
- `isFiled` - Efficient filing status queries

**Rationale:**

- `isInReview`/`isFiled` are manual override flags—staff explicitly marks cases for review or filing
- `lastActivityAt` tracks any meaningful activity (client actions, staff actions, document processing)
- Indexes optimize common dashboard queries: list by status + activity, filter by review/filed state

## Backend Services

### 1. Computed Status System

**Location:** `packages/shared/src/utils/computed-status.ts`

Calculates case status dynamically from document/verification state. Enables status badge in client list without database updates.

#### Constants

```typescript
export const STALE_THRESHOLD_DAYS = 7
```

Minimum days of inactivity before case marked as "stale" in client list.

#### Type Definitions

```typescript
export type ComputedStatus =
  | 'INTAKE'
  | 'WAITING_DOCS'
  | 'IN_PROGRESS'
  | 'READY_FOR_ENTRY'
  | 'ENTRY_COMPLETE'
  | 'REVIEW'
  | 'FILED'

export interface ComputedStatusInput {
  hasIntakeAnswers: boolean
  missingDocsCount: number
  unverifiedDocsCount: number   // DigitalDoc.status != VERIFIED
  pendingEntryCount: number     // DigitalDoc.entryCompleted = false (where verified)
  isInReview: boolean
  isFiled: boolean
}
```

**Status Priority Order (highest to lowest):**

1. `FILED` - Case filed with IRS (manual flag: `isFiled = true`)
2. `REVIEW` - Case under staff review (manual flag: `isInReview = true`)
3. `ENTRY_COMPLETE` - All documents verified & data entered
4. `READY_FOR_ENTRY` - All documents verified, awaiting data entry
5. `IN_PROGRESS` - Documents received but not all verified
6. `WAITING_DOCS` - Client intake complete, missing documents
7. `INTAKE` - No intake answers yet

#### Core Function

```typescript
export function computeStatus(input: ComputedStatusInput): ComputedStatus
```

**Algorithm:**

```
IF isFiled → return FILED
ELSE IF isInReview → return REVIEW
ELSE IF !hasIntakeAnswers → return INTAKE
ELSE IF missingDocsCount > 0 → return WAITING_DOCS
ELSE IF unverifiedDocsCount > 0 → return IN_PROGRESS
ELSE IF pendingEntryCount > 0 → return READY_FOR_ENTRY
ELSE → return ENTRY_COMPLETE
```

**Key Behaviors:**

- Negative counts normalized to 0 (defensive programming)
- Terminal states (REVIEW/FILED) override computed progression
- No database mutations—purely functional calculation
- Stateless & deterministic

**Example Usage:**

```typescript
import { computeStatus } from '@ella/shared/utils/computed-status'

const input = {
  hasIntakeAnswers: true,
  missingDocsCount: 0,
  unverifiedDocsCount: 2,  // 2 docs need verification
  pendingEntryCount: 0,
  isInReview: false,
  isFiled: false,
}

const status = computeStatus(input)
// → 'IN_PROGRESS'
```

### 2. Stale Activity Detection

**Location:** `packages/shared/src/utils/computed-status.ts`

Calculates days since last activity for stale case highlighting.

#### Function

```typescript
export function calculateStaleDays(
  lastActivityAt: Date | string,
  thresholdDays: number = STALE_THRESHOLD_DAYS
): number | null
```

**Parameters:**

- `lastActivityAt` - Date object or ISO string (e.g., from database)
- `thresholdDays` - Minimum days to be "stale" (default: 7)

**Returns:**

- `number` - Days elapsed if >= threshold (e.g., `10` for 10 days)
- `null` - If within threshold or invalid date

**Example Usage:**

```typescript
import { calculateStaleDays } from '@ella/shared/utils/computed-status'

// 10 days ago with 7-day threshold
const staleDays = calculateStaleDays(tenDaysAgo)
// → 10 (marked stale)

// 3 days ago with 7-day threshold
const staleDays = calculateStaleDays(threeDaysAgo)
// → null (not stale yet)

// Exactly at threshold
const staleDays = calculateStaleDays(sevenDaysAgo, 7)
// → 7
```

**Client List Integration:**

- Display "stale" badge when `calculateStaleDays()` returns truthy value
- Show days as `Inactive ${staleDays}d` in UI
- Sort by `lastActivityAt` to surface stale cases

### 3. Activity Tracker Service

**Location:** `apps/api/src/services/activity-tracker.ts`

Updates `lastActivityAt` timestamp on TaxCase when meaningful activity occurs.

#### Function

```typescript
export async function updateLastActivity(caseId: string): Promise<boolean>
```

**Parameters:**

- `caseId` - TaxCase ID to update

**Returns:**

- `true` - Update successful
- `false` - Case not found or error (non-blocking)

**Call Points:**

- Client uploads document
- Client sends message
- Staff verifies document
- Staff completes data entry
- Staff adds/marks checklist items
- System processes classification/OCR

**Example Usage:**

```typescript
import { updateLastActivity } from '../services/activity-tracker'

// After document upload
await uploadDocument(caseId, file)
await updateLastActivity(caseId)

// After message sent
await sendMessage(caseId, content)
await updateLastActivity(caseId)

// Error handling (non-blocking)
const updated = await updateLastActivity(caseId)
if (!updated) {
  console.warn(`Could not update activity for case ${caseId}`)
  // Continue—don't fail primary operation
}
```

**Error Handling:**

- Catches errors internally, returns `false`
- Logs error but doesn't throw (activity tracking is secondary)
- Primary operations continue even if activity update fails

## Types & Interfaces

### ActionCounts Type

**Location:** `packages/shared/src/types/action-counts.ts`

Aggregated action counts for client list action badges.

```typescript
export interface ActionCounts {
  /** ChecklistItem.status = MISSING */
  missingDocs: number
  /** DigitalDoc.status = EXTRACTED (needs verification) */
  toVerify: number
  /** DigitalDoc.status = VERIFIED && entryCompleted = false */
  toEnter: number
  /** Days since lastActivityAt (null if < threshold) */
  staleDays: number | null
  /** Has unread messages */
  hasNewActivity: boolean
}
```

**Fields:**

| Field | Meaning | Filter |
|-------|---------|--------|
| `missingDocs` | Outstanding checklist items | `ChecklistItem.status = 'MISSING'` |
| `toVerify` | Documents awaiting verification | `DigitalDoc.status = 'EXTRACTED'` |
| `toEnter` | Verified docs awaiting data entry | `DigitalDoc.status = 'VERIFIED' AND entryCompleted = false` |
| `staleDays` | Days inactive (or null) | `calculateStaleDays(lastActivityAt)` |
| `hasNewActivity` | Unread messages exist | `Conversation.unreadCount > 0` |

### ClientWithActions Type

**Location:** `packages/shared/src/types/action-counts.ts`

Client data enriched with actionable information for list display.

```typescript
export interface ClientWithActions {
  id: string
  name: string
  phone: string
  email: string | null
  language: 'VI' | 'EN'
  createdAt: string
  updatedAt: string
  computedStatus: ComputedStatus | null
  actionCounts: ActionCounts | null
  latestCase: {
    id: string
    taxYear: number
    taxTypes: string[]
    isInReview: boolean
    isFiled: boolean
    lastActivityAt: string
  } | null
}
```

**Enriched Fields:**

- `computedStatus` - Calculated from `latestCase` data
- `actionCounts` - Aggregated from case documents & messages
- `latestCase` - Most recent TaxCase for the client

**Usage in Client List:**

```typescript
// Display client with action context
const clients: ClientWithActions[] = await fetchClientsWithActions()

clients.map(client => (
  <ClientRow
    name={client.name}
    status={client.computedStatus}
    missingDocs={client.actionCounts?.missingDocs}
    toVerify={client.actionCounts?.toVerify}
    staleDays={client.actionCounts?.staleDays}
  />
))
```

## Module Exports

### @ella/shared Exports

**Location:** `packages/shared/src/index.ts` and `packages/shared/src/utils/index.ts`

Public exports for use across frontend & backend:

```typescript
// Computed status utilities
export { computeStatus, calculateStaleDays, STALE_THRESHOLD_DAYS } from './utils/computed-status'
export type { ComputedStatus, ComputedStatusInput } from './utils/computed-status'

// Action count types
export type { ActionCounts, ClientWithActions } from './types/action-counts'
```

**Usage:**

```typescript
import {
  computeStatus,
  calculateStaleDays,
  STALE_THRESHOLD_DAYS,
  type ComputedStatus,
  type ActionCounts,
  type ClientWithActions,
} from '@ella/shared'
```

## Testing

### Test Suite

**Location:** `apps/api/src/services/__tests__/computed-status.test.ts`

Comprehensive test coverage (23 tests) verifying:

#### Test Categories

1. **Terminal States (2 tests)**
   - `FILED` takes priority over everything
   - `REVIEW` takes priority when not filed

2. **Document/Entry Progression (5 tests)**
   - Each status level transitions correctly
   - Verified: INTAKE → WAITING_DOCS → IN_PROGRESS → READY_FOR_ENTRY → ENTRY_COMPLETE

3. **Priority Ordering (3 tests)**
   - REVIEW > ENTRY_COMPLETE
   - WAITING_DOCS > IN_PROGRESS
   - IN_PROGRESS > READY_FOR_ENTRY

4. **Edge Cases (4 tests)**
   - All fields at 0 → ENTRY_COMPLETE
   - Large doc counts → First priority triggers
   - INTAKE overrides all counts when `hasIntakeAnswers = false`

5. **Stale Days Calculation (9 tests)**
   - Date object parsing
   - ISO string parsing
   - Threshold boundary conditions
   - Default threshold (7 days)
   - Custom thresholds
   - Recent activity (0 days)
   - Very old activity (100+ days)

**Run Tests:**

```bash
cd apps/api
pnpm test computed-status
```

## Integration Points

### Frontend (Client List)

```typescript
import { computeStatus, calculateStaleDays, type ClientWithActions } from '@ella/shared'

export function ClientListRow({ client }: { client: ClientWithActions }) {
  const status = client.computedStatus
  const staleDays = client.actionCounts?.staleDays

  return (
    <div className="client-row">
      <h3>{client.name}</h3>
      <StatusBadge status={status} />
      {staleDays && <StaleIndicator days={staleDays} />}
      <ActionBadges
        missingDocs={client.actionCounts?.missingDocs || 0}
        toVerify={client.actionCounts?.toVerify || 0}
        toEnter={client.actionCounts?.toEnter || 0}
      />
    </div>
  )
}
```

### Backend (API Endpoint)

**Example: `GET /api/clients?status=WAITING_DOCS`**

```typescript
import { computeStatus, calculateStaleDays } from '@ella/shared'

export async function getClientsWithActions(
  filters: { status?: ComputedStatus; staleDays?: boolean }
): Promise<ClientWithActions[]> {
  const clients = await prisma.client.findMany({
    include: {
      taxCases: {
        orderBy: { taxYear: 'desc' },
        take: 1,
        include: {
          checklistItems: true,
          digitalDocs: true,
          conversation: true,
        },
      },
    },
  })

  return clients.map(client => {
    const latestCase = client.taxCases[0]
    if (!latestCase) return null

    // Aggregate action counts
    const missingDocs = latestCase.checklistItems.filter(
      item => item.status === 'MISSING'
    ).length
    const unverifiedDocs = latestCase.digitalDocs.filter(
      doc => doc.status !== 'VERIFIED'
    ).length
    const pendingEntry = latestCase.digitalDocs.filter(
      doc => doc.status === 'VERIFIED' && !doc.entryCompleted
    ).length

    // Compute status
    const computedStatus = computeStatus({
      hasIntakeAnswers: !!client.profile?.intakeAnswers,
      missingDocsCount: missingDocs,
      unverifiedDocsCount: unverifiedDocs,
      pendingEntryCount: pendingEntry,
      isInReview: latestCase.isInReview,
      isFiled: latestCase.isFiled,
    })

    // Calculate stale days
    const staleDays = calculateStaleDays(latestCase.lastActivityAt)

    // Apply filters
    if (filters.status && computedStatus !== filters.status) return null
    if (filters.staleDays && !staleDays) return null

    return {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      language: client.language,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      computedStatus,
      actionCounts: {
        missingDocs,
        toVerify: unverifiedDocs,
        toEnter: pendingEntry,
        staleDays,
        hasNewActivity: latestCase.conversation?.unreadCount > 0,
      },
      latestCase: {
        id: latestCase.id,
        taxYear: latestCase.taxYear,
        taxTypes: latestCase.taxTypes,
        isInReview: latestCase.isInReview,
        isFiled: latestCase.isFiled,
        lastActivityAt: latestCase.lastActivityAt.toISOString(),
      },
    }
  }).filter(Boolean)
}
```

## Next Steps

1. **Frontend Integration** - Build client list UI with status badges and action counts
2. **API Endpoint** - Implement `GET /api/clients/with-actions` for list fetching
3. **Activity Hooks** - Call `updateLastActivity()` at all interaction points
4. **Dashboard Filters** - Add status/stale day filters to client list
5. **Testing** - Test computed status calculation with real database data

## Related Documentation

- Database Schema: `packages/db/prisma/schema.prisma`
- Computed Status: `packages/shared/src/utils/computed-status.ts`
- Types: `packages/shared/src/types/action-counts.ts`
- Activity Tracker: `apps/api/src/services/activity-tracker.ts`
- Tests: `apps/api/src/services/__tests__/computed-status.test.ts`
- Code Standards: `docs/code-standards.md`
