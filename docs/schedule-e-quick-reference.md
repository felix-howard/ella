# Schedule E Quick Reference

**Date:** 2026-02-06 | **Phase:** 4 Workspace Tab Complete | **Status:** Production Ready

---

## Overview

Schedule E rental property form with 3 properties, 7 IRS expenses, status tracking (DRAFT/SUBMITTED/LOCKED), and staff workspace view.

## 4-State Flow

```
┌─ No expense → ScheduleEEmptyState (send button)
│
├─ status=DRAFT → ScheduleEWaiting (form in progress)
│
└─ status=SUBMITTED/LOCKED → ScheduleESummary (read-only view)
```

---

## Data Hooks

### useScheduleE({ caseId, enabled })

**Purpose:** Fetch Schedule E data from backend

```typescript
const { expense, magicLink, totals, properties, isLoading, error, refetch } = useScheduleE({ caseId })
```

**Returns:**
- `expense: ScheduleEExpenseData | null` - Full expense record with properties array
- `magicLink: MagicLink | null` - Active magic link (if exists)
- `totals: { totalRentalIncome, totalExpenses, netIncome }` - Aggregate calculations
- `properties: ScheduleEPropertyData[]` - Array of properties (up to 3)
- `isLoading: boolean` - Query loading state
- `error: Error | null` - Query error
- `refetch: () => Promise` - Manual refetch

**Stale Time:** 30 seconds

**Query Key:** `['schedule-e', caseId]`

---

### useScheduleEActions()

**Purpose:** Mutations for send/resend/lock/unlock

```typescript
const { send, resend, lock, unlock, isPending } = useScheduleEActions()

// Send initial magic link
await send(caseId)

// Resend to client
await resend(caseId)

// Lock submitted form
await lock(caseId)

// Unlock locked form
await unlock(caseId)
```

**Features:**
- Optimistic updates (cache invalidated on success)
- Toast feedback on error
- `isPending` for loading state

---

## Components

### ScheduleETab

**Main tab component with 4-state routing**

```typescript
<ScheduleETab caseId={caseId} />
```

**Handles:**
- Loading & error states
- Empty → Waiting → Summary state transitions
- Error recovery with retry button

---

### ScheduleEEmptyState

**Initial state when no expense exists**

- Shows message: "No Schedule E form created"
- Send button triggers magic link creation
- Loading indicator while sending

---

### ScheduleEWaiting

**State when form is DRAFT (in progress)**

- Shows: "Waiting for client to complete form on portal"
- Resend button for reminder
- Magic link status display

---

### ScheduleESummary

**Read-only view for SUBMITTED/LOCKED**

```typescript
<ScheduleESummary
  expense={expense}
  properties={properties}
  totals={totals}
  caseId={caseId}
/>
```

**Contains:**
- PropertyCard (per property)
- TotalsCard (aggregate)
- StatusBadge (visual status)
- ScheduleEActions (lock/unlock)

---

### PropertyCard

**Expandable property details**

```typescript
<PropertyCard property={property} isLocked={isLocked} />
```

**Shows (collapsed):**
- Property letter (A/B/C)
- Address (sanitized)
- Net income

**Expands to show:**
- Full address (copyable)
- Property type (IRS code)
- Rental period (dates, days)
- Rental income (copyable)
- 7 expense fields with IRS line numbers
- Total expenses
- Net income

**Features:**
- XSS sanitization on address
- Copyable values with toast
- formatUSD() for currency

---

### CopyableValue

**Reusable copyable field**

```typescript
<CopyableValue
  label="Street Address"
  value={property.address.street}
/>
```

**Behavior:**
- Click to copy
- Toast: "Copied to clipboard"
- Visual feedback

---

### TotalsCard

**Aggregate income & expense summary**

```typescript
<TotalsCard totals={totals} properties={properties} />
```

**Displays:**
- Total rental income (all properties)
- Total expenses (all properties)
- Net income (calculated)

---

### StatusBadge

**Visual status indicator**

```typescript
<StatusBadge status={expense.status} />
```

**Variants:**
- DRAFT: Yellow/warning
- SUBMITTED: Blue/info
- LOCKED: Gray/secondary

---

### ScheduleEActions

**Lock/unlock staff controls**

```typescript
<ScheduleEActions
  status={expense.status}
  onLock={() => lock(caseId)}
  onUnlock={() => unlock(caseId)}
  isLocked={expense.status === 'LOCKED'}
/>
```

**Buttons:**
- Lock (if SUBMITTED)
- Unlock (if LOCKED)

---

## Utility Functions

### formatUSD(amount: number): string

**Formats number as USD currency**

```typescript
formatUSD(123456.78) // "$123,456.78"
formatUSD(0) // "$0.00"
```

---

### getPropertyTypeLabel(code: 1-8, lang: 'en'|'vi'): string

**Gets property type label from IRS code**

```typescript
getPropertyTypeLabel(1, 'en') // "Single Family Home"
getPropertyTypeLabel(2, 'vi') // "Nhà chung cư" (Condominium)
```

**Codes:**
- 1: Single Family Home
- 2: Condominium
- 3: Townhouse
- 4: Apartment
- 5: Farm
- 7: Land
- 8: Other

---

### formatAddress(address: ScheduleEPropertyAddress): string

**Formats address as single line**

```typescript
formatAddress({
  street: "123 Main St",
  city: "Boston",
  state: "MA",
  zip: "02101"
})
// "123 Main St, Boston, MA 02101"
```

---

### sanitizeText(text: string): string

**XSS protection for user input**

```typescript
const safe = sanitizeText(userInput)
```

**Escapes:** HTML entities to prevent script injection

---

## Data Structures

### ScheduleEResponse

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
```

### ScheduleEPropertyData

```typescript
interface ScheduleEPropertyData {
  id: 'A' | 'B' | 'C'

  // Address
  address: {
    street: string
    city: string
    state: string
    zip: string
  }

  // Property Info
  type: 1 | 2 | 3 | 4 | 5 | 7 | 8 // IRS type codes
  rentalDays: number
  fairRentalDays: number

  // Income
  rentalIncome: number

  // 7 IRS Expense Fields
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
```

### ScheduleEExpenseData

```typescript
interface ScheduleEExpenseData {
  id: string
  caseId: string
  properties: ScheduleEPropertyData[]
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED'
  submittedAt: Date | null
  lockedAt: Date | null
  versionHistory: unknown[]
}
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/schedule-e/:caseId` | Fetch expense data + magic link + totals |
| `POST` | `/schedule-e/:caseId/send` | Create & send magic link to client |
| `POST` | `/schedule-e/:caseId/resend` | Resend existing magic link |
| `PATCH` | `/schedule-e/:caseId/lock` | Lock form (staff action) |
| `PATCH` | `/schedule-e/:caseId/unlock` | Unlock form (staff action) |

---

## i18n Keys

**Property Fields:**
- `scheduleE.property` - "Property"
- `scheduleE.address` - "Address"
- `scheduleE.type` - "Property Type"
- `scheduleE.rentalDays` - "Rental Days"
- `scheduleE.rentalIncome` - "Rental Income"

**Expense Fields (with IRS line numbers):**
- `scheduleE.line9Insurance` - "Insurance (Line 9)"
- `scheduleE.line12MortgageInterest` - "Mortgage Interest (Line 12)"
- `scheduleE.line14Repairs` - "Repairs (Line 14)"
- `scheduleE.line16Taxes` - "Taxes (Line 16)"
- `scheduleE.line17Utilities` - "Utilities (Line 17)"
- `scheduleE.line11ManagementFees` - "Management Fees (Line 11)"
- `scheduleE.line7CleaningMaintenance` - "Cleaning/Maintenance (Line 7)"

**Status:**
- `scheduleE.status` - "Status"
- `scheduleE.statusDraft` - "Draft"
- `scheduleE.statusSubmitted` - "Submitted"
- `scheduleE.statusLocked` - "Locked"

**Actions:**
- `scheduleE.send` - "Send Form"
- `scheduleE.resend` - "Resend Form"
- `scheduleE.lock` - "Lock Form"
- `scheduleE.unlock` - "Unlock Form"

---

## Common Tasks

### Fetch & Display Schedule E

```typescript
function ScheduleEView({ caseId }) {
  const { expense, properties, totals, isLoading, error } = useScheduleE({ caseId })

  if (isLoading) return <Loader />
  if (error) return <ErrorAlert message={error.message} />
  if (!expense) return <EmptyMessage>No Schedule E created</EmptyMessage>

  return (
    <>
      {properties.map(prop => (
        <PropertyCard key={prop.id} property={prop} isLocked={expense.status === 'LOCKED'} />
      ))}
      <TotalsCard totals={totals} />
    </>
  )
}
```

### Send Magic Link

```typescript
function SendButton({ caseId }) {
  const { send, isPending } = useScheduleEActions()
  const { t } = useTranslation()

  return (
    <Button
      onClick={() => send(caseId)}
      disabled={isPending}
    >
      {isPending ? t('common.sending') : t('scheduleE.send')}
    </Button>
  )
}
```

### Format & Display Expense Value

```typescript
const expenseAmount = property.insurance
const formatted = formatUSD(expenseAmount)

return <p>Insurance: {formatted}</p>
```

### Use Copyable Field

```typescript
<CopyableValue
  label={t('scheduleE.address')}
  value={sanitizeText(property.address.street)}
/>
```

---

## Error Scenarios

| Scenario | Handling |
|----------|----------|
| No expense record | Show ScheduleEEmptyState |
| Network error | Show error boundary with retry |
| API 404 | Case doesn't exist (404) |
| API 403 | User not authorized |
| Mutation fails | Toast error, state unchanged |
| Stale data | Auto-refresh after 30s |

---

## Testing Tips

### Unit Tests
```typescript
// Test useScheduleE
const { result } = renderHook(() => useScheduleE({ caseId: 'case-1' }))
expect(result.current.isLoading).toBe(true)

// Test component rendering
render(<PropertyCard property={mockProperty} isLocked={false} />)
expect(screen.getByText('Property A')).toBeInTheDocument()
```

### Component Tests
```typescript
// Test state transitions
render(<ScheduleETab caseId={caseId} />)

// No expense
expect(screen.getByText(/no schedule e/i)).toBeInTheDocument()

// After data loads with DRAFT
rerender(<ScheduleETab caseId={caseId} />)
expect(screen.getByText(/waiting for client/i)).toBeInTheDocument()
```

### Integration Tests
```typescript
// Test full flow
user.click(screen.getByRole('button', { name: /send form/i }))
await waitFor(() => {
  expect(screen.getByText(/form sent/i)).toBeInTheDocument()
})
```

---

## Performance Notes

- **Lazy Loading:** Tab is lazy-imported on route
- **Stale Time:** 30s prevents excessive refetches
- **Optimistic Updates:** Mutations invalidate cache (no extra query)
- **Expanded Cards:** Reduce initial DOM, expand on demand

---

## Related Documentation

- **Full Feature Doc:** [`schedule-e-phase-4-workspace-tab.md`](./schedule-e-phase-4-workspace-tab.md)
- **Architecture:** [`system-architecture.md`](./system-architecture.md) (Schedule E Workspace Tab section)
- **Code Summary:** [`codebase-summary.md`](./codebase-summary.md)
- **API Backend:** Schedule E Phase 2 documentation (backend routes)

---

**Last Updated:** 2026-02-06
**Maintained by:** Documentation Manager
**Status:** Ready for production
