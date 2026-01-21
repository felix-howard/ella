# Phase 02: Document Tab UX Redesign - Category Checklist

**Status:** COMPLETED
**Date:** 2026-01-21
**Branch:** feature/more-enhancement

## Overview

Redesigned TieredChecklist component to use **category-based grouping** instead of tier-based (required/applicable/optional). Consolidates 5 status states into 3 visual states for cleaner, more scannable UI. Direct row-click verification flow removes intermediate file expansion step.

## Architecture Changes

### 1. Constants Layer (`apps/workspace/src/lib/checklist-tier-constants.ts`)

**New:** `CATEGORY_STYLES` constant defines 5 document categories with visual hierarchy:

```typescript
export const CATEGORY_STYLES = {
  personal: { icon: '👤', color: 'text-purple-600', bgColor: 'bg-purple-500/5', borderColor: 'border-purple-500/20' },
  income: { icon: '💰', color: 'text-emerald-600', bgColor: 'bg-emerald-500/5', borderColor: 'border-emerald-500/20' },
  deductions: { icon: '📝', color: 'text-amber-600', bgColor: 'bg-amber-500/5', borderColor: 'border-amber-500/20' },
  business: { icon: '🏢', color: 'text-blue-600', bgColor: 'bg-blue-500/5', borderColor: 'border-blue-500/20' },
  other: { icon: '📎', color: 'text-gray-600', bgColor: 'bg-gray-500/5', borderColor: 'border-gray-500/20' },
}
```

**New:** `SIMPLIFIED_STATUS_DISPLAY` consolidates statuses into 3 visual states:

| Old Status | New Display | Color | UI Icon |
|-----------|-------------|-------|---------|
| MISSING | MISSING | red/error | ✗ |
| HAS_RAW OR HAS_DIGITAL | SUBMITTED | blue/primary | ◉ (filled circle) |
| VERIFIED | VERIFIED | green/success | ✓ |
| NOT_REQUIRED | NOT_REQUIRED | gray/muted | — |

**New:** `CategoryKey` type exported for category identifiers.

### 2. Component Changes (`apps/workspace/src/components/cases/tiered-checklist.tsx`)

#### Main Component
- Replaced tier-based grouping → category-based grouping
- Renamed: `TierSection` → `CategorySection`
- Uses `groupItemsByCategory()` helper to map items via `DOC_TYPE_CATEGORIES`

#### Helper Functions

**`findCategoryForDocType(docType)`** - Maps document type to category
```typescript
// Example: W2 → 'income', RECEIPT → 'deductions', UNKNOWN → 'other'
```

**`groupItemsByCategory(items)`** - Builds category groups from checklist items
- Returns categories in `DOC_TYPE_CATEGORIES` order
- Filters empty groups (no items)
- Order: personal → income → deductions → business → other

**`getSimplifiedStatus(status)`** - Consolidates 5 statuses to 3 visual states
```typescript
MISSING → MISSING (red)
VERIFIED → VERIFIED (green)
HAS_RAW or HAS_DIGITAL → SUBMITTED (blue)
NOT_REQUIRED → NOT_REQUIRED (gray)
```

#### CategorySection Component
- Header shows: icon, category label, progress (received/total)
- Collapsible with expand/collapse chevron
- Stats calculation excludes NOT_REQUIRED items from total
- Color-coded by category via `CATEGORY_STYLES`

#### ChecklistItemRow Component
- **Simplified interaction model:**
  - Row click → directly triggers `onVerify(item)` callback
  - Opens VerificationModal (no intermediate expansion)
- Status indicator shows: icon (✓/◉/✗/—) in colored badge
- Labels: document type, manual-add badge, count info (if multi-doc)
- Action buttons row (separate from clickable area):
  - Notes indicator (message icon if has notes/reason)
  - Staff actions: skip/unskip buttons
- Skipped items: grayed out, disabled click, show skip reason

## Category System (`DOC_TYPE_CATEGORIES`)

Maps all document types to 5 categories:

```typescript
personal: ['SSN_CARD', 'DRIVER_LICENSE', 'PASSPORT', 'BIRTH_CERTIFICATE']
income: ['W2', 'FORM_1099_*', ...] // 9 types
deductions: ['FORM_1098', 'FORM_1098_T', 'RECEIPT', 'DAYCARE_RECEIPT']
business: ['PROFIT_LOSS_STATEMENT', 'BUSINESS_LICENSE', 'EIN_LETTER', 'BANK_STATEMENT']
other: ['OTHER', 'UNKNOWN']
```

Each category has:
- Vietnamese label (e.g., 'Giấy tờ cá nhân', 'Thu nhập')
- List of `docTypes` for mapping

## UI/UX Flow

### Before (Tier-based)
1. View checklist grouped by: Required → Applicable → Optional
2. Click item → expand file details
3. Click verify button on file → open modal

### After (Category-based)
1. View checklist grouped by: Personal → Income → Deductions → Business → Other
2. Click item row → directly open VerificationModal
3. No intermediate expansion step

### Visual Changes
- **Removed:** Tier icons (🔴🟡🟢), tier-specific colors
- **Added:** Category icons (👤💰📝🏢📎), category-specific colors
- **Simplified:** 5 status badges → 3 status badges
- **Progress:** Shows received count / active items (excludes NOT_REQUIRED)

## API Integration

**No API changes.** Component uses same `ChecklistItem[]` structure:

```typescript
ChecklistItem {
  id: string
  status: 'MISSING' | 'HAS_RAW' | 'HAS_DIGITAL' | 'VERIFIED' | 'NOT_REQUIRED'
  template: {
    docType: string  // Used for category lookup
    labelVi: string
  }
  expectedCount?: number
  receivedCount?: number
  isManuallyAdded?: boolean
  notes?: string
  skippedReason?: string
  addedReason?: string
}
```

**Callbacks (unchanged):**
- `onVerify(item)` - Open VerificationModal
- `onSkip(itemId, reason)` - Skip item with reason
- `onUnskip(itemId)` - Restore skipped item
- `onViewNotes(item)` - Show notes/reasons
- `onAddItem()` - Staff action

## File Structure

```
apps/workspace/src/
├── lib/
│   ├── checklist-tier-constants.ts  (UPDATED: CATEGORY_STYLES, SIMPLIFIED_STATUS_DISPLAY)
│   └── constants.ts                 (UNCHANGED: DOC_TYPE_CATEGORIES used as-is)
├── components/cases/
│   ├── tiered-checklist.tsx        (REFACTORED: category-based logic)
│   └── skip-item-modal.tsx         (UNCHANGED)
└── ...
```

## Testing Recommendations

1. **Category Grouping:** Verify items group correctly by docType → category
2. **Empty Categories:** Test when some categories have 0 items (should not render)
3. **Status Display:** Confirm 5→3 status consolidation displays correctly
4. **Row Click:** Verify row click triggers onVerify (not expand)
5. **Skipped State:** Check grayed-out, disabled-click behavior for NOT_REQUIRED items
6. **Progress Calculation:** Verify received/total excludes NOT_REQUIRED

## Backward Compatibility

- **Component API:** Props unchanged (TieredChecklistProps identical)
- **Data Format:** ChecklistItem structure unchanged
- **Constants:** `CHECKLIST_TIERS` still available but unused in this component
- **Callback Signatures:** All handlers maintain same signatures

## Performance

- `groupItemsByCategory()` uses `useMemo([items])` to avoid re-grouping on render
- Category stats calculation memoized via `useMemo([items])`
- Collapse/expand state local to CategorySection (no parent re-render)

## Accessibility

- Collapsible headers have semantic `<button>` with ARIA labels
- Skip/unskip buttons have `title` attributes and `aria-label`
- Status badges have `title` with Vietnamese label
- Notes button labeled "Xem ghi chú" (View notes)

## Future Enhancements

1. **Persist Category Collapse State** - localStorage or API preference
2. **Filter by Status** - Quick filter for MISSING/SUBMITTED/VERIFIED
3. **Bulk Actions** - Select multiple items, bulk verify/skip
4. **Search within Category** - Find docs by name
5. **Category Reordering** - Custom order preference

## Related Documentation

- [Checklist System Overview](./phase-2-checklist-questionnaire-redesign.md)
- [Verification Modal](./phase-05-verification-modal.md)
- [Code Standards - Component Patterns](./code-standards.md)
- [System Architecture - Workspace Layer](./system-architecture.md)
