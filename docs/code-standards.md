# Code Standards

Ella follows unified coding standards across all packages to ensure maintainability and consistency.

## TypeScript Standards

**Language Version:** TypeScript 5.7.3+

**Compiler Strict Mode:**

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Naming Conventions:**

- `camelCase` - Variables, functions, properties
- `PascalCase` - Classes, types, interfaces, components
- `UPPER_SNAKE_CASE` - Constants & environment variables
- `kebab-case` - File names (except components: PascalCase)

**Module System:**

- ES modules (`type: "module"` in package.json)
- Tree-shakeable exports in public APIs

## Package Structure

**Standard Layout:**

```
packages/{name}/
├── src/
│   ├── index.ts          # Public exports
│   ├── generated/        # Auto-generated (Prisma)
│   └── {feature}/
├── package.json          # Workspace exports
├── tsconfig.json         # Extends root config
└── {framework-config}    # Config files (prisma.config.ts, components.json)
```

**package.json Exports:**

```json
{
  "name": "@ella/{name}",
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  }
}
```

## Database (@ella/db)

**Schema Language:** Prisma (prisma/schema.prisma)

**Naming Convention:**

- Model names: `PascalCase` (e.g., `User`, `Document`)
- Field names: `camelCase` (e.g., `createdAt`, `isActive`)
- Relations: plural for arrays (e.g., `documents: Document[]`)

**Best Practices:**

- Always include `id`, `createdAt`, `updatedAt` fields
- Use `@unique` for lookups, `@db.String` for constraints
- Migrations versioned via `prisma/migrations/`
- Generated client output to `src/generated/` (git-ignored)

**Client Pattern:**

```typescript
// src/client.ts - Singleton pattern for dev safety
import { PrismaClient } from './generated'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
```

## Condition Types & Evaluation (@ella/shared - Phase 01)

**Location:** `packages/shared/src/types/condition.ts` + `apps/api/src/services/checklist-generator.ts`

**Three Condition Formats:**

```typescript
// 1. Legacy flat (implicit AND)
{ hasW2: true, hasSelfEmployment: true }

// 2. Simple with optional operator
{ key: 'foreignBalance', value: 10000, operator: '>' }

// 3. Compound AND/OR (nested)
{
  type: 'AND',
  conditions: [
    { key: 'hasChildren', value: true },
    { type: 'OR', conditions: [
      { key: 'hasW2', value: true },
      { key: 'hasSelfEmployment', value: true }
    ]}
  ]
}
```

**Type Guards (exported from @ella/shared):**
- `isSimpleCondition(obj)` - Has `key`, `value` (no `type`)
- `isCompoundCondition(obj)` - Has `type: 'AND' | 'OR'` + `conditions[]`
- `isLegacyCondition(obj)` - Plain object (no `key`, no `type`)
- `isValidOperator(op)` - Validates: ===, !==, >, <, >=, <=

**Comparison Operators (for numeric & equality):**
- `===` - Strict equality (default)
- `!==` - Strict inequality
- `>`, `<`, `>=`, `<=` - Numeric comparison (requires both operands number)

**Recursion Limits:**
- Max JSON size: 10KB (DoS protection)
- Max nesting depth: 3 levels (stack overflow prevention)
- Invalid conditions return `false` (skipped)

**Cascade Cleanup Pattern:**
```typescript
// When parent answer toggles false → auto-delete dependent answers
POST /clients/:id/cascade-cleanup
{ changedKey: 'hasChildren', caseId?: 'c...' }

// Returns:
{
  deletedAnswers: ['childAge', 'schoolName'], // From intakeAnswers
  deletedItems: 2 // MISSING checklist items with failed conditions
}
```

## Intake Form Configuration (@ella/workspace - Phase 1 Foundation)

**Location:** `apps/workspace/src/lib/intake-form-config.ts`

**Purpose:** Centralized configuration for all intake form fields, sections, and validation options.

**Core Configuration Objects:**

1. **SECTION_CONFIG** - Vietnamese section titles (18 sections)
   - personal_info, tax_info, identity, client_status, prior_year, life_changes, income, dependents, health, deductions, credits, foreign, business, filing, bank, entity_info, ownership, expenses, assets, state

2. **SECTION_ORDER** - Display order array (18 items)

3. **NON_EDITABLE_SECTIONS** - Read-only sections from client/taxCase data
   - personal_info, tax_info (populated from database, not editable)

4. **FIELD_CONFIG** - 95+ field definitions with metadata
   - Fields organized by section
   - Each field has: label (Vietnamese), section, format type, optional options[]
   - Supported format types: text, number, currency, boolean, select, ssn, date

5. **US_STATES_OPTIONS** - 51-item array (50 states + DC) with value/label pairs

6. **RELATIONSHIP_OPTIONS** - Dependent relationship types with Vietnamese labels
   - SON, DAUGHTER, STEPSON, STEPDAUGHTER, FOSTER_CHILD, GRANDCHILD, NIECE_NEPHEW, SIBLING, PARENT, OTHER

7. **SELECT_LABELS** - Lookup tables for select field value→label mapping

**Field Categories (95+ total):**

| Category | Fields | Notes |
|----------|--------|-------|
| Identity - Taxpayer | 8 | SSN, DOB, occupation, driver's license (DL#, issue, exp, state), IP PIN |
| Identity - Spouse | 8 | Conditional on MFJ filing status (mirrors taxpayer) |
| Identity - Dependents | 1 | dependentCount counter |
| Bank Info | 1 | refundAccountType (CHECKING/SAVINGS) |
| Client Status | 3 | isNewClient, hasIrsNotice, hasIdentityTheft |
| Prior Year | 8 | Extension, estimated tax (total + Q1-Q4), prior year AGI |
| Life Changes | 5 | Address, marital, children, home purchase, business start |
| Income - Employment | 7 | W2, W2-G, tips, 1099-NEC, 1099 count, jury duty |
| Income - Self Employment | 1 | hasSelfEmployment |
| Income - Banking & Investments | 3 | Bank accounts, investments, crypto |
| Income - Retirement & Benefits | 4 | Retirement, Social Security, unemployment, alimony |
| Income - Rental & K-1 | 6 | Rental property details (count, months rented, personal use days), K-1 count |
| Home Sale | 4 | Gross proceeds, gain, months lived, home office (sqft, method) |
| Dependents | 8 | Kids <17 (count), CTC count, daycare (amount, provider), kids 17-24, other |
| Health Insurance | 2 | Marketplace coverage, HSA |
| Deductions | 8 | Mortgage, HELOC purpose, property tax, charitable, medical (mileage), student loan, educator, casualty |
| Credits | 5 | Energy, EV, adoption, R&D |
| Foreign | 7 | Foreign accounts (FBAR max), income, tax paid, FEIE residency dates, gifts |
| Business | 6 | Name, EIN, employees, contractors, 1099-K, home office, vehicle |
| Entity Info | 4 | Name, EIN, state of formation, accounting method, return type |
| Ownership | 4 | Ownership changes, non-resident owners, distributions, owner loans |
| Expenses | 10 | Gross receipts, 1099-K/NEC, interest income, rental income, inventory, employees, contractors, officer comp, guaranteed payments, retirement, health insurance |
| Assets | 4 | Purchases, disposals, depreciation, vehicles |
| State Tax | 6 | States with nexus, multistate income, foreign activity, foreign owners, shareholder basis, partner capital method |
| Filing | 3 | Delivery preference, follow-up notes, refund account (routing) |

**Format Type Mapping (formatToFieldType):**
```
boolean → BOOLEAN
currency → CURRENCY
number → NUMBER
select → SELECT
ssn → TEXT (stored as encrypted)
date → TEXT (stored as ISO string)
text → TEXT (default)
```

**SSN Field Handling:**
- `taxpayerSSN` and `spouseSSN` use format: 'ssn'
- Encrypted server-side (AES-256-GCM) in `encryptSensitiveFields()`
- Masked in UI via `maskSSN()` util from `apps/workspace/src/lib/crypto.ts`
- Frontend validation via `isValidSSN()` (9 digits, valid prefix, etc.)

**Usage in Components:**
- `ClientOverviewSections` - Displays intake answers grouped by section
- `SectionEditModal` - Allows editing fields within a section
- `api.clients.updateProfile()` - Persists changes to backend

## Shared Types & Validation (@ella/shared)

**Zod Schema Patterns:**

```typescript
// Primitive validators
export const emailSchema = z.string().email()
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/)

// Composed validators
export const userSchema = z.object({
  id: z.string().cuid(),
  email: emailSchema,
  phone: phoneSchema.optional(),
})

// Type inference
export type User = z.infer<typeof userSchema>
```

**Export Organization:**

- `/schemas` - Zod validators only
- `/types` - TypeScript types & inferred types
- Default export from index includes all

## Computed Status & Activity Tracking (@ella/shared - Phase 1)

**Location:** `packages/shared/src/utils/computed-status.ts` + `apps/api/src/services/activity-tracker.ts`

### Status Computation

Dynamically calculates `TaxCase` status from document/verification state without database updates.

**Priority Order (highest to lowest):**
1. `FILED` - Case filed with IRS (`isFiled = true`)
2. `REVIEW` - Case under staff review (`isInReview = true`)
3. `ENTRY_COMPLETE` - All documents verified & data entered
4. `READY_FOR_ENTRY` - All documents verified, awaiting data entry
5. `IN_PROGRESS` - Documents received but not all verified
6. `WAITING_DOCS` - Client intake complete, missing documents
7. `INTAKE` - No intake answers yet

**Core Function:**

```typescript
import { computeStatus, type ComputedStatus, type ComputedStatusInput } from '@ella/shared'

const status: ComputedStatus = computeStatus({
  hasIntakeAnswers: true,
  missingDocsCount: 0,
  unverifiedDocsCount: 2,    // DigitalDoc.status != VERIFIED
  pendingEntryCount: 0,      // VERIFIED but entryCompleted = false
  isInReview: false,
  isFiled: false,
})
// → 'IN_PROGRESS'
```

### Stale Activity Detection

Calculates days since last activity for stale case highlighting.

**Function:**

```typescript
import { calculateStaleDays, STALE_THRESHOLD_DAYS } from '@ella/shared'

const staleDays = calculateStaleDays(case.lastActivityAt, 7)
// → 10 (if >= 7 days) or null (if < 7 days)
```

**Usage:**
- Display "stale" badge when `staleDays` is truthy
- Show `Inactive ${staleDays}d` in UI
- Sort client list by `lastActivityAt` to surface stale cases

### Activity Tracking Service

Updates `lastActivityAt` timestamp on `TaxCase` when meaningful activity occurs.

**Function:**

```typescript
import { updateLastActivity } from '../services/activity-tracker'

const updated = await updateLastActivity(caseId)
// Returns: true if successful, false if error (non-blocking)
```

**Call Points:**
- Client uploads document
- Client sends message
- Staff verifies document
- Staff completes data entry
- Staff adds/marks checklist items

**Error Handling:**
```typescript
// Activity tracking is secondary—never block primary operations
const updated = await updateLastActivity(caseId)
if (!updated) {
  console.warn(`Could not track activity for case ${caseId}`)
}
```

### Action Counts Types

Aggregated action counts for client list badges.

```typescript
import type { ActionCounts, ClientWithActions } from '@ella/shared'

interface ActionCounts {
  missingDocs: number            // MISSING checklist items
  toVerify: number               // EXTRACTED documents
  toEnter: number                // VERIFIED but not entered
  staleDays: number | null       // Days inactive (or null)
  hasNewActivity: boolean        // Has unread messages
}

interface ClientWithActions {
  id: string
  name: string
  computedStatus: ComputedStatus | null
  actionCounts: ActionCounts | null
  latestCase: { ... }
}
```

**See Also:** `docs/phase-1-database-backend-actionable-status.md` for complete reference.

## UI Components (@ella/ui)

**Component Structure:**

```typescript
// src/components/{name}.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const buttonVariants = cva('base-styles', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground rounded-full',
      destructive: 'bg-destructive rounded-full',
    },
    size: {
      default: 'h-10 px-5',
      sm: 'h-8 px-4 text-xs',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
)
Button.displayName = 'Button'
export { Button, buttonVariants }
```

**Styling:**

- Tailwind CSS v4 with utility-first approach
- Component variants via `class-variance-authority`
- Class merging via `cn()` utility (clsx + tailwind-merge)
- Global styles in `src/styles.css` with design tokens
- Pill-shaped components (`rounded-full`)

**Design Tokens (Tailwind v4):**

```css
@theme {
  --color-primary: #10B981;
  --color-primary-light: #D1FAE5;
  --color-primary-dark: #059669;
  --color-accent: #F97316;
  --color-error: #EF4444;
  --radius-full: 9999px;
}
```

**shadcn/ui Integration:**

- Components copied from shadcn/ui registry
- Customizations in local codebase
- Config: `components.json`

## Category-Based Grouping Pattern (Phase 02+)

**Use Case:** TieredChecklist, DocumentGrid, or any list component organizing items by category.

**Pattern:**

```typescript
// 1. Define categories with visual metadata
export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  personal: { icon: '👤', color: 'text-purple-600', bgColor: 'bg-purple-500/5', borderColor: 'border-purple-500/20' },
  income: { icon: '💰', color: 'text-emerald-600', bgColor: 'bg-emerald-500/5', borderColor: 'border-emerald-500/20' },
  business: { icon: '🏢', color: 'text-blue-600', bgColor: 'bg-blue-500/5', borderColor: 'border-blue-500/20' },
  other: { icon: '📎', color: 'text-gray-600', bgColor: 'bg-gray-500/5', borderColor: 'border-gray-500/20' },
}

// 2. Grouping helper
function groupItemsByCategory<T>(items: T[], mapFn: (item: T) => CategoryKey): CategoryGroup<T>[] {
  const groups: Record<string, T[]> = {}
  for (const item of items) {
    const category = mapFn(item)
    if (!groups[category]) groups[category] = []
    groups[category].push(item)
  }

  // Return in definition order, skip empty
  return Object.keys(CATEGORY_STYLES)
    .map(key => ({
      key: key as CategoryKey,
      items: groups[key] || []
    }))
    .filter(g => g.items.length > 0)
}

// 3. Section component with collapse/expand
function CategorySection({ category, items }: { category: CategoryKey; items: T[] }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const style = CATEGORY_STYLES[category]

  return (
    <div className={cn('rounded-lg border', style.borderColor)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn('w-full flex items-center gap-2 px-3 py-2.5', style.bgColor)}
      >
        {isExpanded ? <ChevronDown /> : <ChevronRight />}
        <span>{style.icon}</span>
        <span className={cn('font-semibold', style.color)}>Category Label</span>
      </button>
      {isExpanded && (
        <div className="divide-y">
          {items.map(item => <ItemRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}

// 4. Use in main component
const categoryGroups = useMemo(() => groupItemsByCategory(items, item => item.category), [items])

return (
  <div className="space-y-4">
    {categoryGroups.map(group => (
      <CategorySection key={group.key} category={group.key} items={group.items} />
    ))}
  </div>
)
```

**Benefits:**
- Scalable: Add categories by updating CATEGORY_STYLES constant
- Maintainable: Single source of truth for category metadata
- Performant: Grouping memoized, collapse state local to section
- Accessible: Semantic buttons, ARIA labels on actions

**Examples:** TieredChecklist (5 doc categories), DocumentGrid (status categories)

## PDF Converter Service (@ella/api - Phase 01+03)

**Service Organization (Phase 03 updates):**

```
apps/api/src/services/pdf/
├── pdf-converter.ts          # Core conversion logic via poppler
├── index.ts                  # Public exports (added getPopplerStatus)
└── __tests__/
    └── pdf-converter.test.ts # Unit tests (8+ tests)
```

**Poppler Dependency (Phase 03):**
- Uses `pdf-poppler` npm package for PDF → PNG conversion
- Server requires poppler system library: `apt-get install poppler-utils` (Linux) or `brew install poppler` (macOS)
- Health check (`getPopplerStatus()`) validates poppler installation on startup

**Key Patterns:**

```typescript
// 1. Type-safe result wrapper (success + error handling)
export interface PdfConversionResult {
  success: boolean
  pages?: PdfPageImage[]
  totalPages?: number
  error?: string
  errorType?: PdfErrorType
  processingTimeMs?: number
}

// 2. Early validation pattern (fail fast, no side effects)
if (pdfBuffer.length > MAX_PDF_SIZE_BYTES) {
  return {
    success: false,
    error: PDF_ERROR_MESSAGES.TOO_LARGE,
    errorType: 'TOO_LARGE',
    processingTimeMs: Date.now() - startTime,
  }
}

// 3. Magic bytes validation (before expensive processing)
function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < PDF_MAGIC_BYTES.length) return false
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (buffer[i] !== PDF_MAGIC_BYTES[i]) return false
  }
  return true
}

// 4. Error detection pattern (pattern matching on messages)
function isEncryptedPdfError(error: Error): boolean {
  const msg = error.message.toLowerCase()
  return msg.includes('encrypt') || msg.includes('password') || msg.includes('permission')
}

// 5. Cleanup pattern (finally block for resource safety)
try {
  // Main processing
  await pdf.convert(pdfPath, options)
} catch (error) {
  // Error handling
  return handleError(error)
} finally {
  // Always cleanup
  try {
    await fs.rm(tempDir, { recursive: true, force: true })
  } catch {
    console.warn(`Failed to cleanup: ${tempDir}`)
  }
}
```

**Constants & Configuration:**

```typescript
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024  // 20MB hard limit
const MAX_PAGES = 10                          // Memory safety limit
const RENDER_DPI = 200                        // OCR-quality rendering
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]  // "%PDF"
```

## AI Services (@ella/api - Phase 2.1)

**Service Organization:**

```
apps/api/src/services/ai/
├── gemini-client.ts         # Low-level API wrapper
├── document-classifier.ts   # Document type recognition
├── blur-detector.ts         # Image quality assessment
├── ocr-extractor.ts         # Data extraction routing
├── document-pipeline.ts     # Orchestration engine
├── pipeline-types.ts        # Shared interfaces
├── pipeline-helpers.ts      # Database operations
├── prompts/
│   ├── classify.ts          # Multi-class detection
│   ├── blur-check.ts        # Quality assessment
│   └── ocr/
│       ├── w2.ts            # W2 form extraction
│       ├── 1099-int.ts      # 1099-INT extraction
│       ├── 1099-nec.ts      # 1099-NEC extraction
│       ├── ssn-dl.ts        # SSN Card & Driver's License
│       └── index.ts         # OCR router
└── index.ts                 # Public exports
```

**Service Patterns:**

```typescript
// 1. Configuration with env var fallback
import { config } from '../lib/config'

const geminiKey = process.env.GEMINI_API_KEY || ''
export const isGeminiConfigured = !!geminiKey

// 2. Result wrapper pattern (success + error handling)
export interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
  processingTimeMs?: number
}

// 3. Type-safe metadata for database records
export interface ActionMetadata {
  rawImageId: string
  docType?: DocType
  confidence?: number
  errorMessage?: string
  // Type-specific fields per action type
}

// 4. Validation function pattern
export function validateExtractedData(docType: string, data: unknown): boolean {
  switch (docType) {
    case 'W2':
      return validateW2Data(data)
    case 'FORM_1099_NEC':
      return validate1099NecData(data)
    // ...
    default:
      return false
  }
}

// 5. Field labels for i18n
export const FORM_1099_NEC_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Người trả',
  nonemployeeCompensation: 'Thu nhập tự do/Hợp đồng (Box 1)',
  // ...
}
```

**Prompt Engineering Standards:**

Prompts stored as string-returning functions for maintainability.

```typescript
// Pattern: Document-specific extraction prompt
export function get1099NecExtractionPrompt(): string {
  return `You are an expert OCR system...

  Extract the following fields:
  - payerName: Company/person paying [instructions]
  - nonemployeeCompensation: Box 1 amount [instructions]

  Respond in JSON format:
  {
    "payerName": "...",
    "nonemployeeCompensation": 45000.00,
    ...
  }

  Rules:
  1. All monetary values are numbers without $ or commas
  2. Use null for empty/unclear fields, NEVER guess
  3. [form-specific rules]
  `
}

// Pattern: Validation ensures response matches interface
export function validate1099NecData(data: unknown): data is Form1099NecExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  // Check required fields exist (values can be null)
  const requiredFields = ['payerName', 'recipientName', 'recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  return true
}
```

**Error Handling Strategy:**

```typescript
// Distinguish transient vs permanent errors
const isTransient = /rate.?limit|timeout|503|500|502|overloaded/i.test(error.message)

if (isTransient && attempt < maxRetries) {
  // Retry with exponential backoff
  await sleep(delayMs * Math.pow(2, attempt))
} else {
  // Permanent error → create AI_FAILED action
  await createAction({
    type: 'AI_FAILED',
    priority: 'HIGH',
    title: 'Lỗi xử lý AI',
    description: errorMessage,
    metadata: { rawImageId }
  })
}
```

**Testing Patterns:**

```typescript
// Mock Gemini responses for unit tests
jest.mock('../services/ai/gemini-client', () => ({
  analyzeImage: jest.fn().mockResolvedValue({
    success: true,
    data: {
      docType: 'W2',
      confidence: 0.95
    }
  })
}))

// Integration test: full pipeline
it('processes W2 image end-to-end', async () => {
  const result = await processImage(rawImageId, buffer, 'image/jpeg')

  expect(result.success).toBe(true)
  expect(result.classification?.docType).toBe('W2')

  // Verify database state
  const rawImage = await prisma.rawImage.findUnique({ where: { id: rawImageId } })
  expect(rawImage?.classifiedType).toBe('W2')
})
```

**Configuration Constants:**

```typescript
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  maxRetries: 2,              // Transient error retries
  retryDelayMs: 1000,         // 1s base, then exponential
  batchConcurrency: 3,        // Parallel image processing
}

// Confidence thresholds
const CONFIDENCE_HIGH = 0.85        // Auto-accept OCR
const CONFIDENCE_VERIFY = 0.7       // Create VERIFY_DOCS action
const BLUR_THRESHOLD = 70           // Request resend
```

## Toast Notifications (@ella/workspace - Phase 4.1)

**Store Organization:**

```
apps/workspace/src/
├── stores/
│   ├── toast-store.ts      # Toast state management
│   └── ui-store.ts         # UI state (sidebar, view mode)
└── components/ui/
    └── toast-container.tsx # Toast rendering
```

**Store Pattern:**

```typescript
// stores/toast-store.ts - Zustand store with auto-dismiss
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

// Track timeouts externally for cleanup on manual dismiss
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = generateToastId()
    const duration = toast.duration ?? 2000

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))

    // Auto-remove with cleanup tracking
    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        toastTimeouts.delete(id)
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
      toastTimeouts.set(id, timeoutId)
    }
  },

  removeToast: (id) => {
    // Clear timeout to prevent memory leak
    const timeoutId = toastTimeouts.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      toastTimeouts.delete(id)
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearToasts: () => {
    toastTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
    toastTimeouts.clear()
    set({ toasts: [] })
  },
}))

// Convenience functions
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'success', duration }),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'error', duration }),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'info', duration }),
}
```

**UI Component Pattern:**

```typescript
// components/ui/toast-container.tsx
import { useToastStore, type ToastType } from '../../stores/toast-store'

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-success text-white',
  error: 'bg-error text-white',
  info: 'bg-primary text-white',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg',
            'animate-in fade-in slide-in-from-bottom-4 duration-200',
            TOAST_STYLES[toast.type]
          )}
          role="alert"
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-0.5 hover:bg-white/20 rounded-full"
            aria-label="Đóng"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
```

**Integration Pattern:**

```typescript
// routes/__root.tsx
import { ToastContainer } from '@components/ui/toast-container'

function RootLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />
      <Outlet />
      <ToastContainer />
    </div>
  )
}
```

**Usage Pattern:**

```typescript
import { toast } from '@stores/toast-store'

// Success notification
toast.success('Đã copy!')

// Error notification
toast.error('Không thể copy', 3000)

// Info notification
toast.info('Thông tin lưu')
```

**Key Features:**

1. **Memory Safety:** Timeout cleanup map prevents leaks on manual dismiss
2. **Auto-Dismiss:** Configurable duration with automatic removal
3. **Stacking:** Multiple toasts stack vertically at bottom-center
4. **Animations:** Slide-in from bottom + fade-in
5. **Vietnamese-First:** All messages in Vietnamese

## Clipboard Hook (@ella/workspace - Phase 4.1)

**Hook Organization:**

```
apps/workspace/src/hooks/
├── use-clipboard.ts  # Clipboard operations
└── index.ts          # Barrel export
```

**Hook Pattern:**

```typescript
// hooks/use-clipboard.ts
import { useCallback } from 'react'
import { toast } from '../stores/toast-store'

interface UseClipboardOptions {
  successMessage?: string  // Default: "Đã copy!"
  errorMessage?: string    // Default: "Không thể copy"
  onSuccess?: () => void
  onError?: (error: Error) => void
}

interface UseClipboardReturn {
  copy: (text: string) => Promise<boolean>
  copyFormatted: (data: Record<string, unknown>) => Promise<boolean>
}

// Modern Clipboard API + fallback for older browsers
async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern API first (requires secure context)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (clipboardError) {
      console.warn('Clipboard API failed, trying fallback:', clipboardError)
      // Fall through to legacy method
    }
  }

  // Fallback: execCommand for older browsers
  let textArea: HTMLTextAreaElement | null = null
  try {
    textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    const success = document.execCommand('copy')
    if (!success) throw new Error('execCommand copy failed')
    return true
  } catch (fallbackError) {
    console.error('Clipboard fallback failed:', fallbackError)
    return false
  } finally {
    // Always clean up textarea
    if (textArea && document.body.contains(textArea)) {
      document.body.removeChild(textArea)
    }
  }
}

export function useClipboard(
  options: UseClipboardOptions = {}
): UseClipboardReturn {
  const {
    successMessage = 'Đã copy!',
    errorMessage = 'Không thể copy',
    onSuccess,
    onError,
  } = options

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text) {
        toast.error('Không có dữ liệu để copy')
        return false
      }

      const success = await copyToClipboard(text)

      if (success) {
        toast.success(successMessage)
        onSuccess?.()
      } else {
        toast.error(errorMessage)
        onError?.(new Error('Clipboard copy failed'))
      }

      return success
    },
    [successMessage, errorMessage, onSuccess, onError]
  )

  const copyFormatted = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      const lines = Object.entries(data)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${value}`)

      if (lines.length === 0) {
        toast.error('Không có dữ liệu để copy')
        return false
      }

      return copy(lines.join('\n'))
    },
    [copy]
  )

  return { copy, copyFormatted }
}
```

**Usage Pattern:**

```typescript
import { useClipboard } from '@hooks'

function DataEntryPage() {
  const { copy, copyFormatted } = useClipboard({
    successMessage: 'Sao chép thành công',
    onSuccess: () => trackEvent('data_copied'),
  })

  // Copy single field
  const handleCopyField = async (value: string) => {
    await copy(value)
  }

  // Copy all fields with labels
  const handleCopyAll = async () => {
    await copyFormatted({
      'SSN': '123-45-6789',
      'Tên': 'John Doe',
      'Ngày sinh': '1990-01-01',
    })
  }

  return (
    <div>
      <button onClick={() => handleCopyField('value')} />
      <button onClick={handleCopyAll} />
    </div>
  )
}
```

**Browser Compatibility:**

| Browser | Support | Method |
|---------|---------|--------|
| Chrome 63+ | ✅ | Clipboard API |
| Firefox 53+ | ✅ | Clipboard API |
| Safari 13.1+ | ✅ | Clipboard API |
| Edge 79+ | ✅ | Clipboard API |
| IE 11 | ✅ | execCommand fallback |
| Legacy Safari | ✅ | execCommand fallback |

**Key Features:**

1. **Secure Context Check:** Modern API only in HTTPS/localhost
2. **Fallback Support:** execCommand for older browsers
3. **Error Handling:** Toast feedback on success/failure
4. **Formatting:** Label:value pairs for bulk data
5. **Memory Safe:** DOM cleanup in finally block

## SMS Services (@ella/api - Phase 3.1)

**Service Organization:**

```
apps/api/src/services/sms/
├── twilio-client.ts         # Low-level Twilio API wrapper
├── message-sender.ts        # High-level SMS sending service
├── webhook-handler.ts       # Incoming message processor
├── templates/
│   ├── welcome.ts           # New client onboarding
│   ├── missing-docs.ts      # Missing docs reminder
│   ├── blurry-resend.ts     # Blurry image request
│   ├── complete.ts          # Completion notification
│   └── index.ts             # Template exports
└── index.ts                 # Public exports
```

**Service Patterns:**

```typescript
// 1. SMS sending with retry logic
export async function sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
  const maxRetries = 2
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const message = await client.messages.create({...})
      return { success: true, sid: message.sid, status: message.status }
    } catch (error) {
      lastError = error as Error
      const errorCode = (error as { code?: number })?.code

      // Non-transient errors: don't retry
      if (errorCode === 21211 || errorCode === 21614 || errorCode === 21408) {
        return { success: false, error: `TWILIO_ERROR_${errorCode}` }
      }

      // Retry on transient failures with exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500 // 500ms → 1s → 2s
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  return { success: false, error: lastError?.message || 'TWILIO_SEND_FAILED' }
}

// 2. Phone number normalization (E.164 format)
export function formatPhoneToE164(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '')

  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = cleaned.substring(1)
    }
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned
    }
  }

  return cleaned
}

// 3. Template-based message generation
export function generateWelcomeMessage(params: WelcomeTemplateParams): string {
  const { clientName, magicLink, taxYear, language } = params

  if (language === 'EN') {
    return `Hello ${clientName},

We created your account to submit documents for ${taxYear}.

Please visit: ${magicLink}

Thank you,
Ella Accounting`
  }

  return `Xin chào ${clientName},

Chúng tôi đã tạo tài khoản cho quý vị để nộp hóa đơn cho năm ${taxYear}.

Vui lòng truy cập: ${magicLink}

Cảm ơn,
Ella Accounting`
}

// 4. Webhook signature validation (timing-safe)
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): SignatureValidationResult {
  if (!config.twilio.authToken) {
    if (config.nodeEnv === 'production') {
      return { valid: false, error: 'TWILIO_NOT_CONFIGURED' }
    }
    return { valid: true }
  }

  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => key + params[key])
    .join('')

  const expectedSignature = crypto
    .createHmac('sha1', config.twilio.authToken)
    .update(url + sortedParams, 'utf8')
    .digest('base64')

  try {
    const sigBuffer = Buffer.from(signature, 'base64')
    const expectedBuffer = Buffer.from(expectedSignature, 'base64')

    if (sigBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: 'INVALID_SIGNATURE' }
    }

    // CRITICAL: Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    return { valid: isValid, error: isValid ? undefined : 'INVALID_SIGNATURE' }
  } catch {
    return { valid: false, error: 'SIGNATURE_COMPARISON_FAILED' }
  }
}

// 5. Message sanitization (prevent XSS, limit length)
function sanitizeMessageContent(content: string): string {
  const maxLength = 1600 // SMS limit
  let sanitized = content.slice(0, maxLength)

  // Remove control characters except \n and \t
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')

  return sanitized.trim()
}

// 6. Client lookup with multiple phone formats
const client = await prisma.client.findFirst({
  where: {
    OR: [
      { phone: fromPhone },        // Exact match
      { phone: e164Phone },        // E.164 format
      { phone: normalizedPhone },  // Digits only
    ],
  },
  include: {
    taxCases: {
      orderBy: { createdAt: 'desc' },
      take: 1,
    },
  },
})
```

**Configuration Constants:**

```typescript
const TWILIO_RETRY_BACKOFF = [500, 1000, 2000]  // ms per attempt
const RATE_LIMIT_WINDOW_MS = 60000               // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60               // per IP per window
const SMS_MAX_LENGTH = 1600                      // Character limit
const TWILIO_NON_TRANSIENT_ERRORS = [
  21211, // Invalid 'To' phone number
  21614, // 'To' number not verified
  21408, // Permission to send SMS not enabled
]
```

**Error Handling Strategy:**

```typescript
// Distinguish transient vs permanent errors
const isTransient = /rate.?limit|timeout|50[0-3]|overloaded/i.test(
  error.message
)

if (isTransient && attempt < maxRetries) {
  // Retry with exponential backoff
  const delay = Math.pow(2, attempt) * baseDelayMs
  await sleep(delay)
} else {
  // Permanent error → return failure
  return {
    success: false,
    error: `TWILIO_ERROR_${error.code || 'UNKNOWN'}`
  }
}
```

## Frontend Application Patterns (@ella/workspace, @ella/portal)

**Directory Structure:**

```
apps/{app}/
├── src/
│   ├── lib/
│   │   ├── api-client.ts    # Centralized HTTP client
│   │   └── constants.ts     # UI labels, colors, navigation
│   ├── stores/
│   │   └── ui-store.ts      # Zustand store (persisted)
│   ├── components/
│   │   ├── layout/          # Sidebar, Header, PageContainer
│   │   └── {feature}/       # Feature-specific components
│   ├── routes/
│   │   ├── __root.tsx       # Root layout
│   │   ├── index.tsx        # Home page
│   │   └── {feature}/       # Feature pages
│   └── main.tsx
├── vite.config.ts
└── tsconfig.json
```

**API Client Pattern:**

```typescript
// lib/api-client.ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const api = {
  clients: {
    list: (params?: { page?: number; search?: string }) =>
      request<PaginatedResponse<Client>>('/clients', { params }),
    get: (id: string) => request<Client>(`/clients/${id}`),
    create: (data: CreateClientInput) =>
      request<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  },
  // ... more endpoints
}
```

**Constants Organization:**

```typescript
// lib/constants.ts
export const DOC_TYPE_LABELS = {
  W2: 'W2 (Thu nhập từ công việc)',
  FORM_1099_NEC: '1099-NEC (Thu nhập tự do)',
  // ... more labels
}

export const CASE_STATUS_LABELS = {
  INTAKE: 'Tiếp nhận',
  WAITING_DOCS: 'Chờ tài liệu',
  // ... more labels
}

export const CASE_STATUS_COLORS = {
  INTAKE: { bg: 'bg-muted', text: 'text-muted-foreground' },
  // ... more colors
}

export const NAV_ITEMS = [
  { path: '/', label: 'Tổng quan', icon: 'LayoutDashboard' },
  // ... more items
]

export const UI_TEXT = {
  loading: 'Đang tải...',
  error: 'Đã có lỗi xảy ra',
  // ... more text
}
```

**State Management (Zustand):**

```typescript
// stores/ui-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  clientViewMode: 'kanban' | 'list'
  setClientViewMode: (mode: 'kanban' | 'list') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      clientViewMode: 'kanban',
      setClientViewMode: (mode) => set({ clientViewMode: mode }),
    }),
    {
      name: 'ella-ui-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        clientViewMode: state.clientViewMode,
      }),
    }
  )
)
```

**Layout Pattern:**

```typescript
// routes/__root.tsx - Root layout with sidebar + header
export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <Header />
        <Outlet />
      </div>
    </ErrorBoundary>
  )
}

// components/layout/page-container.tsx - Content wrapper
export function PageContainer({ children }: { children: ReactNode }) {
  return <main className="ml-[var(--sidebar-width)] p-6">{children}</main>
}
```

**Error Boundary Pattern:**

```typescript
// components/error-boundary.tsx
export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="bg-card rounded-xl p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-error mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-foreground mb-2">Đã có lỗi xảy ra</h1>
            <Button onClick={this.handleRetry}>Thử lại</Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Localization Pattern:**

- All UI text in `constants.ts` with Vietnamese-first approach
- Use `CASE_STATUS_LABELS[status]` instead of hardcoded strings
- Support EN fallback via additional constants if needed

## Git Workflow & Commits

**Branch Naming:**

```
feature/{description}   # New features
fix/{description}       # Bug fixes
hotfix/{description}    # Urgent fixes
refactor/{description}  # Code restructuring
docs/{description}      # Documentation
chore/{description}     # Maintenance
```

**Commit Format:**

```
[Type] | Description

[Add]      - New feature
[Update]   - Enhancement
[Fix]      - Bug fix
[Remove]   - Code removal
[Refactor] - Restructuring
[Docs]     - Documentation
[Chore]    - Maintenance
```

**Example:**

```
[Add] | Database models for User and Document
[Fix] | Prisma client singleton pattern
[Update] | Enhance pagination schema with cursor support
```

## Testing Standards

**Type Checking:**

```bash
pnpm type-check  # Run tsc across all packages
```

**Database Testing:**

- Use Prisma Studio for manual verification
- Migrations tested before pushing to main

## Environment Variables

**Template:** `.env.example`

- All variables prefixed: `DATABASE_URL`, `API_KEY`, etc.
- Never commit `.env` files
- Load via standard Node.js `process.env`

**Current Variables:**

- `DATABASE_URL` - PostgreSQL connection string
- (More added per feature)

## Documentation Standards

**Code Comments:**

- Explain "why", not "what" (code is self-explanatory)
- JSDoc for exported functions/types:

```typescript
/**
 * Validates email format
 * @param email - Email string to validate
 * @returns Validation result
 */
export const validateEmail = (email: string) => emailSchema.parse(email)
```

**Markdown Documentation:**

- Located in `/docs`
- Keep files under 800 lines of code
- Link related docs via relative paths

## Performance & Optimization

**Database:**

- Index frequently queried fields
- Use Prisma `include`/`select` for query optimization
- Pagination via offset/limit or cursor

**Bundling:**

- Tree-shake unused exports
- Lazy load components in apps layer
- Monitor bundle size via Turbo cache

## CI/CD Standards

**Turbo Pipeline (turbo.json):**

- Caching enabled for reproducible builds
- Tasks ordered by dependencies
- Output files tracked for incremental builds

**Commands:**

```bash
turbo run build          # Build all packages
turbo run type-check    # Type check all
turbo run dev           # Development watch mode
```

## Authentication & Authorization (Phase 3)

### Password Hashing Standard

**Use bcrypt with 12 rounds:**

```typescript
import bcrypt from 'bcrypt'

// Hashing (one-way)
const hashed = await bcrypt.hash(password, 12)

// Verification
const isValid = await bcrypt.compare(password, hashed)
```

**Why 12 rounds?**
- Industry standard (~250ms on modern hardware)
- Resistant to GPU attacks
- Configurable in `src/services/auth/index.ts` via `BCRYPT_ROUNDS`

### JWT Token Structure

**Access Token (15m default, configurable):**

```typescript
{
  sub: string         // User ID
  email: string       // User email
  name: string        // User full name (Phase 3)
  role: string        // User role (ADMIN|STAFF|CPA)
  iat: number         // Issued at (unix timestamp)
  exp: number         // Expiry (unix timestamp)
}
```

**Refresh Token (7 days default, configurable):**

- Opaque random token (no claims)
- Hashed with SHA-256 before storage
- Stored in database with expiry & revocation tracking
- Rotated on use (old revoked, new issued)

### Token Rotation Pattern

**Safe refresh token rotation:**

```typescript
// Client: POST /api/auth/refresh with old refreshToken
// Backend flow:
1. Hash provided refresh token
2. Lookup token in database
3. Validate: not expired, not revoked, user active
4. Validate ownership: token.userId === expectedUserId
5. Revoke old token: set revokedAt = now()
6. Issue new refresh token: generate & store in DB
7. Return new accessToken + new refreshToken
8. Client updates stored tokens
```

**Why validate ownership?**
- Prevents token reuse if captured
- Ensures token can't be used with different user ID

### RBAC Middleware Usage

**Protect routes by role:**

```typescript
import { authMiddleware, requireRole, adminOnly, staffOrAdmin } from '../middleware/auth'

// Require authentication only
app.get('/profile', authMiddleware, handler)

// Require specific role
app.get('/admin/users', authMiddleware, adminOnly, handler)

// Multiple roles allowed
app.patch('/cases/:id', authMiddleware, staffOrAdmin, handler)

// Optional: protect route group
app.use('/admin/*', authMiddleware, adminOnly)

// Optional auth (set user if valid, continue without if not)
app.get('/public/data', optionalAuthMiddleware, handler)
```

**Roles:**
- `ADMIN` - Full system access, user management
- `STAFF` - Client & case management
- `CPA` - Finance & tax preparation

**Error Handling:**
- Missing token: 401 "Yêu cầu xác thực"
- Invalid token: 401 "Token không hợp lệ hoặc đã hết hạn"
- Insufficient role: 403 "Không đủ quyền truy cập"

### Token Verification Checklist

**Always verify (in order):**

1. Token signature (JWT signature validation)
2. Token expiry (exp claim vs current time)
3. Required claims: sub, email, role
4. (Refresh tokens only) Token hash match, expiry, revocation status, user active

**Never trust:**
- Expiry claim alone (always check current time)
- JWT claims without signature verification
- Token without source validation

### Configuration Standards

**In `src/lib/config.ts`:**

```typescript
auth: {
  jwtSecret: string         // Validated: min 32 chars in production
  jwtExpiresIn: string      // Format: "15m", "1h", "7d"
  refreshTokenExpiresDays: number
  isConfigured: boolean     // Quick check: JWT_SECRET length >= 32
}
```

**Validation Rules:**
- Production: JWT_SECRET missing/short → throw error
- Development: Auto-use insecure default with console warning
- Expiry parsing: Supports s/m/h/d units (e.g., "15m" = 900 seconds)

### Token Cleanup Maintenance

**Automatic cleanup for production:**

```typescript
// Call this in scheduled job or during off-peak hours
await cleanupExpiredTokens()
// Removes:
// - Refresh tokens with expiresAt < now()
// - Refresh tokens with revokedAt != null
```

---

## Security Best Practices

1. **No Secrets in Code:**
   - Use `.env.example` for documentation
   - Load sensitive data at runtime

2. **Prisma:**
   - Always use parameterized queries (built-in)
   - Validate input via Zod before DB access

3. **API Responses:**
   - Use `apiResponseSchema` wrapper
   - Never expose internal error details
   - Always sanitize user input

4. **Authentication:**
   - Use bcrypt (12 rounds) for passwords
   - Never log tokens or passwords
   - Validate token ownership before rotation
   - Require HTTPS in production

## Dependencies Management

**Version Pinning:**

- Lock file: `pnpm-lock.yaml`
- Update via: `pnpm update`
- Major version bumps reviewed before merge

**Workspace Dependencies:**

- Install from package exports
- Example: `import { prisma } from '@ella/db'`

## Linting & Formatting

**ESLint Configuration** (flat config):

- **Config:** `eslint.config.js` (root)
- **Rule Set:**
  - TypeScript + JavaScript recommended rules
  - React Hooks validation (react-hooks)
  - React Refresh optimization checks
  - Unused variables banned (except `_` prefixed)
  - Consistent type imports required
- **Ignored Paths:** `dist/`, `node_modules/`, `*.gen.ts`, `.claude/skills/`, `**/generated/**`
- **Script:** `pnpm lint:root` (lint root directory), `turbo lint` (all packages)

**Prettier Configuration**:

- **Config:** `.prettierrc`
- **Format:**
  - No semicolons (`"semi": false`)
  - Single quotes (`"singleQuote": true`)
  - Indent: 2 spaces
  - Print width: 100 columns
  - Trailing commas: ES5 style
- **Ignored:** Files listed in `.prettierignore` (node_modules, dist, .turbo, .claude, input-docs, \*.gen.ts, generated/)
- **Scripts:**
  - `pnpm format` - Format all files
  - `pnpm format:check` - Verify formatting

**VS Code Integration:**

- **Plugin:** Prettier (esbenp.prettier-vscode)
- **Format on Save:** Enabled
- **ESLint Fix on Save:** Auto-fix enabled via `source.fixAll.eslint`
- **TypeScript:** Uses workspace tsdk (node_modules/typescript)

**Turbo Pipeline Integration:**

- `lint` task: No dependencies, outputs cached
- Global dependencies: `tsconfig.json`, `eslint.config.js`
- Each package has `lint: "eslint src/"` script

## Input Sanitization Patterns (Phase 3)

**Use Case:** Prevent XSS and injection attacks when processing user input from forms.

**Pattern 1: Control Character Removal**

```typescript
// Remove ASCII control characters (0x00-0x1F, 0x7F) to prevent injection
const sanitize = (str: string): string => {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1F\x7F]/g, '')
}

// Usage in forms
const sanitizedEmail = basicInfo.email.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 254).trim()
const sanitizedName = basicInfo.name.replace(/[\x00-\x1F\x7F]/g, '').trim()
```

**Pattern 2: Length Limiting & Trimming**

```typescript
// Apply strict length limits based on field purpose
const cleanedPhone = basicInfo.phone.replace(/\D/g, '').slice(0, 10)     // 10 digits max
const sanitizedEmail = basicInfo.email.slice(0, 254).trim()             // RFC 5321 limit
const sanitizedName = basicInfo.name.trim().slice(0, 100)               // Field requirement
```

**Pattern 3: Display Sanitization (Defense-in-Depth)**

```typescript
// Sanitize any string before rendering (even if previously sanitized)
const sanitizeString = (str: string): string => {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 500)
}

// Apply in all display contexts
const formatValue = (key: string, value: unknown) => {
  switch (key) {
    case 'currency':
      return typeof value === 'number'
        ? new Intl.NumberFormat('vi-VN', { style: 'currency' }).format(value)
        : sanitizeString(String(value))
    case 'text':
    default:
      return typeof value === 'string' ? sanitizeString(value) : String(value)
  }
}
```

**Threat Model:**
- **Email Header Injection:** Control char removal prevents multi-line injection
- **XSS via Display:** Sanitization before rendering blocks script injection
- **Buffer Overflow:** Length limits prevent oversized payloads
- **Invalid Formats:** Regex validation (phone, email) ensures conformance

## Prototype Pollution Protection Pattern (Phase 3)

**Use Case:** Validate object keys before merging user input into backend schemas.

**Pattern: Multi-Layer Validation**

```typescript
// 1. Define dangerous keys blocklist
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

// 2. Define valid key pattern (prevent __proto__ and other dangerous starts)
const VALID_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/
// - Starts with letter (prevents __ prefix)
// - Alphanumeric + underscores only
// - Max 64 characters

// 3. Apply in Zod schema validation
export const intakeAnswersSchema = z.record(z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.array(z.record(z.any())),
  z.record(z.any()),
]))
  .refine(
    (val) => !val || Object.keys(val).every((key) => VALID_KEY_PATTERN.test(key)),
    { message: 'Invalid key format (must start with letter, alphanumeric+underscore, max 64 chars)' }
  )
  .refine(
    (val) => !val || Object.keys(val).every((key) => !DANGEROUS_KEYS.has(key)),
    { message: 'Reserved key name not allowed (potential prototype pollution)' }
  )

// 4. Frontend validation before API submission
function validateWizardAnswers(answers: Record<string, unknown>) {
  const keys = Object.keys(answers)

  // Check total key count (DoS prevention)
  if (keys.length > 200) {
    return { valid: false, error: 'Too many fields (max 200)' }
  }

  // Validate each key
  for (const key of keys) {
    if (!VALID_KEY_PATTERN.test(key) || DANGEROUS_KEYS.has(key)) {
      return { valid: false, error: `Invalid key: ${key}` }
    }
  }

  return { valid: true }
}
```

**Security Notes:**
- **Backend:** Always validate keys in API schema (Zod or similar)
- **Frontend:** Validate before API submission (user-friendly errors)
- **Key Pattern:** Starting with letter blocks all dangerous prefixes
- **Blocklist:** Covers all Object.prototype methods
- **DoS Prevention:** Max 200 keys, max 20 array items

## Intake Wizard Integration Pattern (Phase 3)

**Use Case:** Integrate multi-step wizard into client creation flow while maintaining backward compatibility.

**Pattern: Outer Flow + Inner Wizard**

```typescript
// 1. Define outer flow (not including wizard's internal steps)
type OuterStep = 'basic' | 'tax-selection' | 'wizard'

// 2. Step components
const steps = [
  { id: 'basic', label: 'Basic Info', icon: User },
  { id: 'tax-selection', label: 'Tax Selection', icon: FileText },
  { id: 'wizard', label: 'Detailed Questions', icon: ClipboardList },
]

// 3. Navigation with validation
const handleNext = () => {
  if (currentStep === 'basic' && validateBasicInfo()) {
    setCurrentStep('tax-selection')
  } else if (currentStep === 'tax-selection' && validateTaxSelection()) {
    setCurrentStep('wizard')
  }
}

// 4. Render step content with wizard as component
return (
  <>
    {currentStep === 'basic' && (
      <BasicInfoForm {...} />
    )}
    {currentStep === 'tax-selection' && (
      <TaxSelectionForm {...} />
    )}
    {currentStep === 'wizard' && (
      <WizardContainer
        clientId={tempClientId}
        caseId={tempCaseId}
        onComplete={handleWizardComplete}
      />
    )}
  </>
)

// 5. Handle wizard completion (receives all answers from wizard)
const handleWizardComplete = async (wizardAnswers: IntakeAnswers) => {
  // Validate wizard answers (defense-in-depth)
  const validation = validateWizardAnswers(wizardAnswers)
  if (!validation.valid) {
    setError(validation.error)
    return
  }

  // Merge wizard answers with earlier steps
  const allAnswers = {
    ...wizardAnswers,
    taxYear: taxSelection.taxYear,
    filingStatus: taxSelection.filingStatus,
  }

  // Map to legacy fields for backward compatibility
  const legacyFields = mapWizardToLegacyFields(wizardAnswers)

  // Submit to API
  const response = await api.clients.create({
    profile: {
      ...legacyFields,
      intakeAnswers: allAnswers,  // Full answers in JSON
    }
  })
}

// 6. Legacy field mapping utility
function mapWizardToLegacyFields(wizardAnswers: IntakeAnswers) {
  return {
    hasW2: wizardAnswers.hasW2 ?? false,
    hasBankAccount: !!wizardAnswers.refundAccountType,
    hasInvestments: wizardAnswers.hasInvestments ?? false,
    hasKidsUnder17: (wizardAnswers.dependentCount ?? 0) > 0,
    numKidsUnder17: wizardAnswers.dependentCount ?? 0,
    // ... more legacy fields
  }
}
```

**Key Points:**
- **Separation:** Outer steps (basic → tax → wizard) separate from wizard's 4 internal steps
- **Composition:** WizardContainer is a component, not a full route
- **Callback:** onComplete receives all wizard answers at once
- **Backward Compat:** Legacy fields auto-mapped from wizard data
- **Validation:** Dual validation (client-side + API schema)

**Benefits:**
- User-friendly 3-step flow with progress indication
- Complex wizard encapsulated as single component
- Easy to reuse wizard in other flows (edit client, bulk import)
- Full answer history in intakeAnswers JSON for audit/analytics

---

**Last Updated:** 2026-01-22 20:53
**Phase:** Phase 03 Intake Wizard Refactor Complete Integration
**Standards Version:** 1.7
**Added:** Input sanitization patterns, prototype pollution protection, intake wizard integration pattern
