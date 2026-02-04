# Code Standards

Ella follows unified coding standards across all packages to ensure maintainability and consistency.

## TypeScript Standards

**Language Version:** TypeScript 5.7.3+

**Compiler Strict Mode:**
- `strict: true` - All type checking enabled
- `esModuleInterop: true` - Module compatibility
- `skipLibCheck: true` - Skip type checking of declaration files
- `forceConsistentCasingInFileNames: true` - Case sensitivity

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
│   └── {feature}/        # Feature directories
├── package.json          # Workspace exports
├── tsconfig.json         # Extends root config
└── {framework-config}    # Config files
```

## Database (@ella/db)

**Schema Language:** Prisma (prisma/schema.prisma)

**Naming Convention:**
- Model names: `PascalCase` (e.g., `User`, `Organization`)
- Field names: `camelCase` (e.g., `createdAt`, `isActive`)
- Relations: plural for arrays (e.g., `documents: Document[]`)
- Enum values: `UPPER_SNAKE_CASE` (e.g., `ADMIN`, `STAFF`, `IDENTITY`)

**Best Practices:**
- Always include `id`, `createdAt`, `updatedAt` fields
- Use `@unique` for lookups, `@db.String` for constraints
- Migrations versioned via `prisma/migrations/`
- Generated client output to `src/generated/` (git-ignored)

**Client Pattern (Singleton):**
```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
```

**Org-Scoped Query Pattern:**
```typescript
// Always verify user's organization
const filter = buildClientScopeFilter(user)
const clients = await prisma.client.findMany({ where: filter })

// Multi-tenant middleware
app.use(requireOrg) // Verify orgId in JWT token
app.use(requireOrgAdmin) // Verify org:admin role (Clerk)
```

## Authentication (Clerk JWT)

**Token Parsing:**
- `userId`, `orgId`, `orgRole` extracted from Clerk JWT
- `syncOrganization()` - Upsert Clerk org to DB (5-min cache)
- `syncStaffFromClerk()` - Create/update Staff, maps org:admin → ADMIN role

**Backend Middleware:**
- `requireOrg` - Verify orgId in JWT, attach to context
- `requireOrgAdmin` - Verify org:admin role, restrict endpoint

**Frontend Auth (React):**
- `ClerkAuthProvider` - Wraps root, sets JWT token getter, clears React Query cache on sign-out
- `useAutoOrgSelection()` - Auto-selects first Clerk org on sign-in
- `useOrgRole()` - Returns `{ isAdmin, role }` for RBAC checks

## Shared Types & Validation (@ella/shared)

**Zod Schema Patterns:**
```typescript
export const emailSchema = z.string().email()
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/)
export const userSchema = z.object({
  id: z.string().cuid(),
  email: emailSchema,
  phone: phoneSchema.optional(),
})
export type User = z.infer<typeof userSchema>
```

**Export Organization:**
- `/schemas` - Zod validators only
- `/types` - TypeScript types & inferred types
- Default export includes all

## Condition Types & Evaluation

**Three Condition Formats:**

1. **Legacy flat** (implicit AND):
   ```typescript
   { hasW2: true, hasSelfEmployment: true }
   ```

2. **Simple with operator:**
   ```typescript
   { key: 'foreignBalance', value: 10000, operator: '>' }
   ```

3. **Compound AND/OR (nested):**
   ```typescript
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

**Type Guards:**
- `isSimpleCondition(obj)` - Has `key`, `value` (no `type`)
- `isCompoundCondition(obj)` - Has `type: 'AND' | 'OR'` + `conditions[]`
- `isLegacyCondition(obj)` - Plain object (no `key`, no `type`)

**Supported Operators:** `===`, `!==`, `>`, `<`, `>=`, `<=`

**Recursion Limits:**
- Max JSON size: 10KB (DoS protection)
- Max nesting depth: 3 levels
- Invalid conditions return `false`

## Intake Form Configuration

**Location:** `apps/workspace/src/lib/intake-form-config.ts`

**Core Configuration Objects:**
- `SECTION_CONFIG` - Vietnamese section titles (18 sections)
- `FIELD_CONFIG` - 95+ field definitions with metadata
- `FORMAT_TYPES` - text, number, currency, boolean, select, ssn, date

**Field Organization:**
- Organized by section (personal_info, tax_info, income, etc.)
- Non-editable sections: personal_info (read from database)
- SSN fields encrypted server-side (AES-256-GCM)
- Masked in UI via `maskSSN()` utility

## API Patterns (@ella/api)

**Request Validation (Zod + Hono):**
```typescript
app.post('/clients',
  validator('json', createClientSchema),
  requireOrg,
  async (c) => {
    const data = c.req.valid('json')
    // Type-safe implementation
  }
)
```

**Error Handler Middleware:**
- Standardized HTTP status codes
- Localized error messages (Vietnamese)
- Detailed logging with request context

**Org-Scoped Endpoint Pattern:**
```typescript
// Verify user's org, apply scope filter
const filter = buildClientScopeFilter(user)
const clients = await prisma.client.findMany({ where: filter })
```

## Frontend Patterns (@ella/workspace & @ella/portal)

**React Query Integration:**
- `useQuery()` - Server state management
- Query keys: `['clients', { orgId }]`, `['team', 'members']`
- Automatic cache invalidation on mutations
- Retry logic: 3 attempts, exponential backoff

**Zustand Stores:**
- UI state (sidebar collapsed, view mode)
- Toast notifications with auto-dismiss
- Session persistence via localStorage

**Component Architecture:**
- File-based routing via TanStack Router
- Context providers at root (Auth, Clerk, Error Boundary)
- Compound component pattern for complex features

**Styling (Tailwind CSS 4):**
- Utility-first approach
- Design tokens: colors, spacing, radius, shadows
- Dark mode support via `dark:` prefix
- Component variants via `class-variance-authority`

## Multi-Tenancy & RBAC

**Data Isolation:**
- All queries scoped by `organizationId`
- `buildClientScopeFilter(user)` applies Admin vs Staff filtering
- ClientAssignment enforces staff-client relationships
- Audit logging tracks all org-scoped changes

**Permission Model:**
- **ADMIN:** Full org access, manage team + client assignments
- **STAFF:** Assigned clients only, no team management
- **CPA:** Future role for CPA firm integrations

**Role-Based Middleware:**
- `requireOrg` - All protected endpoints
- `requireOrgAdmin` - Team management endpoints only

## Document Classification & AI

**Gemini Integration Pattern:**
- Image validation (JPEG, PNG, WebP, HEIC - 10MB max)
- Exponential backoff retry (3 attempts default)
- Batch processing with concurrency control (3 default)
- Error handling & rate limiting resilience

**Classification Service:**
- Multi-class tax form detection
- Returns: docType, category, confidence score
- 89+ document types mapped to 7 categories

**OCR Service:**
- Structured field extraction per document type
- W2, 1099-INT, 1099-NEC, K-1, 1098, 1095-A support
- Confidence scoring for verification workflow

## Testing Patterns

**Unit Tests (Jest):**
```typescript
// Test file naming: feature.test.ts
describe('Feature', () => {
  it('should do something', () => {
    expect(result).toBe(expected)
  })
})
```

**Integration Tests:**
- Mock Prisma with in-memory database
- Mock Clerk Backend SDK for org operations
- Type-safe endpoint testing

**Type Coverage:**
- 100% TypeScript strict mode
- Zero implicit any
- Exhaustive enums

## Code Quality Metrics

- **Type Check:** `pnpm type-check` - Zero errors
- **Lint:** `pnpm lint` - ESLint rules enforced
- **Build:** `pnpm build` - No warnings
- **Tests:** `pnpm test` - Comprehensive coverage
- **Code Review:** Avg 9/10 quality score

## Environment Variables

**Required (.env):**
- `DATABASE_URL` - PostgreSQL connection
- `CLERK_SECRET_KEY` - Clerk Backend SDK
- `GEMINI_API_KEY` - Google Gemini API
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `PORTAL_URL` - Client portal base URL
- `R2_*` - Cloudflare R2 credentials

**Optional:**
- `GEMINI_MODEL` - default: gemini-2.0-flash
- `GEMINI_MAX_RETRIES` - default: 3
- `AI_BATCH_CONCURRENCY` - default: 3

## Version Control

**Branch Naming:**
- `feature/*` - New features
- `fix/*` - Bug fixes
- `refactor/*` - Code restructuring
- `docs/*` - Documentation
- `chore/*` - Maintenance

**Commit Messages:**
- `[Add] Feature description` - New feature
- `[Update] Enhancement description` - Enhancement
- `[Fix] Bug description` - Bug fix
- `[Refactor] Change description` - Refactoring
- `[Docs] Update description` - Documentation

---

**Version:** 2.2
**Last Updated:** 2026-02-04
**Status:** Multi-Tenancy & Clerk Auth integrated
