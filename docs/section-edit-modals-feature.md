# Section-Edit-Modals Feature

**Status:** Complete (Phase 05 Security Hardening) | **Date:** 2026-01-20

## Overview

Complete profile editing workflow for staff to update client intake data through modal interfaces. Spans 4 development phases with security hardening, UI polish, and comprehensive testing.

## Architecture

### Phase 02: Section Edit Modal Core

**Location:** `apps/workspace/src/components/clients/section-edit-modal.tsx` | `apps/workspace/src/lib/intake-form-config.ts`

**Components:**
1. **SectionEditModal** (~200 LOC)
   - Modal for editing entire sections of client intake data
   - Props: `isOpen`, `onClose`, `sectionKey`, `client`
   - Re-uses `IntakeQuestion` component for consistent field rendering
   - Features: Dirty tracking, Escape key handling, error display

2. **intake-form-config.ts** (~400 LOC)
   - Centralized configuration for 18 intake form sections
   - `SECTION_CONFIG` - Section metadata (labels, display order, defaults)
   - `FIELD_CONFIG` - 95+ fields with labels, sections, formats, validation options
   - `SELECT_LABELS` - Display values for enum fields (homeOfficeMethod, accountingMethod)
   - `NON_EDITABLE_SECTIONS` - Read-only sections (personal_info, tax_info)

**Sections (18 total):**
- `personal_info` - Name, phone, email (read-only in section modal)
- `prior_year` - Extension, estimated tax payments
- `filing` - Delivery preference, refund routing
- `employment` - W-2 count, 1099-NEC presence
- `income_other` - Interest, dividends, rental, K-1
- `home_sale` - Gross proceeds, gain, lived-in months
- `rental` - Property count, months rented, personal use days
- `dependents` - Child tax credit, daycare, provider details
- `deductions` - HELOC, donations, medical, casualty loss
- `credits` - Energy, R&D, adoption
- `foreign` - FBAR balance, FEIE residency, gifts
- `business` - Self-employment, rental
- `health` - Marketplace coverage, HSA
- And 5 more sections

**API Integration:**
- `updateProfile(clientId, data: UpdateProfileInput)` - PATCH /clients/:id/profile
- Backend merges partial intakeAnswers updates
- Returns `UpdateProfileResponse` with status flags

### Phase 03: Quick-Edit Icons (Inline Field Editing)

**Location:** `apps/workspace/src/components/clients/quick-edit-modal.tsx`

**Component: QuickEditModal** (~260 LOC)
- Mini modal for inline editing of 3 personal fields: name, phone, email
- Wrapper pattern ensures fresh state (component unmounts on close)
- Field-specific validation:
  - **Name:** 2-100 characters, required
  - **Phone:** US E.164 format `+1XXXXXXXXXX`, required
  - **Email:** RFC 5322 pattern, optional, max 254 chars

**Accessibility:**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Error messages with `role="alert"`
- Keyboard shortcuts: Enter (save), Escape (close)
- Global escape listener for reliable key handling
- Auto-focus input on mount (50ms delay)

**UX Polish:**
- Save button disabled if no changes
- Loading state: Spinner + "Đang lưu..." during submission
- Toast notifications with field-specific success messages
- Backdrop click closes modal
- All buttons disabled during submission

**Validation Rules:**
```typescript
type QuickEditField = 'name' | 'phone' | 'email'

// Phone: Regex /^\+1\d{10}$/ (US tax services requirement)
// Email: RFC 5322 simplified pattern
// Name: Trimmed, 2-100 characters
```

### Phase 04: Checklist Recalculation Integration

**Location:** `apps/workspace/src/lib/api-client.ts` | `apps/workspace/src/components/clients/section-edit-modal.tsx`

**API Response Enhancement: UpdateProfileResponse**
```typescript
interface UpdateProfileResponse {
  profile: ClientProfile
  checklistRefreshed: boolean
  cascadeCleanup: {
    triggeredBy: string[]
  }
}
```

**Frontend Integration:**
- **SectionEditModal** onSuccess handler:
  - Invalidates `['checklist', activeCaseId]` query when `checklistRefreshed=true`
  - Toast: "Checklist đã được cập nhật theo thay đổi" if cascade cleanup triggered
- **Query Invalidation Pattern:** React Query ensures stale checklist data refreshed
- **User Feedback:** Two-tier toast system: main success + optional info toast

**Backend Behavior:**
- Evaluates conditions on intakeAnswers change
- Regenerates checklist items dynamically
- Auto-cleans cascade-dependent answers when parent toggles false

### Phase 05: Security Hardening

**Location:** `apps/api/src/routes/clients/schemas.ts` | `apps/api/src/routes/clients/index.ts`

#### 1. Prototype Pollution Prevention

**File:** `apps/api/src/routes/clients/schemas.ts` (lines 106-119)

**Implementation:**
```typescript
const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
])

// In updateProfileSchema:
.refine(
  (val) => !val || Object.keys(val).every((key) => !DANGEROUS_KEYS.has(key)),
  { message: 'Reserved key name not allowed (potential prototype pollution)' }
)
```

**Scope:** Applies to `intakeAnswers` partial updates in `PATCH /clients/:id/profile`

**Validation Layers:**
1. Key format validation: `/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/`
2. Dangerous key blocklist check
3. Max 200 keys per request
4. Max 500 chars per string value

#### 2. XSS Prevention for String Values

**File:** `apps/api/src/routes/clients/index.ts` (lines 467-476)

**Implementation:**
```typescript
// Sanitize string values in intakeAnswers to prevent XSS
const sanitizedIntakeAnswers = body.intakeAnswers
  ? Object.fromEntries(
      Object.entries(body.intakeAnswers).map(([key, value]) => [
        key,
        typeof value === 'string' ? sanitizeTextInput(value, 500) : value,
      ])
    )
  : undefined
```

**Defense Strategy:**
- Backend sanitization: Removes dangerous HTML/script tags
- Frontend escaping: Additional layer when rendering audit logs
- Defense-in-depth approach prevents XSS from multiple attack vectors

**Security Comments in Code:**
```typescript
// Security Notes:
// - Input validation via Zod (key format, value types, max counts)
// - Audit values stored as JSON - frontend MUST escape when rendering to prevent XSS
// - Consider adding rate limiting middleware (e.g., 10 req/min per client) in production
// - Audit log retention: IRS requires 7 years - implement scheduled cleanup job
```

## Test Coverage (Phase 05)

### profile-update.test.ts (22 tests)
**Location:** `apps/api/src/routes/clients/__tests__/profile-update.test.ts`

**Test Categories:**
- Successful profile updates (intakeAnswers merge, partial updates)
- XSS payload rejection (script tags, event handlers, encoded variants)
- Prototype pollution attempts (__proto__, constructor, etc.)
- Field validation (max length, type constraints)
- Error handling (client not found, validation failures)
- Audit logging (changes tracked correctly)

**Key Test Patterns:**
```typescript
// XSS test
it('should sanitize XSS payloads in string values', async () => {
  const xssPayload = '<script>alert("xss")</script>'
  const response = await updateProfile(clientId, {
    intakeAnswers: { companyName: xssPayload }
  })
  expect(response.profile.intakeAnswers.companyName).not.toContain('<script>')
})

// Prototype pollution test
it('should reject __proto__ key', async () => {
  const response = await updateProfile(clientId, {
    intakeAnswers: { '__proto__': { admin: true } }
  })
  expect(response.status).toBe(400)
  expect(response.error).toContain('Reserved key')
})
```

### audit-logger.test.ts (22 tests)
**Location:** `apps/api/src/services/__tests__/audit-logger.test.ts`

**Test Coverage:**
- Audit log creation for profile changes
- Field-level change tracking
- Staff attribution
- Batch logging
- Error resilience (doesn't fail API requests)
- Compliance with IRS audit requirements

## Data Flow

### Update Flow
```
User Input (SectionEditModal)
    ↓
Frontend Validation (React hook form)
    ↓
API Request: PATCH /clients/:id/profile
    ↓
Zod Validation (schemas.ts)
  - Key format check
  - Dangerous keys blocklist
  - Type validation
    ↓
Backend Processing (index.ts)
  - XSS sanitization (sanitizeTextInput)
  - Merge with existing intakeAnswers
  - Compute diffs
    ↓
Audit Logging (audit-logger.ts)
  - Field-level changes recorded
  - Staff attribution
    ↓
Checklist Refresh (checklist-generator.ts)
  - Evaluate conditions
  - Regenerate items
  - Cascade cleanup
    ↓
Response: UpdateProfileResponse
  - Updated profile
  - Checklist refresh status
  - Cascade cleanup feedback
    ↓
Frontend Cache Invalidation
  - React Query invalidates stale data
  - Toast notification
  - UI updates
```

## Integration Points

### With Audit Logging (Phase 01)
- Section edits trigger field-level audit logs
- Staff attribution tracked automatically
- Complies with 7-year IRS retention requirement

### With Checklist System (Phase 01/03)
- Profile updates trigger condition evaluation
- Dynamic count mappings (w2Count, rentalPropertyCount, k1Count)
- Cascade cleanup prevents orphaned conditional data

### With Intake System (Phase 02)
- Reuses 18-section configuration
- Supports 95+ dynamic fields
- Vietnamese labels on all fields

## UI Components Used

- **shadcn/ui Dialog** - Modal wrapper
- **shadcn/ui Form** - Form rendering
- **lucide-react Icons** - Pencil (edit), X (close), Spinner (loading)
- **Tailwind CSS** - Styling with responsive design
- **React Query** - Cache invalidation and state management

## Performance Considerations

1. **Section Loading:** Lazy-load field config only for open sections
2. **Validation:** Real-time feedback via React hook form
3. **Debouncing:** Consider debounced saves for large forms (via useDebouncedSave hook)
4. **Caching:** Checklist refresh only if conditions changed
5. **Rate Limiting:** Recommend 10 req/min per client in production

## Security Best Practices

1. **Validation-First:** Zod schemas validate before processing
2. **Defense-in-Depth:** Backend sanitization + frontend escaping
3. **Prototype Pollution Blocklist:** Explicit dangerous keys list
4. **Audit Trail:** All changes logged with staff attribution
5. **Error Handling:** Never expose internal details to user

## Future Enhancements

1. Add rate limiting (10 req/min per client)
2. Implement audit log cleanup job (7-year retention)
3. Add field-level permissions for sensitive sections
4. Batch edit mode for multiple clients
5. Undo/redo functionality for recent changes

## Related Files

- `apps/api/src/services/audit-logger.ts` - Field-level change tracking
- `apps/api/src/services/checklist-generator.ts` - Condition evaluation
- `@ella/shared` - Validation schemas and types
- `phase-02-api-endpoints.md` - API design patterns

---

**Last Updated:** 2026-01-20 | **Version:** 8.0.0
