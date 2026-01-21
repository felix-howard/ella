# Phase 2: Checklist & Questionnaire Redesign

**Status:** In Progress (Phase 2.0 Questionnaire)
**Date:** 2026-01-19
**Branch:** feature/more-enhancement
**Focus:** Dynamic intake questionnaire with multi-section UI and flexible API binding

---

## Overview

Phase 2 (Questionnaire) extends the client intake workflow by replacing static forms with a dynamic, questionnaire-driven system. Clients answer contextual questions during initial intake, stored in a flexible `intakeAnswers` JSON field. Questions are fetched from the API based on tax types selected, organized by semantic sections (client status, income, dependents, etc), and conditionally displayed based on previous answers.

## Core Features

### 1. Intake Questionnaire System (NEW - 2026-01-19)

**Purpose:** Capture comprehensive client information dynamically during new client creation

**Components:**

#### IntakeQuestion Component
**File:** `apps/workspace/src/components/clients/intake-question.tsx`

**Purpose:** Render individual question input based on field type with built-in XSS protection

**Field Types Supported:**
- `TEXT` - Free text input (max 500 chars, sanitized)
- `NUMBER` - Integer input with +/- buttons (bounds: 0-99, clamped)
- `BOOLEAN` - Toggle/checkbox field
- `SELECT` - Dropdown with predefined options (JSON parsed)

**Props:**
```typescript
interface IntakeQuestionProps {
  questionKey: string         // Unique identifier (e.g., "has_spouse")
  label: string              // Display label (Vietnamese)
  hint?: string | null       // Help text with icon
  fieldType: FieldType       // TEXT | NUMBER | BOOLEAN | SELECT
  options?: Array            // For SELECT only: [{value, label}, ...]
  value: unknown             // Current answer value
  onChange: (key, value) => void  // Update handler
  condition?: {              // Conditional visibility
    key: string              // Parent field key
    value: unknown           // Required parent value
  }
  answers: Record<string, unknown>  // All answers for condition evaluation
}
```

**Security Features:**
- XSS Sanitization: Text inputs stripped of HTML tags via `sanitizeTextInput()`
- Max 500 char limit on TEXT fields
- Number bounds validation (0-99) with clamping

**Conditional Logic:**
- Questions hidden if their condition is not met
- Parent answer must match condition value to display
- Example: "Do you have dependents?" → only show dependent details if answer = true

**Accessibility:**
- Proper ARIA labels (aria-pressed, aria-label)
- Tab navigation for toggles
- Focus rings on inputs
- Help icons with aria-hidden

#### IntakeSection Component
**File:** `apps/workspace/src/components/clients/intake-section.tsx`

**Purpose:** Collapsible grouping of related questions for better UX in long forms

**Props:**
```typescript
interface IntakeSectionProps {
  title: string              // Section title (Vietnamese)
  description?: string       // Optional subtitle
  children: React.ReactNode  // Questions to group
  defaultOpen?: boolean      // Initial expanded state
}
```

**Features:**
- Smooth collapse/expand animation (chevron rotation)
- Configurable default open state
- Semantic grouping (income, dependents, deductions, etc)
- Focus management via aria-expanded

#### MultiSectionIntakeForm Component
**File:** `apps/workspace/src/components/clients/multi-section-intake-form.tsx`

**Purpose:** Main form orchestrator - fetches questions from API, groups by section, manages state

**Props:**
```typescript
interface MultiSectionIntakeFormProps {
  taxTypes: TaxType[]                          // Selected tax return types
  answers: Record<string, unknown>             // Current form state
  onChange: (answers: Record<string, unknown>) => void  // Update handler
}
```

**Features:**
- **API Fetching:** Calls `api.getIntakeQuestions(taxTypes)` on mount or tax type change
- **Dynamic Grouping:** Groups questions by section from API response
- **Sorting:** Within-section sorting via `sortOrder` field
- **Conditional Visibility:** Filters visible questions based on current answers
- **Dependent Clearing:** When parent answer = false, clears child question values
- **Parsing:** Handles JSON options and conditions from API strings

**Section Configuration (16 categories):**

| Section | Title | Default Open |
|---------|-------|--------------|
| tax_info | Thông tin thuế | true |
| client_status | Thông tin khách hàng | true |
| identity | Nhận dạng | false |
| life_changes | Thay đổi trong năm | false |
| income | Nguồn thu nhập | true |
| dependents | Người phụ thuộc | false |
| health | Bảo hiểm sức khỏe | false |
| deductions | Khấu trừ & tín dụng | false |
| credits | Tín dụng thuế | false |
| foreign | Thu nhập nước ngoài | false |
| business | Thông tin doanh nghiệp | false |
| entity_info | Thông tin pháp nhân | false |
| ownership | Cấu trúc sở hữu | false |
| expenses | Chi phí kinh doanh | false |
| assets | Tài sản | false |
| state | Thuế tiểu bang | false |

**Loading States:**
- Spinner shown while fetching questions
- Empty state with message if no questions found
- Error handling for parse failures (logged, not thrown)

### 2. Backend Questionnaire API

**Endpoint:** `GET /clients/intake-questions` (implemented via api-client)

**Query Parameters:**
```typescript
taxTypes: TaxType[]  // E.g., ["1040", "Schedule-C"]
```

**Response Format:**
```typescript
interface IntakeQuestionsResponse {
  data: IntakeQuestion[]
}

interface IntakeQuestion {
  questionKey: string           // Unique ID
  labelVi: string              // Vietnamese label
  hintVi?: string | null       // Help text
  fieldType: FieldType          // TEXT | NUMBER | BOOLEAN | SELECT
  section: string               // Grouping category
  sortOrder: number             // Order within section
  options?: string | null       // JSON: [{"value": "...", "label": "..."}, ...]
  condition?: string | null     // JSON: {"key": "fieldKey", "value": expectedValue}
}
```

**Implementation:**
- Method: `api.getIntakeQuestions(taxTypes)` in api-client.ts
- Caches via React Query using `['intake-questions', taxTypes]` key
- Enabled only when taxTypes.length > 0

### 3. Client Creation with Intake Answers

**Updated Endpoint:** `POST /clients` (apps/api/src/routes/clients/index.ts)

**Request Body Enhancement:**
```typescript
interface CreateClientInput {
  name: string
  phone: string
  email: string
  profile: {
    taxTypes?: TaxType[]
    intakeAnswers?: Record<string, boolean | number | string>
  }
}
```

**Backend Validation (Zod):**
```typescript
intakeAnswers: z.record(
  z.union([z.boolean(), z.number(), z.string()])
)
  .max(200, "Too many answer keys")  // Max 200 fields
  .optional()
```

**Per-Answer Constraint:**
- String values: Max 500 characters (enforced by frontend sanitization)
- Number values: 0-99 range (enforced by frontend clamping)
- Boolean: true/false only

**Storage:**
- Stored in `ClientProfile.intakeAnswers` JSON field
- Flexible schema - any key-value pairs allowed
- Returned in GET /clients/:id response

### 4. Frontend Integration in Client Onboarding

**File:** `apps/workspace/src/routes/clients/new.tsx` (updated)

**ProfileStep Changes:**
- **Tax Type Selection:** Choose applicable tax return types (W-2, 1099, Schedule-C, etc)
- **Questionnaire Display:** After tax types selected, show MultiSectionIntakeForm
- **Progressive Disclosure:** Questions appear based on selections
- **Local State:** Answers accumulated in component state
- **Submission:** Include intakeAnswers in POST /clients payload

**UX Flow:**
```
1. Enter basic info (name, phone, email)
2. Select tax return types (tax_info section)
3. See relevant questions grouped by section
4. Answer questions with conditional logic
5. Submit creates client with intakeAnswers
```

## Database Schema

### ClientProfile Enhancement
```prisma
model ClientProfile {
  id              String
  clientId        String
  taxTypes        String[]        // E.g., ["1040", "Schedule-C"]
  intakeAnswers   Json            // Flexible intake Q&A storage
  // ... other fields ...
}
```

**JSON Structure Example:**
```json
{
  "has_spouse": true,
  "spouse_name": "Jane Doe",
  "dependents_count": 2,
  "has_home_office": false,
  "business_revenue": 150000,
  "business_type": "consulting",
  "charitable_donations": 5000
}
```

## API Client Updates

**File:** `apps/workspace/src/lib/api-client.ts`

**New Methods:**
```typescript
getIntakeQuestions: (taxTypes: TaxType[]) =>
  Promise<{ data: IntakeQuestion[] }>
```

**New Types:**
```typescript
type FieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT'

interface IntakeQuestion {
  questionKey: string
  labelVi: string
  hintVi?: string | null
  fieldType: FieldType
  section: string
  sortOrder: number
  options?: string | null
  condition?: string | null
}

interface CreateClientInput {
  // ... existing fields ...
  profile: {
    taxTypes?: TaxType[]
    intakeAnswers?: Record<string, boolean | number | string>
  }
}
```

## Validation Rules

### Frontend
1. **Text:** Max 500 chars, no HTML tags
2. **Number:** 0-99 range, integer only
3. **Boolean:** true/false
4. **Select:** Value must be in options list

### Backend
1. **Total Keys:** Max 200 answer fields
2. **Per-String:** Max 500 characters (trust frontend)
3. **Per-Number:** Reasonable bounds (0-99 assumed)
4. **Type Matching:** Must match fieldType from API schema

## Error Handling

### Frontend
- **API Fetch Error:** Show error state with message
- **JSON Parse Error:** Log to console, render as empty array
- **Missing Question Data:** Show empty state message
- **Condition Parse Error:** Log warning, treat as no condition

### Backend
- **Invalid JSON:** 400 Bad Request with schema error
- **Exceeds Limits:** 400 Bad Request (too many keys)
- **Type Mismatch:** 400 Bad Request (wrong type for field)

## Security Considerations

### XSS Prevention
- HTML tag stripping on TEXT inputs via regex
- No innerHTML or dangerouslySetInnerHTML used
- Labels/hints from API are displayed via .textContent equivalent

### Data Validation
- Zod schema enforces type safety
- Max 200 answer keys prevents object pollution
- 500 char limit per string prevents storage bloat

### Privacy
- Intake answers stored in PostgreSQL (encrypted in transit via HTTPS)
- No PII in intakeAnswers except user-provided
- Treated same as ClientProfile (backup/audit policies apply)

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Fetch questions | 50-200ms | API call + React Query |
| Parse JSON options | <5ms | Cached per question |
| Render form (16 sections) | 100-200ms | Depends on condition logic |
| Submit client + answers | 200-500ms | POST /clients + payload |

**Optimizations:**
- React Query caching: questions only fetched once per tax type combo
- Memoized section grouping and ordering
- Conditional rendering skips hidden questions

## Testing Checklist

- [ ] Fetch questions for valid tax types
- [ ] Render TEXT, NUMBER, BOOLEAN, SELECT inputs correctly
- [ ] XSS: HTML tags stripped from TEXT inputs
- [ ] Number bounds: Clamped to 0-99
- [ ] Conditional visibility: Hide/show based on condition
- [ ] Dependent clearing: Child cleared when parent = false
- [ ] JSON parsing: Handle malformed options/conditions gracefully
- [ ] Section grouping: Questions sorted by section and sortOrder
- [ ] Form submission: intakeAnswers included in POST payload
- [ ] Backend validation: Rejects >200 keys or invalid types
- [ ] Accessibility: Tab navigation, ARIA labels work
- [ ] Vietnamese UI: Labels and help text display correctly

## Deployment Notes

**Database:**
- No migration required - ClientProfile.intakeAnswers already exists (JSON type)
- Optional field - backward compatible with existing clients

**API Changes:**
- New endpoint: `GET /clients/intake-questions` (query param: taxTypes)
- Updated: `POST /clients` now accepts intakeAnswers

**Frontend:**
- New components deployed to workspace app
- No breaking changes to existing flows

**Environment Variables:**
- None new in Phase 2 Questionnaire

## Future Enhancements

### Phase 2.1 Questionnaire Advanced
- Validation rules per question (regex, min/max values)
- Dependent field population (auto-fill based on answers)
- Question branching (A/B questions based on profile)
- Multi-language support for question text
- Question versioning (A/B testing)

### Phase 2.2 Analytics
- Track which questions most commonly answered
- Calculate completion rate by question
- Identify drop-off points in form
- A/B test question ordering

### Phase 2.3 Integration
- Import answers from client portal upload
- Pre-fill from previous years' returns
- Bulk import from spreadsheet
- Sync with external tax software APIs

## Related Documentation

- [Phase 2 - Make It Usable](./phase-2-make-it-usable.md) - Original core workflow
- [Phase 2.1 - AI Services](./phase-2.1-ai-services.md) - AI document processing
- [Phase 2.2 - Dynamic Checklist](./phase-2.2-dynamic-checklist-system.md) - Atomic transactions
- [System Architecture](./system-architecture.md) - Full API design
- [Code Standards](./code-standards.md) - Implementation patterns

---

**Last Updated:** 2026-01-19
**Phase Status:** Phase 2.0 Questionnaire implementation
**Next Phase:** Phase 2.1 - Advanced questionnaire with validation rules & branching
