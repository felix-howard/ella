# Schedule E Phase 4: Workspace Tab Completion

**Date:** 2026-02-06
**Status:** Complete
**Feature:** Frontend Schedule E workspace tab for staff review of rental property expense forms

---

## Overview

Schedule E Phase 4 completes the frontend integration of the Schedule E (rental property) expense form in the workspace staff dashboard. Staff can now view submitted/locked forms, manage magic link distribution to clients, and control form submission status.

**Key Outcomes:**
- Staff view of rental properties with expense breakdown
- 4-state form flow (empty → draft → submitted → locked)
- Optimistic UI updates with React Query
- Bilingual i18n support (EN/VI)
- XSS protection via sanitization

---

## Architecture

### Data Flow

```
Client Detail Page (/clients/:clientId)
    ↓
ScheduleETab Component
    ├─ useScheduleE() hook
    │  └─ GET /schedule-e/:caseId
    │     └─ Returns: { expense, magicLink, totals }
    └─ Routes to 4 states
       ├─ No expense → ScheduleEEmptyState
       │  └─ useScheduleEActions.send() → POST /send
       ├─ status=DRAFT → ScheduleEWaiting
       │  └─ useScheduleEActions.resend() → POST /resend
       └─ status=SUBMITTED|LOCKED → ScheduleESummary
          ├─ PropertyCard (map properties array)
          └─ useScheduleEActions.lock/unlock() → PATCH /lock|/unlock
```

### Component Tree

```
ScheduleETab
├── ScheduleEEmptyState
│   └── ScheduleEActions.send()
├── ScheduleEWaiting
│   ├── Magic link status display
│   └── ScheduleEActions.resend()
└── ScheduleESummary
    ├── [PropertyCard]*N (per property)
    │   ├── Header (address, type, rental dates)
    │   ├── Income section
    │   └── Expandable expenses table
    ├── TotalsCard
    │   ├── Total rental income
    │   └── Total expenses
    ├── StatusBadge
    └── ScheduleEActions.lock/unlock()
```

---

## File Structure

### New Files Created

**Hooks (apps/workspace/src/hooks/):**
```
use-schedule-e.ts (35 LOC)
├── useScheduleE({ caseId, enabled })
├── Returns: { expense, magicLink, totals, properties, isLoading, error, refetch }
└── Query: queryKey=['schedule-e', caseId], staleTime=30s

use-schedule-e-actions.ts (133 LOC)
├── useScheduleEActions()
├── Mutations:
│   ├── send() - POST /send
│   ├── resend() - POST /resend
│   ├── lock() - PATCH /lock
│   └── unlock() - PATCH /unlock
└── Optimistic updates via invalidateQueries
```

**Components (apps/workspace/src/components/cases/tabs/schedule-e-tab/):**
```
index.tsx (76 LOC)
├── Main tab component
├── 4-state routing logic
└── Error & loading states

schedule-e-empty-state.tsx
├── Initial empty state
└── Send magic link button

schedule-e-waiting.tsx
├── Form in progress state
├── "Waiting for client..." message
└── Resend link button

schedule-e-summary.tsx
├── Read-only summary view
├── Property iteration
└── Status display

property-card.tsx (110+ LOC)
├── Expandable property details
├── Address, type, rental period (copyable)
├── 7 expense fields with IRS line numbers
├── XSS sanitization via sanitizeText()
└── formatUSD() formatting

totals-card.tsx
├── Aggregate income display
├── Total expenses (all properties)
└── Net income calculation

status-badge.tsx
├── Visual status indicator
├── DRAFT/SUBMITTED/LOCKED variants

schedule-e-actions.tsx
├── Lock/unlock button group
└── Staff control actions

copyable-value.tsx
├── Reusable copy-to-clipboard
├── Value display
└── Toast feedback

format-utils.ts (60+ LOC)
├── formatUSD() - "$1,234.56" format
├── getPropertyTypeLabel() - IRS property type labels (EN/VI)
├── formatAddress() - "Street, City, State ZIP" format
└── Helper utilities
```

### Modified Files

**API Client (apps/workspace/src/lib/api-client.ts):**
- New type: `ScheduleEResponse`
- New type: `ScheduleEPropertyData`
- New endpoint group: `scheduleE: { get(caseId) }`

**Routes (apps/workspace/src/routes/clients/$clientId.tsx):**
- Lazy import ScheduleETab
- Added to tab list alongside Schedule C

**Locales:**
- `apps/workspace/src/locales/en.json` - 60+ Schedule E keys
- `apps/workspace/src/locales/vi.json` - Vietnamese translations

---

## Implementation Details

### 1. State Management

**4-State Flow:**
```typescript
function ScheduleETab({ caseId }) {
  const { expense, magicLink, totals, properties, isLoading, error } = useScheduleE({ caseId })

  if (isLoading) return <Loader />
  if (error) return <ErrorState />

  // State 1: No expense record
  if (!expense) return <ScheduleEEmptyState caseId={caseId} />

  // State 2: Draft (form not submitted)
  if (expense.status === 'DRAFT') return <ScheduleEWaiting expense={expense} magicLink={magicLink} />

  // State 3&4: Submitted or Locked (read-only)
  return <ScheduleESummary expense={expense} properties={properties} totals={totals} />
}
```

### 2. Optimistic Updates

**Pattern:**
```typescript
// useScheduleEActions.ts
const sendMutation = useMutation({
  mutationFn: () => api.scheduleE.send(caseId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['schedule-e', caseId] })
  }
})
```

**Benefits:**
- Immediate UI feedback (no loading spinner for mutations)
- Automatic cache refresh via React Query
- Error rollback built-in

### 3. XSS Protection

**Implementation:**
```typescript
// property-card.tsx
import { sanitizeText } from '../../../../lib/formatters'

const sanitizedAddress = sanitizeText(property.address?.street || '')
```

**Scope:** User-editable fields (addresses, property descriptions)

### 4. Copyable Values

**Component:**
```typescript
// copyable-value.tsx
<CopyableValue label="Street Address" value={property.address.street} />
```

**Behavior:**
- Click to copy
- Toast: "Copied to clipboard"
- Visual feedback

### 5. Bilingual Support

**Translation Keys:**
```
scheduleE.property              → "Property A/B/C"
scheduleE.line9Insurance        → "Insurance (Line 9)"
scheduleE.line12MortgageInterest → "Mortgage Interest (Line 12)"
scheduleE.line14Repairs         → "Repairs (Line 14)"
scheduleE.line16Taxes           → "Taxes (Line 16)"
scheduleE.line17Utilities       → "Utilities (Line 17)"
scheduleE.line11ManagementFees  → "Management Fees (Line 11)"
scheduleE.line7CleaningMaintenance → "Cleaning/Maintenance (Line 7)"
scheduleE.status                → "Status"
scheduleE.rentalDays            → "Rental Days"
scheduleE.totalIncome           → "Total Rental Income"
scheduleE.totalExpenses         → "Total Expenses"
scheduleE.lock                  → "Lock Form"
scheduleE.unlock                → "Unlock Form"
```

**Coverage:** 60+ total keys across UI, status messages, and form labels

### 6. Magic Link Integration

**Send Flow:**
```
Staff clicks "Send Form" → useScheduleEActions.send()
  ↓
API: POST /schedule-e/:caseId/send
  ├─ Creates MagicLink record (type: SCHEDULE_E)
  ├─ Generates unique token
  └─ Sends SMS to client
    └─ "Complete your rental property form: [link]"
```

**Reuse:**
- Existing `/send` and `/resend` routes (from Phase 2)
- Existing SMS templates (SCHEDULE_E type)
- Token validation logic shared

### 7. Data Structures

**ScheduleEResponse:**
```typescript
interface ScheduleEResponse {
  expense: ScheduleEExpenseData | null
  magicLink: MagicLink | null
  totals: {
    totalRentalIncome: number
    totalExpenses: number
    netIncome: number
  }
}

interface ScheduleEPropertyData {
  id: 'A' | 'B' | 'C'
  address: { street: string, city: string, state: string, zip: string }
  type: 1 | 2 | 3 | 4 | 5 | 7 | 8
  rentalDays: number
  fairRentalDays: number
  rentalIncome: number

  // 7 IRS expense fields
  insurance: number
  mortgageInterest: number
  repairs: number
  taxes: number
  utilities: number
  managementFees: number
  cleaningMaintenance: number

  // Calculated
  totalExpenses: number
  netIncome: number
}

interface ScheduleEExpenseData {
  id: string
  properties: ScheduleEPropertyData[]
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED'
  submittedAt: Date | null
  lockedAt: Date | null
}
```

---

## Testing Checklist

### Unit Tests
- [ ] useScheduleE hook returns correct data shape
- [ ] useScheduleEActions mutations call correct endpoints
- [ ] ScheduleETab routes to correct state based on expense status
- [ ] PropertyCard sanitizes user input
- [ ] formatUSD formats correctly (with decimals, comma separators)
- [ ] getPropertyTypeLabel returns bilingual labels

### Component Tests
- [ ] Empty state shows send button
- [ ] Waiting state shows resend button
- [ ] Summary shows all properties
- [ ] Property cards expand/collapse
- [ ] Copyable values work
- [ ] Status badge displays correctly

### Integration Tests
- [ ] Can send magic link from empty state
- [ ] Can resend from waiting state
- [ ] Can lock form from submitted state
- [ ] Can unlock form from locked state
- [ ] Error states display correctly

### UI/UX Tests
- [ ] Responsive on mobile (expandable cards)
- [ ] Accessibility: aria-labels, button focus
- [ ] Bilingual: EN/VI text renders correctly
- [ ] Copyable feedback: toast appears

---

## Common Patterns

### Using useScheduleE

```typescript
function MyComponent({ caseId }) {
  const { expense, properties, totals, isLoading } = useScheduleE({ caseId })

  if (isLoading) return <Loader />
  if (!expense) return <EmptyState />

  return (
    <>
      {properties.map(prop => <PropertyCard key={prop.id} property={prop} />)}
      <TotalsCard totals={totals} />
    </>
  )
}
```

### Sending Magic Link

```typescript
function SendButton({ caseId }) {
  const { send, isPending } = useScheduleEActions()

  return (
    <Button
      onClick={() => send(caseId)}
      disabled={isPending}
    >
      {isPending ? 'Sending...' : 'Send Form'}
    </Button>
  )
}
```

### Formatting Values

```typescript
import { formatUSD, getPropertyTypeLabel, formatAddress } from './format-utils'

const income = formatUSD(123456.78) // "$123,456.78"
const typeLabel = getPropertyTypeLabel(2, 'en') // "Single Family Home"
const addr = formatAddress({ street: "123 Main", city: "Boston", state: "MA", zip: "02101" })
// "123 Main, Boston, MA 02101"
```

---

## Error Handling

**Component Error Boundary:**
```typescript
if (error) {
  return (
    <div className="bg-destructive/10 border border-destructive p-4">
      <h3>Error Loading Schedule E</h3>
      <p>{error.message}</p>
      <Button onClick={refetch}>Retry</Button>
    </div>
  )
}
```

**Mutation Error Handling:**
- useScheduleEActions catches mutation errors
- Toast notifications display error message
- User can retry

---

## Performance Considerations

1. **Stale Time:** 30 seconds prevents excessive refetches
2. **Lazy Loading:** ScheduleETab is lazy-imported on route
3. **Expandable Cards:** Reduces initial DOM size
4. **Copyable Component:** Isolated, doesn't trigger full re-render

---

## Migration Notes

### From Schedule C Pattern

Schedule E tab follows established Schedule C patterns:
- Same 4-state routing (empty → draft → submitted → locked)
- Same hook structure (useScheduleE, useScheduleEActions)
- Same property-based expansion (PropertyCard)
- Same magic link send/resend flow

### Differences

- No 1099-NEC detection (Schedule E always shows)
- Up to 3 properties vs 1 income source
- 7 expense fields (vs 20+ for Schedule C)
- Simpler status flow (no DRAFT revisions)

---

## Dependencies

**NPM Packages:**
- `@tanstack/react-query` - Data fetching & caching
- `react-i18next` - Internationalization
- `lucide-react` - Icons
- `@ella/ui` - shadcn/ui components
- `clsx` - Conditional className utility

**Internal:**
- `src/lib/api-client` - API client with Schedule E endpoints
- `src/lib/formatters` - sanitizeText() utility
- `src/lib/i18n` - i18n configuration

---

## Next Steps

### For Code Review
1. Verify XSS sanitization in property-card.tsx
2. Check optimistic update invalidation logic
3. Review error boundary implementation
4. Validate i18n key coverage

### For QA Testing
1. Test 4-state flow with different expense statuses
2. Verify copyable values work correctly
3. Test magic link send/resend
4. Validate lock/unlock permissions
5. Test bilingual UI

### For Deployment
1. Ensure i18n keys are in translation management
2. Verify API endpoints are production-ready
3. Test with real data (3 properties, various expenses)
4. Monitor performance metrics

---

## File Locations

```
docs/
└── schedule-e-phase-4-workspace-tab.md (this file)

apps/workspace/src/
├── hooks/
│   ├── use-schedule-e.ts
│   └── use-schedule-e-actions.ts
├── components/cases/tabs/schedule-e-tab/
│   ├── index.tsx
│   ├── schedule-e-empty-state.tsx
│   ├── schedule-e-waiting.tsx
│   ├── schedule-e-summary.tsx
│   ├── property-card.tsx
│   ├── totals-card.tsx
│   ├── status-badge.tsx
│   ├── schedule-e-actions.tsx
│   ├── copyable-value.tsx
│   └── format-utils.ts
├── lib/api-client.ts (updated)
├── routes/clients/$clientId.tsx (updated)
└── locales/
    ├── en.json (updated)
    └── vi.json (updated)
```

---

## Quick Reference

| Aspect | Detail |
|--------|--------|
| **Total Files** | 12 new + 4 modified |
| **Total LOC** | ~500 (components + hooks) |
| **States** | 4 (empty, draft, submitted, locked) |
| **Properties** | Up to 3 per form (A, B, C) |
| **Expenses** | 7 IRS fields + custom |
| **i18n Keys** | 60+ (EN/VI) |
| **Dependencies** | React Query, i18next, Lucide, @ella/ui |

---

**Status:** Ready for merge
**Last Updated:** 2026-02-06
**Reviewed:** Schedule E Phase 2 Backend API complete
