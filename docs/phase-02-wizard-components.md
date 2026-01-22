# Phase 2 - Intake Wizard Components (Complete)

**Status:** Completed (2026-01-22)
**Branch:** fix/minor-fix

## Overview

Phase 2 implements a multi-step intake wizard for collecting client identity, income, deduction, and review information. A full-featured orchestrator manages state transitions, validation, and progress tracking.

## Architecture

**Location:** `apps/workspace/src/components/clients/intake-wizard/`

```
intake-wizard/
├── index.ts                          (Module exports)
├── wizard-container.tsx              (Main orchestrator component)
├── wizard-step-indicator.tsx         (Progress bar + step numbers)
├── wizard-step-1-identity.tsx        (Taxpayer/spouse/dependents)
├── wizard-step-2-income.tsx          (Income source checkboxes)
├── wizard-step-3-deductions.tsx      (Deduction checkboxes)
├── wizard-step-4-review.tsx          (Bank info + summary)
├── dependent-grid.tsx                (Repeating dependent grid)
├── wizard-constants.ts               (Magic numbers - NEW)
└── use-category-toggle.ts            (Shared toggle logic - NEW)
```

## Components Summary

### WizardContainer (Main Orchestrator)

**File:** `wizard-container.tsx` (~500 LOC)

**Props:**
```typescript
interface WizardContainerProps {
  clientId: string
  caseId: string
  onComplete: () => void
  initialData?: IntakeAnswers
}
```

**Features:**
- Multi-step form state management (steps 1-4)
- Form validation before step advance
- Progress persistence (localStorage)
- Keyboard navigation (Enter/Escape)
- Summary generation on step 4
- Submit to `api.clients.updateProfile()`
- Loading state + error handling
- Toast notifications (Vietnamese UI)

**State Management:**
- `currentStep` - Track active step (1-4)
- `formData` - Accumulate IntakeAnswers across steps
- `isLoading` - Submit loading state
- `validationErrors` - Field-level errors

**Key Methods:**
- `handleNextStep()` - Validate + advance (preventDefault on error)
- `handlePreviousStep()` - Go back without validation
- `handleSubmit()` - Save to backend + call onComplete()
- `handleSkip()` - Option to skip wizard entirely

### WizardStepIndicator (Progress Bar)

**File:** `wizard-step-indicator.tsx` (~80 LOC)

**Props:**
```typescript
interface WizardStepIndicatorProps {
  currentStep: number
  totalSteps: number
  steps: string[]
}
```

**UI:**
- Horizontal progress bar
- Step numbers with labels
- Active state highlighting (mint green #10b981)
- Completion percentage display
- Accessible (ARIA labels)

### Step 1 - Identity (WizardStep1Identity)

**File:** `wizard-step-1-identity.tsx` (~400 LOC)

**Collects:**

**Taxpayer (8 fields):**
- SSN (encrypted), DOB, Occupation
- Driver's License: Number, Issue Date, Exp Date, State, IP PIN

**Spouse (8 fields, conditional MFJ):**
- Same as taxpayer (mirrors structure)

**Dependents (Dynamic):**
- Count field, then repeating grid via `DependentGrid`
- Per dependent: Name, SSN, DOB, Relationship
- Validation: SSN format, DOB format (YYYY-MM-DD)

**Features:**
- Conditional spouse fields (shown if filingStatus = 'MFJ')
- DependentGrid sub-component for repeating entries
- Real-time SSN masking (display only)
- Date picker integration
- Copy-friendly SSN display (shows masked but input validates)

**Validation:**
- SSN: 9 digits, no invalid prefixes (via `isValidSSN()`)
- DOB: ISO date format, age > 0
- Relationship: Required when dependent added

### Step 2 - Income (WizardStep2Income)

**File:** `wizard-step-2-income.tsx` (~200 LOC)

**Collects:**

Income category checkboxes:
- Employment (W2, 1099-NEC, Salary)
- Investment (Dividends, Interest, Capital Gains)
- Self-Employment (Business, Rental, Farming)
- Other (Social Security, Pension, Gambling)

**Features:**
- Single-select or multi-select per UI design
- Compact checkbox layout (2-col responsive grid)
- Vietnamese labels + descriptions
- Each checked item sets `intakeAnswers[key] = true`
- Subtotal counter (X of Y selected)

**Integration:**
- Data stored as boolean flags in IntakeAnswers
- Later steps use these to gate document requirements (via checklist)

### Step 3 - Deductions (WizardStep3Deductions)

**File:** `wizard-step-3-deductions.tsx` (~180 LOC)

**Collects:**

Deduction category checkboxes:
- Standard vs Itemized (radio)
- Specific deductions if itemizing:
  - Mortgage Interest, Property Tax, Charitable
  - Medical Expenses, Student Loan Interest
  - Business Expenses, Other

**Features:**
- Toggle between Standard/Itemized (radio group)
- Show detail checkboxes only if Itemized selected
- Same layout as Income step
- Vietnamese labels

**Validation:**
- At least Standard OR Itemized selected
- If Itemized, at least one deduction checked

### Step 4 - Review (WizardStep4Review)

**File:** `wizard-step-4-review.tsx` (~300 LOC)

**Collects:**

**Banking Information:**
- Bank Name, Routing Number, Account Number, Account Type (Checking/Savings)

**Summary Display:**
- Taxpayer name + SSN (masked)
- Filing status + dependent count
- Income sources selected (checkmarks)
- Deduction method + breakdown
- Bank routing/account (masked for routing)

**Features:**
- Read-only display of steps 1-3 data
- Edit buttons link back to specific steps
- Confirmation checkbox: "Information is correct"
- Submit button (enabled when confirmation = true)
- Error summary if validation failed

**Validation:**
- Bank routing number: 9 digits (ABA format)
- Account number: 8-17 digits
- Account type selected
- Confirmation checkbox required

### DependentGrid (Repeater Component)

**File:** `dependent-grid.tsx` (~250 LOC)

**Props:**
```typescript
interface DependentGridProps {
  dependents: Dependent[]
  onAdd: () => void
  onRemove: (index: number) => void
  onChange: (index: number, field: string, value: string) => void
  errors?: Record<number, Record<string, string>>
}

interface Dependent {
  name: string
  ssn: string
  dob: string
  relationship: string
}
```

**Features:**
- Table layout: Name | SSN | DOB | Relationship | Actions
- Add/Remove buttons per row
- Field-level validation errors
- Max 15 dependents (validation)
- Responsive: Stack on mobile
- SSN field uses `formatSSNInput()` helper

**Styling:**
- Striped rows (alt row bg-gray-50)
- Hover highlight on actionable rows
- Delete icon with confirmation tooltip

### WizardConstants (Configuration - NEW)

**File:** `wizard-constants.ts` (~100 LOC)

**Exports:**

**Step Labels:**
```typescript
export const WIZARD_STEPS = [
  'Thông tin cá nhân',    // Step 1
  'Nguồn thu nhập',       // Step 2
  'Khoản khấu trừ',       // Step 3
  'Xem lại & Gửi'         // Step 4
]

export const TOTAL_STEPS = 4
```

**Category Options:**

```typescript
export const INCOME_CATEGORIES = [
  { id: 'has_w2', label: 'W-2 (Lương)', description: 'Lương từ người sử dụng' },
  { id: 'has_1099nec', label: '1099-NEC (Freelance)', description: 'Thu nhập độc lập' },
  // ... more
]

export const DEDUCTION_CATEGORIES = [
  { id: 'mortgage_interest', label: 'Lãi suất thế chấp' },
  { id: 'property_tax', label: 'Thuế tài sản' },
  // ... more
]
```

**Validation Rules:**

```typescript
export const VALIDATION_RULES = {
  SSN_REGEX: /^\d{9}$/,
  ROUTING_NUMBER_REGEX: /^\d{9}$/,
  ACCOUNT_NUMBER_REGEX: /^\d{8,17}$/,
  DOB_FORMAT: 'YYYY-MM-DD',
  MAX_DEPENDENTS: 15
}
```

**Mask Patterns:**

```typescript
export const MASKING = {
  SSN: (ssn: string) => `***-**-${ssn.slice(-4)}`,
  ROUTING: (routing: string) => `***-***-${routing.slice(-4)}`,
  ACCOUNT: (account: string) => `****${account.slice(-4)}`
}
```

### useCategoryToggle Hook (Shared Logic - NEW)

**File:** `use-category-toggle.ts` (~100 LOC)

**Purpose:** Encapsulate checkbox toggle logic for income/deduction steps

**Hook Signature:**
```typescript
export function useCategoryToggle(
  initialState: Record<string, boolean>
) {
  const [state, setState] = useState(initialState)

  const toggle = (categoryId: string, value?: boolean) => {
    setState(prev => ({
      ...prev,
      [categoryId]: value !== undefined ? value : !prev[categoryId]
    }))
  }

  const isChecked = (categoryId: string) => state[categoryId] || false

  const count = Object.values(state).filter(Boolean).length

  return { state, toggle, isChecked, count }
}
```

**Usage Example:**
```typescript
const { state, toggle, isChecked, count } = useCategoryToggle({
  has_w2: false,
  has_1099nec: false
})

// In JSX:
<input
  type="checkbox"
  checked={isChecked('has_w2')}
  onChange={(e) => toggle('has_w2', e.target.checked)}
/>
```

## Crypto Utilities Update

**File:** `apps/workspace/src/lib/crypto.ts` (Enhanced)

**New Feature:** XSS Sanitization in maskSSN

```typescript
export function maskSSN(ssn: string): string {
  // Sanitize input to prevent XSS
  const sanitized = sanitizeTextInput(ssn, 11) // Max 11 chars (***-**-1234)

  // Validate format before masking
  if (!sanitized.match(/^\d{9}$/)) {
    return 'Invalid SSN'
  }

  return `***-**-${sanitized.slice(-4)}`
}
```

**Security:** XSS prevention on display values using DOMPurify equivalent

## State Management Pattern

### Form Data Shape

```typescript
interface IntakeAnswers {
  // Step 1 - Identity
  taxpayerSSN: string
  taxpayerDOB: string
  taxpayerOccupation: string
  taxpayerDLNumber: string
  taxpayerDLIssueDate: string
  taxpayerDLExpDate: string
  taxpayerDLState: string
  taxpayerIPPIN: string

  spouseSSN?: string
  spouseDOB?: string
  // ... other spouse fields

  dependents?: Array<{
    name: string
    ssn: string
    dob: string
    relationship: string
  }>

  // Step 2 - Income
  has_w2?: boolean
  has_1099nec?: boolean
  has_1099div?: boolean
  // ... more income flags

  // Step 3 - Deductions
  deductionMethod?: 'STANDARD' | 'ITEMIZED'
  mortgage_interest?: boolean
  property_tax?: boolean
  // ... more deduction flags

  // Step 4 - Review
  bankName?: string
  bankRoutingNumber?: string
  bankAccountNumber?: string
  bankAccountType?: 'CHECKING' | 'SAVINGS'

  [key: string]: any // Allow custom fields
}
```

## Validation Flow

1. **Client-side:** React form validation per step
2. **Step advancement:** `handleNextStep()` validates current step only
3. **Backend:** `updateProfile()` endpoint validates full IntakeAnswers schema
4. **Error display:** Toast + inline field errors

**Validation Libraries:**
- `zod` for schema validation (@ella/shared)
- Custom regex patterns in `wizard-constants.ts`
- Crypto utilities for SSN validation

## Integration with API

**Endpoint:** `PATCH /clients/:id/profile`

**Request:**
```typescript
interface UpdateProfileInput {
  intakeAnswers: Record<string, any>
}
```

**Response:**
```typescript
interface UpdateProfileResponse {
  profile: ClientProfile
  checklistRefreshed: boolean
  cascadeCleanup: {
    triggeredBy: string[]
  }
}
```

**Behavior:**
- Backend saves intakeAnswers JSON to database
- Auto-encrypts SSN fields (via crypto service)
- Auto-refreshes checklist based on new answers
- Triggers cascade cleanup (deletes dependent answers if condition fails)

## Testing

**Files:** `wizard-*.test.ts` (to be implemented in Phase 03)

**Coverage Plan:**
- WizardContainer: Step navigation, state accumulation, validation, submit
- Step components: Field validation, conditional rendering, error display
- DependentGrid: Add/remove rows, validation per row, max count
- useCategoryToggle: Toggle state, count logic
- Integration: Full wizard flow (step 1→4)

## Performance Optimizations

1. **Memoization:** `React.memo()` on step components (prevent re-render on parent state change)
2. **Code Splitting:** Lazy-load step components via dynamic import
3. **SSN Masking:** Client-side only (no re-validation per keystroke)
4. **DependentGrid:** useMemo for dependent list rendering

## Accessibility Features

- **ARIA Labels:** All form fields labeled
- **Keyboard Navigation:** Tab order, Enter/Escape keys
- **Error Messages:** Screen reader friendly (role="alert")
- **Progress Indicator:** Semantic structure (ol > li)
- **Stepback:** Optional prev button for navigation

## Vietnamese Localization

All labels, descriptions, placeholders, and error messages in Vietnamese:
- Step labels: Thông tin cá nhân, Nguồn thu nhập, etc.
- Field labels: Họ tên, Ngày sinh, etc.
- Error messages: "Vui lòng nhập SSN hợp lệ", etc.
- Buttons: Tiếp theo, Quay lại, Hoàn thành

## Next Steps

1. **Unit Tests (Phase 03):** Add 20+ tests for step components
2. **Integration Tests:** Full wizard flow validation
3. **E2E Tests:** Multi-step form completion scenarios
4. **Accessibility Audit:** WCAG 2.1 AA compliance review
5. **Performance Profiling:** Measure step render times

---

**Last Updated:** 2026-01-22
**Architecture Version:** 9.0.0 (Phase 2 Intake Wizard - 10 components, 4-step flow, dependent repeater, category toggles, crypto utilities)
