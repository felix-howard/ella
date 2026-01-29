# Schedule C 1099-NEC Breakdown Feature

**Status:** Complete & Production-Ready
**Date:** 2026-01-29
**Branch:** feature/engagement-only
**Components:** 11 modified files + 1 new component

---

## Overview

Adds per-payer 1099-NEC breakdown display to Schedule C expense management. Staff can now view a detailed list of all verified 1099-NECs with individual payer names and compensation amounts, displayed inline under gross receipts in the income table.

**Key Achievement:** Enhanced transparency - staff see exact payer-by-payer breakdown vs. just gross total.

---

## Changes by Layer

### Backend (API Layer)

#### apps/api/src/services/schedule-c/expense-calculator.ts

**New Interface:**
```typescript
interface NecBreakdownItem {
  docId: string                          // Unique doc identifier
  payerName: string | null               // Payer name from extracted data
  nonemployeeCompensation: string        // Formatted "5000.00"
}
```

**New Function:**
```typescript
async function getGrossReceiptsBreakdown(caseId: string): Promise<NecBreakdownItem[]>
```

- Queries `digitalDoc` table for all VERIFIED 1099-NECs in case
- Filters by: `docType='FORM_1099_NEC'` + `status='VERIFIED'`
- Extracts `payerName` and `nonemployeeCompensation` from `extractedData` JSONB
- Formats amounts to 2 decimals ("5000.00")
- Orders by creation date (chronological payer order)
- Filters out docs without `nonemployeeCompensation` field

**Refactored Function:**
```typescript
async function calculateGrossReceipts(
  caseId: string,
  breakdown?: NecBreakdownItem[]  // Optional pre-fetched breakdown
): Promise<Decimal>
```

- Now accepts optional `breakdown` parameter to avoid duplicate queries
- Reuses breakdown data if provided
- Falls back to `getGrossReceiptsBreakdown()` if not provided
- Sums all items' `nonemployeeCompensation`

#### apps/api/src/routes/schedule-c/index.ts

**GET /schedule-c/:caseId Changes:**

1. Fetches NEC breakdown once (line 115):
   ```typescript
   const necBreakdown = await getGrossReceiptsBreakdown(caseId)
   ```

2. Auto-updates DRAFT grossReceipts with optimistic locking (lines 118-129):
   - Detects new 1099-NECs verified after form was sent
   - Recalculates gross receipts using `calculateGrossReceipts(caseId, necBreakdown)`
   - Only updates if status still DRAFT (race condition safe)
   - Prevents overwriting client-entered data post-submission

3. Returns necBreakdown array in response (line 205):
   ```typescript
   {
     expense: { ... },
     magicLink: { ... },
     totals: { ... },
     necBreakdown: NecBreakdownItem[]  // NEW
   }
   ```

**No Changes:** POST /send, PATCH /lock, PATCH /unlock, POST /resend (still functional)

### Frontend (API Client)

#### apps/workspace/src/lib/api-client.ts

**New Type:**
```typescript
type NecBreakdownItem = {
  docId: string
  payerName: string | null
  nonemployeeCompensation: string
}
```

**Updated Type:**
```typescript
interface ScheduleCResponse {
  expense: ScheduleCExpense | null
  magicLink: ScheduleCMagicLink | null
  totals: ScheduleCTotals | null
  necBreakdown: NecBreakdownItem[]  // NEW
}
```

### Frontend (Hooks)

#### apps/workspace/src/hooks/use-schedule-c.ts

**Changes:**
- Line 49: Extracts `necBreakdown` from API response
  ```typescript
  const necBreakdown = scheduleCData?.necBreakdown ?? []
  ```

- Line 64: Derives `count1099NEC` from breakdown length
  ```typescript
  count1099NEC: necBreakdown.length,  // Number of verified payers
  ```

- Line 61: Exposes breakdown in return object
  ```typescript
  necBreakdown,
  ```

**Return Object:**
```typescript
{
  necBreakdown: NecBreakdownItem[]       // Per-payer breakdown list
  count1099NEC: number                   // Total verified payers
  // ... existing fields
}
```

### Frontend (Components)

#### apps/workspace/src/components/cases/tabs/schedule-c-tab/nec-breakdown-list.tsx (NEW)

**Component:** `NecBreakdownList`

```typescript
interface NecBreakdownListProps {
  items: NecBreakdownItem[]
}
```

**Features:**
- Renders list of payers + compensation amounts
- Displays payer name left-aligned, amount right-aligned
- Falls back to "Không rõ" (Unknown) if payerName is null
- Shows amount as copyable value (USD formatted)
- Left border accent (muted color)
- Compact text size (text-xs)
- Hides if items array empty

**Styling:**
- Border left: 2px muted color
- Truncate payer name (overflow)
- Whitespace-nowrap for amounts
- Small font + tight spacing for density

#### apps/workspace/src/components/cases/tabs/schedule-c-tab/income-table.tsx

**Changes:**
- Accepts `necBreakdown: NecBreakdownItem[]` prop
- Dynamic label: Shows "1099-NEC Gross Receipts (X payers)" vs. static text
- Renders `<NecBreakdownList />` below gross receipts row
- Preserves existing fields (returns, COGS, other income, gross income)

#### apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-empty-state.tsx

**Changes:**
- Accepts `count1099NEC: number` prop
- Shows "Schedule C form not yet sent. We detected {count1099NEC} 1099-NEC payer(s)."
- Displays count before "Send Form to Client" button
- Helps staff understand incoming data

#### apps/workspace/src/components/cases/tabs/schedule-c-tab/index.tsx

**Changes:**
- Passes `necBreakdown` and `count1099NEC` to child components
- Routes props to ScheduleCEmptyState, ScheduleCWaiting, ScheduleCSummary

#### apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-waiting.tsx

**Changes:**
- Passes `necBreakdown` to IncomeTable
- Shows pending state while client fills form

#### apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-summary.tsx

**Changes:**
- Passes `necBreakdown` to IncomeTable
- Displays breakdown when form submitted/locked

---

## Testing

### Backend Tests (6 new tests)

**File:** apps/api/src/services/schedule-c/__tests__/expense-calculator.test.ts

#### New Test Suite: `getGrossReceiptsBreakdown`

1. **"returns per-payer breakdown with docId, payerName, amount"**
   - Verifies structure: docId, payerName, nonemployeeCompensation
   - Tests multiple payers

2. **"returns empty array when no verified 1099-NECs"**
   - Edge case: no docs matched

3. **"returns null payerName when not in extractedData"**
   - Null-safe field extraction

4. **"filters out docs without nonemployeeCompensation"**
   - Skips incomplete docs + null extractedData

5. **"handles numeric compensation values"**
   - Type coercion: number→string formatted

6. **"queries with correct filters and ordering"**
   - Verifies Prisma query: docType=FORM_1099_NEC, status=VERIFIED, orderBy createdAt asc

---

## Data Flow

```
Staff views client detail → Schedule C tab loads
  │
  ├─ useScheduleC(caseId)
  │   ├─ GET /schedule-c/:caseId
  │   ├─ Backend: getGrossReceiptsBreakdown(caseId)
  │   │   └─ Query: VERIFIED 1099-NECs from digitalDoc
  │   └─ Response: { expense, magicLink, totals, necBreakdown[] }
  │
  ├─ IncomeTable receives necBreakdown
  │   └─ Renders:
  │       Gross Receipts (1099-NEC): $8,000.50
  │       ├─ ABC Corp: $5,000.00 [copy]
  │       └─ XYZ Inc: $3,000.50 [copy]
  │       Returns & Discounts: -$200
  │       COGS: -$1,000
  │       Gross Income: $6,800.50
  │
  └─ Every breakdown item copyable (raw value)
```

---

## Feature Highlights

| Aspect | Behavior |
|--------|----------|
| **Data Source** | Verified 1099-NECs only (not draft/pending docs) |
| **Auto-Update** | DRAFT grossReceipts recalculated when new 1099s verified |
| **Null Safety** | payerName can be null; displays "Không rõ" |
| **Formatting** | Amounts always 2 decimals; copy-to-clipboard support |
| **Performance** | Single query (getGrossReceiptsBreakdown) reused for total + breakdown |
| **Ordering** | Chronological by 1099-NEC creation date |
| **Visibility** | Always shown (after gross receipts); hidden if count=0 |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Case has no 1099-NECs | necBreakdown = [], list hidden, empty gross receipts |
| 1099-NEC missing payerName | Shows "Không rõ" in list |
| extractedData is null | Doc filtered out (not included) |
| No nonemployeeCompensation field | Doc filtered out (not included) |
| API error fetching breakdown | useScheduleC error state; "Lỗi khi tải dữ liệu" toast |

---

## Backward Compatibility

- **API:** ScheduleCResponse now includes `necBreakdown` array
  - Clients not handling `necBreakdown` simply ignore new field
  - Existing `expense`, `magicLink`, `totals` unchanged

- **Components:** necBreakdown is optional prop in IncomeTable
  - If not passed, breakdown list not rendered (graceful degradation)

- **Calculations:** No change to expense calculator logic
  - `calculateGrossReceipts()` optional parameter doesn't break existing calls

---

## Integration with Existing Features

### Phase 4 Workspace
- Integrates seamlessly into existing Schedule C tab
- No impact on form send/lock/unlock/resend workflows
- Version history unaffected

### Phase 3 Portal
- No changes to client-facing expense form
- Client still submits same data structure

### Phase 1-2 Backend
- New function pure-play: getGrossReceiptsBreakdown()
- Existing functions (calculateGrossReceipts, calculateScheduleCTotals) unchanged signature

---

## Known Limitations

1. **No Breakdown History:** Doesn't track when 1099-NECs were added (only current state shown)
2. **No Filtering UI:** Staff can't hide/reorder payers in breakdown list
3. **No Partial Edits:** Can't manually adjust individual payer amounts
4. **Display Only:** Breakdown is read-only reference; amounts drive gross receipts

---

## Next Steps

### Immediate
- Code review + merge to main
- QA testing: multiple 1099-NECs, null payerName, auto-update behavior

### Future Enhancements
1. **Breakdown Analytics:** Chart payer distribution
2. **Payer Management:** UI to associate/reassociate 1099-NECs with line items
3. **Reconciliation Tool:** Compare breakdown vs. submitted totals
4. **PDF Export:** Include breakdown in exported Schedule C

---

## File Summary

| File | Type | Changes | LOC |
|------|------|---------|-----|
| expense-calculator.ts | Service | +1 interface, +1 function, +1 param | +50 |
| schedule-c/index.ts | Route | +necBreakdown in response, +auto-update | +15 |
| api-client.ts | Type | +NecBreakdownItem type, +necBreakdown to response | +10 |
| use-schedule-c.ts | Hook | +necBreakdown extraction, +count1099NEC | +5 |
| nec-breakdown-list.tsx | Component | NEW component | +35 |
| income-table.tsx | Component | +necBreakdown prop, +NecBreakdownList render | +20 |
| schedule-c-empty-state.tsx | Component | +count1099NEC prop, +payer count display | +5 |
| index.tsx | Component | +props passing | +3 |
| schedule-c-waiting.tsx | Component | +necBreakdown pass-through | +2 |
| schedule-c-summary.tsx | Component | +necBreakdown pass-through | +2 |
| expense-calculator.test.ts | Test | +6 getGrossReceiptsBreakdown tests | +70 |

**Total Additions:** ~217 LOC + 6 new tests

---

**Last Updated:** 2026-01-29
**Status:** Ready for merge
