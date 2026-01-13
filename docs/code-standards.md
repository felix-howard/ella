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

---

**Last Updated:** 2026-01-12
**Phase:** 5 - Verification (Complete)
**Standards Version:** 1.2
