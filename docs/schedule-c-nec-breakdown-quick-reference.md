# Schedule C 1099-NEC Breakdown - Quick Reference

**Status:** Complete | **Date:** 2026-01-29 | **For:** Developers, QA, Review

---

## What Changed?

Staff can now see **per-payer breakdown** of 1099-NECs under gross receipts. Shows individual payer names + compensation amounts.

---

## Key Files Modified

### Backend (3 files)

```
apps/api/src/services/schedule-c/
├── expense-calculator.ts          # +getGrossReceiptsBreakdown()
└── __tests__/expense-calculator.test.ts  # +6 tests

apps/api/src/routes/schedule-c/
└── index.ts                       # GET returns necBreakdown + auto-updates DRAFT
```

### Frontend (8 files + 1 new)

```
apps/workspace/src/
├── lib/api-client.ts              # +NecBreakdownItem type
├── hooks/use-schedule-c.ts        # +necBreakdown extraction
└── components/cases/tabs/schedule-c-tab/
    ├── nec-breakdown-list.tsx     # NEW component
    ├── income-table.tsx           # Updated with breakdown
    ├── schedule-c-empty-state.tsx # Updated with count
    ├── index.tsx                  # Props routing
    ├── schedule-c-waiting.tsx     # Props pass-through
    └── schedule-c-summary.tsx     # Props pass-through
```

---

## Data Structures

### NecBreakdownItem (New Type)

```typescript
interface NecBreakdownItem {
  docId: string                    // Document ID
  payerName: string | null         // "ABC Corp" or null → "Không rõ"
  nonemployeeCompensation: string  // "5000.00" (always 2 decimals)
}
```

### API Response (Updated)

```typescript
GET /schedule-c/:caseId responds with:
{
  expense: { ... },
  magicLink: { ... },
  totals: { ... },
  necBreakdown: NecBreakdownItem[]  // NEW FIELD
}
```

---

## Hook Changes

### useScheduleC (Updated)

```typescript
const {
  necBreakdown,              // NecBreakdownItem[]
  count1099NEC,              // number (breakdown.length)
  // ... existing fields
} = useScheduleC({ caseId })
```

---

## Component Props

### IncomeTable (Updated)

```typescript
<IncomeTable
  necBreakdown={necBreakdown}        // NEW prop
  expense={expense}
  totals={totals}
/>
```

### NecBreakdownList (New)

```typescript
<NecBreakdownList items={necBreakdown} />

// Displays:
// ABC Corp                    $5,000.00
// XYZ Inc                     $3,000.50
// Không rõ                      $500.00
```

---

## Auto-Update Mechanism

### When Triggered

1. GET /schedule-c/:caseId called
2. Status is DRAFT
3. New 1099-NECs have been verified since form was sent

### What Happens

```
Backend:
├─ Fetch necBreakdown (all VERIFIED 1099-NECs)
├─ Calculate gross receipts from breakdown
├─ Compare to stored value
└─ If changed & still DRAFT → UPDATE (optimistic locking)

Frontend:
└─ Show updated gross receipts + new payers in breakdown list
```

### Key: Optimistic Locking

Only updates if status remains DRAFT. Prevents overwriting client's submitted data.

---

## Testing Checklist (QA)

- [ ] Single 1099-NEC displays (1 payer)
- [ ] Multiple 1099-NECs display (all payers shown)
- [ ] Null payerName shows "Không rõ"
- [ ] Amounts formatted as USD with 2 decimals
- [ ] Copy-to-clipboard works for amounts
- [ ] Breakdown hidden if no 1099-NECs
- [ ] Dynamic label shows correct count ("1 payer" vs. "3 payers")
- [ ] Empty state shows count before form sent
- [ ] New 1099-NEC auto-updates DRAFT form gross receipts
- [ ] No update if form SUBMITTED/LOCKED
- [ ] API error shows toast: "Lỗi khi tải dữ liệu"

---

## Error Scenarios

| Case | Behavior |
|------|----------|
| No 1099-NECs | Breakdown hidden, empty gross receipts |
| payerName null | Shows "Không rõ" |
| extractedData missing | Doc filtered out (not included) |
| nonemployeeCompensation missing | Doc filtered out (not included) |
| Status SUBMITTED/LOCKED | No auto-update (immutable) |

---

## Code Review Checklist

- [ ] NecBreakdownItem interface consistent across all files
- [ ] getGrossReceiptsBreakdown() filters only VERIFIED docs
- [ ] Amounts always formatted to 2 decimals
- [ ] Optimistic locking works (updateMany with status filter)
- [ ] No duplicate queries (breakdown reused for total + display)
- [ ] Component props flow correctly through hierarchy
- [ ] Copy-to-clipboard values are raw (not formatted)
- [ ] "Không rõ" fallback for null payerName
- [ ] Tests cover edge cases (empty, null, numeric values)
- [ ] No TypeScript errors

---

## Backward Compatibility

✅ **API:** necBreakdown is new field; clients ignoring it unaffected
✅ **Components:** necBreakdown is optional; graceful degradation if missing
✅ **Functions:** calculateGrossReceipts() accepts optional param; no breaking change

---

## Performance Notes

- **Query:** Single call to getGrossReceiptsBreakdown(), reused for total + display
- **Locking:** updateMany() touches only DRAFT records
- **Caching:** 30s stale time (same as existing Schedule C data)
- **Rendering:** NecBreakdownList memoized

---

## Related Documentation

- **Full Feature Doc:** `schedule-c-nec-breakdown-feature.md`
- **System Architecture:** `system-architecture.md` (Phase 4 Enhancement section)
- **Phase 4 Context:** `schedule-c-phase-4-workspace-viewer.md`
- **Test Details:** See `expense-calculator.test.ts` (6 new tests)

---

## FAQ

**Q: How is gross receipts calculated?**
A: Sums nonemployeeCompensation from all necBreakdown items.

**Q: What if a 1099-NEC lacks payerName?**
A: Shows "Không rõ" in the breakdown list.

**Q: Does auto-update overwrite client input?**
A: No. Only updates if status still DRAFT (optimistic locking).

**Q: Can staff manually edit payer names?**
A: No. Breakdown is read-only (from OCR extraction).

**Q: What if extractedData extraction failed?**
A: Doc is filtered out (not included in breakdown).

---

**Quick Links:**
- Implementation: `apps/api/src/services/schedule-c/expense-calculator.ts`
- Tests: `apps/api/src/services/schedule-c/__tests__/expense-calculator.test.ts`
- Frontend: `apps/workspace/src/components/cases/tabs/schedule-c-tab/`
- API: `apps/api/src/routes/schedule-c/index.ts`

---

**Last Updated:** 2026-01-29
