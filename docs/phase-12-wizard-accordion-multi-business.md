# Phase 2: Wizard Accordion Multi-Business Implementation

**Status:** Complete
**Date:** 2026-04-09
**Branch:** feature/ella-enhance-202
**Related Plan:** Multi-Business Per Client Plan — Phase 2

## Overview

Implemented accordion UI pattern for managing multiple businesses in the client creation wizard's `INDIVIDUAL_WITH_BUSINESS` path. Enables single individual to register multiple associated business entities in one flow via collapsible business cards.

## Key Changes

### Frontend Components

#### 1. **BusinessInfoForm Enhancement** (`apps/workspace/src/components/clients/business-info-form.tsx`)
- Added `idPrefix` prop (default: `'biz-'`) for HTML ID uniqueness when rendered multiple times
- Added `hideTitle` prop to suppress section header when nested inside accordion
- Maintains all validation & field handling logic unchanged
- Props enable reusability in both single-form (BUSINESS path) and multi-instance (accordion) scenarios

#### 2. **BusinessAccordion Component** (NEW: `apps/workspace/src/components/clients/business-accordion.tsx`)
- **Purpose:** Collapsible UI for managing array of business entries
- **Features:**
  - Accordion header shows business name (fallback: "Business N"), business type badge
  - Expand/collapse individual businesses
  - Add/remove buttons with limit check (max 10 businesses)
  - Per-business error highlighting with smart focus (auto-expands first invalid business)
  - Each business form uses unique `idPrefix` to avoid HTML ID collisions
- **Props:**
  - `businesses: BusinessEntry[]` — Array of business data with `_key` UUID
  - `expandedIndex: number` — Currently expanded business index
  - `onExpandedChange` — Callback to update expanded state
  - `onUpdate(index, updates)` — Update specific business data
  - `onAdd()` — Add new empty business entry
  - `onRemove(index)` — Remove business at index
  - `errors` — Array of validation errors (one per business)
- **Key Detail:** Uses `_key` UUID to maintain React key stability across array mutations

#### 3. **Client Component Exports** (`apps/workspace/src/components/clients/index.ts`)
- Exported `BusinessAccordion` alongside existing `BusinessInfoForm`

### Page Implementation

#### CreateClientPage Wizard (`apps/workspace/src/routes/clients/new.tsx`)

**State Management for Multi-Business:**
```typescript
type BusinessEntry = BusinessInfoData & { _key: string }
const makeBizEntry = (): BusinessEntry => ({ ...EMPTY_BUSINESS_INFO, _key: crypto.randomUUID() })

// Only used in INDIVIDUAL_WITH_BUSINESS path
const [businesses, setBusinesses] = useState<BusinessEntry[]>(() => [makeBizEntry()])
const [expandedBizIndex, setExpandedBizIndex] = useState(0)

// Helper methods
const updateBusiness = (index, updates) => { /* update specific business */ }
const addBusiness = () => { /* add new business, max 10 */ }
const removeBusiness = (index) => { /* remove business, adjust expanded */ }
```

**Validation Changes:**
- `validateSingleBusiness()` — Shared validator for single business (used by both BUSINESS and INDIVIDUAL_WITH_BUSINESS paths)
- `validateAllBusinesses()` — Array validator that:
  - Validates all businesses against shared rules
  - Collects errors into `errors.businesses` array
  - Auto-expands first invalid business on failure
  - Returns false only if ALL businesses valid
- Phone validation differs: BUSINESS path requires phone; accordion makes phone optional (falls back to individual's phone)

**Step Flow (INDIVIDUAL_WITH_BUSINESS):**
1. Type Select → `type-select`
2. Individual Form → `individual-form` (validates with validateBasicInfo)
3. Business Form (Accordion) → `business-form` (validates with validateAllBusinesses)
4. Confirm & Send SMS → `confirm`

**Business Form Rendering (INDIVIDUAL_WITH_BUSINESS):**
```tsx
{currentStep === 'business-form' && clientCreationType === 'INDIVIDUAL_WITH_BUSINESS' && (
  <>
    <BusinessAccordion
      businesses={businesses}
      expandedIndex={expandedBizIndex}
      onExpandedChange={setExpandedBizIndex}
      onUpdate={updateBusiness}
      onAdd={addBusiness}
      onRemove={removeBusiness}
      errors={errors.businesses}
    />
    <WizardNavButtons onBack={handleBack} onNext={handleNext} ... />
  </>
)}
```

**Submit Handler (INDIVIDUAL_WITH_BUSINESS):**
- Calls `api.clients.createWithBusiness()` with:
  - `individual` — Personal client data
  - `businesses[]` — Array of business data with normalized phone (uses business phone if provided, else falls back to individual's phone)
  - `groupName` — Generated from individual's name, used to link all entities
  - `customMessage` — SMS template (same as INDIVIDUAL path)
- Response includes both individual and all business clients in a ClientGroup

**Confirm Step (INDIVIDUAL_WITH_BUSINESS):**
- Shows preview summary:
  - Individual record
  - All business records (numbered list)
  - Generated group name
- User can still modify SMS template before final submit

### API Routes (Backend Support)

#### Form Routes (`apps/api/src/routes/form/index.ts` & `schemas.ts`)

**New Schema Support in submitFormSchema:**
- `clientType` enum now includes `'INDIVIDUAL_WITH_BUSINESS'`
- Single `businessName`, `businessType`, etc. fields (public form limitation — only 1 business per form submission)
- Validation rules:
  - INDIVIDUAL path: firstName + phone required; business fields ignored
  - INDIVIDUAL_WITH_BUSINESS path: firstName + phone + businessName required
  - BUSINESS path: businessName + businessPhone required; individual fields ignored

**Public Form Endpoint:** `POST /form/:orgSlug` (unchanged endpoint, expanded schema support)

### Type Definitions

**BusinessInfoData** (unchanged):
```typescript
interface BusinessInfoData {
  name: string
  businessType: BusinessType
  ein: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
}
```

**BusinessEntry** (for accordion state):
```typescript
type BusinessEntry = BusinessInfoData & { _key: string }
```

## Behavior Details

### Multi-Instance HTML ID Safety
- Each business form gets unique `idPrefix`:
  - Single business path: `'biz-'` (e.g., `biz-name`, `biz-ein`)
  - Accordion item N: `'biz-{N}-'` (e.g., `biz-0-name`, `biz-1-name`)
- Prevents duplicate IDs when multiple `BusinessInfoForm` components render simultaneously
- Maintains accessibility (aria-describedby, aria-invalid) without conflicts

### Validation Flow
1. **User clicks Next on business-form step:**
   - Calls `validateAllBusinesses()`
   - Maps each business through `validateSingleBusiness(phoneRequired=false)`
   - Collects errors into array: `errors.businesses[index]`
   - If any errors, expands first invalid business and returns false
   - Navigation halted; user sees errors highlighted in expanded form

2. **Error Display:**
   - Per-field error messages displayed inside expanded accordion item
   - Color-coded input borders (red if error exists)
   - Focus automatically set to first invalid business for accessibility

3. **Successful Validation:**
   - All businesses pass validation
   - handleNext() proceeds to confirm step
   - State preserved for submit

### Add/Remove Business
- **Add:** Creates new entry with `crypto.randomUUID()` key, sets expanded to new index
- **Remove:**
  - Filters business at index from array
  - Auto-adjusts expanded index (if removed index is currently expanded, collapses or moves to adjacent)
  - Maintains referential integrity via _key uniqueness
- **Limit:** Max 10 businesses per individual (matches API backend limit)

### SMS & Confirm
- **SMS Template:** Uses individual's language selection (VI/EN)
- **Message Sent To:** Individual's phone (not each business phone)
- **Confirm Summary:** Shows formatted list:
  ```
  1. Individual: John Doe
  2. Business: Acme Corp (LLC)
  3. Business: Tech Solutions (S-Corp)
  4. Group: John Doe Group
  ```
  Allows user final verification before submit

## Testing Scenarios

1. **Add Multiple Businesses:** Add 3+ businesses, expand each, verify names/types displayed
2. **Validation Errors:** Fill business 1 correctly, business 2 with invalid EIN, click Next → business 2 auto-expands, error shown
3. **Remove Business:** Add 3, remove middle one, verify remaining indices correct, no orphan state
4. **Max Limit:** Add 10 businesses, verify "Add" button disabled
5. **Form Reset:** Create Individual+Business client, new form should reset to 1 empty business entry
6. **Phone Fallback:** Submit with business phone empty → API receives individual's phone for that business

## Files Modified

| File | Change | Impact |
|------|--------|--------|
| `apps/workspace/src/components/clients/business-info-form.tsx` | Added `idPrefix`, `hideTitle` props | Supports reusability in accordion |
| `apps/workspace/src/components/clients/business-accordion.tsx` | NEW component | Core UI for multi-business management |
| `apps/workspace/src/components/clients/index.ts` | Added `BusinessAccordion` export | Public API |
| `apps/workspace/src/routes/clients/new.tsx` | Multi-business state, accordion rendering, validation updates | Wizard now supports N businesses per individual |
| `apps/api/src/routes/form/index.ts` | Schema support for INDIVIDUAL_WITH_BUSINESS | Public form endpoint accepts new path |
| `apps/api/src/routes/form/schemas.ts` | New clientType enum value + validation rules | Form submission validation |

## Integration Notes

- **Backward Compatible:** INDIVIDUAL and BUSINESS paths unchanged; only new path is INDIVIDUAL_WITH_BUSINESS
- **No Schema Changes:** Uses existing `clientGroupId` FK and ClientGroup model from Phase 1
- **Reusable Components:** BusinessInfoForm can be used standalone or in accordion; no coupling
- **State Isolation:** Accordion state (businesses, expandedIndex) only exists in INDIVIDUAL_WITH_BUSINESS path; no risk to other paths
- **Validation Consistency:** Single validator function (`validateSingleBusiness`) used by both BUSINESS and accordion paths

## Success Criteria Met

✓ Multi-business accordion UI implemented and fully functional
✓ Each business independently editable with unique form IDs
✓ Per-business error validation with auto-expand on first error
✓ Add/remove businesses with max 10 limit
✓ Wizard flow supports up to N businesses per individual
✓ Confirm step shows summary of all created entities
✓ SMS sent to individual (not each business)
✓ API backend validates and creates ClientGroup + all entities
✓ No breaking changes to INDIVIDUAL or BUSINESS paths
✓ Full type safety maintained throughout

## Next Steps (Phase 3+)

- **Linked Entity Card on Overview Tab:** Display linked businesses as read-only cards on client detail page
- **Link Business Endpoint:** Allow adding new businesses to existing individual clients
- **Admin Unlink:** Ability to remove business-individual links
- **Bulk SMS Templates:** Separate message templates for individual vs. businesses
