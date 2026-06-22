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

**Token Parsing (Read-Only):**
- `userId`, `orgId`, `orgRole` extracted from Clerk JWT
- Middleware looks up Staff by clerkId from DB; if an invite accept reaches API before webhook sync, it bootstraps Staff from the active Clerk organization membership
- Role mapping normally syncs via Clerk webhooks, with auth bootstrap as a race/local-dev fallback

**Backend Middleware:**
- `requireOrg` - Verify orgId in JWT, attach to context
- `requireOrgAdmin` - Verify org:admin role, restrict endpoint

**Frontend Auth (React):**
- `ClerkAuthProvider` - Wraps root, sets JWT token getter, clears React Query cache on sign-out
- `useAutoOrgSelection()` - Auto-selects first Clerk org on sign-in
- `useOrgRole()` - Returns capability flags: `{ isAdmin, isManager, canManageClients, canManageOrganizationSettings, canManageOwnIntakeLink, canManageAnyIntakeLink, canManagePayments, canManageAgreements, canViewPhone, canViewTeam, canManageTeam, ...role booleans }` for RBAC and settings/intake-link/NDA UX (Phase 4+)

**Frontend Capability-Flag Convention (Phase 4 - MANAGER Role):**
- **Pattern:** Components consume semantic capability flags from `useOrgRole()`, never compare role string literals (`org:admin`, `'ADMIN'`, etc.) for permission checks.
- **Flags in Hook:** (1) `isManager` - Staff.role === 'MANAGER'. (2) `canManageClients` - isAdmin || isManager (mirrors server admin-or-manager gate). (3) `canManageOrganizationSettings` - isAdmin only (firm info/NDA setup, org slug, org defaults, missed-call text-back). (4) `canManageOwnIntakeLink` - current staff can edit their own personal intake link. (5) `canManageAnyIntakeLink` - isAdmin only (all staff intake-link rows + general link). (6) `canManagePayments` - isAdmin only (payment pages, quotes, links, and payment history). (7) `canManageAgreements` - isAdmin only (agreement tabs, send/manage actions, history). (8) `canViewPhone` - isAdmin only (server masks via `serializePhone()`). (9) `canViewTeam` - active org staff only. (10) `canManageTeam` - isAdmin only.
- **Example Anti-Pattern (BAD):** `if (orgRole === 'org:admin' || role === 'ADMIN') { ... }` in components. Use capability flag instead.
- **Example Good Pattern:** `if (canViewTeam) { <Team nav item /> }` in sidebar; `if (canManageTeam) { <InviteMemberDialog /> }`; `if (canManageClients) { <Leads nav item /> }`; `if (canManagePayments) { <Payments nav item /> }`.
- **Phone Display Invariant:** `formatPhone()` passes server-masked values (containing '*') unchanged. Never strip or re-format masked values in UI; server masking via `serializePhone()` is authoritative source of truth.
- **App-Level Roles (Phase 4):** `AppRole = 'ADMIN' | 'MANAGER' | 'MEMBER'` used in team invite/role-change payloads, mirrors backend `APP_ROLES` constant in `apps/api/src/lib/staff-role-mapping.ts`. Frontend mutates with AppRole; API returns Staff.role (database source of truth).

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
- Pricing defaults live in `@ella/shared/constants`; calculator math, defaults, and tier detection live in `@ella/shared/pricing`. Landing keeps a compatibility re-export in `@/config/pricing`, so do not duplicate tier prices in app-local config.

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

**Business-Type Client Verification (Phase 08+):**
- Use `verifyBusinessClient(clientId, user)` for endpoints that require clientType=BUSINESS
- Enforces both org-scope AND clientType=BUSINESS validation
- Returns Client | null (null if not found or wrong clientType)
- Example: Contractor management routes (/clients/:clientId/contractors) require BUSINESS clients
- Pattern:
```typescript
app.get('/clients/:clientId/contractors', async (c) => {
  const user = c.get('user')
  const { clientId } = c.req.param()
  const client = await verifyBusinessClient(clientId, user)
  if (!client) {
    return c.json({ error: 'NOT_FOUND', message: 'Business client not found' }, 404)
  }
  // Continue with businessClient-scoped logic
})
```

**Template Version Branching (Agreements/NDA - Phase 04+):**
- Use `templateVersion` field on Agreement records to branch rendering: 'v1' (legacy, untouched) vs 'v2' (new template with dual signatures, org details)
- All PDF rendering paths must check `templateVersion` to avoid breaking existing data
- Migration: Existing agreements auto-populate `templateVersion: 'v1'`; new NDAs default to `templateVersion: 'v2'`
- Pattern: `if (agreement.templateVersion === 'v2') { renderV2Template() } else { renderV1Template() }`

## Storage Conventions (@ella/api)

- Use `generateStaffFileKey()` for staff uploads. Personal documents must land under `staff-files/{orgId}/{staffId}/documents/{uuid}.{ext}` and invoices under `staff-files/{orgId}/{staffId}/invoices/{yyyy-mm}/{uuid}.{ext}`.
- `kind: 'INVOICE'` requires both `invoiceYear` and `invoiceMonth`; the month is zero-padded in the storage path.
- Never log raw `staff-files/...` keys. Use `getSafeStorageReference()` and `getSafeStorageError()` for storage logging and error handling.
- Staff-file mutations should emit the canonical document activity actions: `document.staff_file_uploaded`, `document.staff_file_deleted`, `document.staff_file_downloaded`, and `document.staff_invoice_status_updated`.

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

## English-First i18n

**Default language:** English. Vietnamese stays selectable, but runtime fallbacks must prefer English.

**Rules:**
- Put user-facing frontend text in `apps/*/src/locales/en.json` and `apps/*/src/locales/vi.json`.
- Add English and Vietnamese keys together; `pnpm i18n:audit` enforces locale key parity.
- Do not hardcode Vietnamese user-facing literals in runtime UI/API code.
- Explicit bilingual catalogs are allowed only when the file owns bilingual domain data, such as SMS templates, DB seed `labelVi` data, AI prompt catalogs, or shared label maps.
- API responses should expose stable codes plus safe English-first messages; frontends translate known codes at the display boundary.
- Do not expose raw provider/server error text to clients. Map it to a stable sanitized code/message first.

**Validation:**
```bash
pnpm i18n:audit
pnpm type-check
```

## Frontend Utilities (@ella/workspace)

**Clipboard Utility (`apps/workspace/src/lib/clipboard.ts`):**
- `copyToClipboard(text, options?)` → `Promise<boolean>`
- Wraps `navigator.clipboard.writeText` with try/catch + automatic toast feedback
- Detects secure context (HTTPS/localhost) before attempting write
- **Options:** `successMsg` (default: i18n `common.linkCopied`), `errorMsg` (default: i18n `common.copyFailed`), `showToast` (default: true)
- **Usage:** Always call from user gesture context (click, keypress) to avoid `NotAllowedError: Document is not focused`
```typescript
import { copyToClipboard } from '@lib/clipboard'

const handleCopy = async () => {
  const ok = await copyToClipboard(magicLink.url, {
    successMsg: t('sharedDocs.linkCopied'),
    errorMsg: t('sharedDocs.copyFailed'),
  })
  if (ok) {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
}
```

## Realtime Messaging (Supabase Broadcast)

**Backend Pattern:**
```typescript
// After message creation, publish lightweight event
import { publishMessageEvent } from '../../services/realtime/message-publisher'

await publishMessageEvent(orgId, {
  eventType: 'message.created',
  conversationId: conv.id,
  caseId: conv.caseId,
  messageId: message.id,
  direction: 'INBOUND',
  channel: 'SMS',
  timestamp: new Date().toISOString(),
})
// Non-blocking: publish failures never interrupt message flow
```

**Frontend Hook Pattern:**
```typescript
// Subscribe to org-scoped realtime events + invalidate React Query
import { useRealtimeMessages } from '../hooks/use-realtime-messages'

export function MyComponent() {
  useRealtimeMessages({
    caseId: '123',  // Optional: filter to specific case
    enabled: true,  // Control subscription lifecycle
    onEvent: (data) => {
      // Optional: manual handling beyond cache invalidation
      console.log('Message received:', data)
    },
  })
  // Hook auto-invalidates: ['conversations'], ['unread-count'], ['messages']
}
```

**Architecture:**
- Channel format: `org:{clerkOrgId}:messages` - Org-scoped isolation
- Event type: `message` - Broadcast event for all org members
- Payload: Lightweight metadata (IDs + timestamps, no full message body); `eventType` distinguishes `message.created`, `message.status.updated`, and `conversation.read`
- Read contract: `POST /messages/:caseId/read` accepts optional `upTo`, updates unread count with compare-and-set retries, and emits `conversation.read` with `unreadCount` + `readAt`
- Frontend fetches full data via API on cache invalidation
- Graceful degradation: Missing Supabase config disables realtime (polling fallback remains)
- Non-blocking: Publisher errors logged, never thrown

**Environment Variables:**
- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for publish)
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (for subscribe)
- Configuration checked via `isSupabaseConfigured()` before operations

**Performance Characteristics:**
- Latency: 100-500ms realtime vs 10-30s polling
- Bandwidth: Lightweight events (~500 bytes) + API fetch (vs full refetch)
- Scalability: Supabase managed, auto-scales with org count
- Fallback: 60s polling interval if realtime unavailable

**Testing:**
- Verify `isSupabaseConfigured()` returns true after env var setup
- Test browser console: no errors when config missing (graceful degradation)
- Monitor WebSocket connection in DevTools Network tab
- Verify React Query cache keys invalidated on event receipt
- Confirm message creation triggers realtime event in different browser tab
- Confirm mark-read emits `conversation.read` and leaves newer inbound messages unread

## Multi-Tenancy & RBAC

**Data Isolation:**
- All queries scoped by `organizationId`
- `buildClientScopeFilter(user)` applies Admin vs Staff filtering through `ClientManager` membership checks
- `ClientManager` join model is canonical; `Client.managedById` stays transitional for rollout compatibility and legacy writes
- Audit logging tracks all org-scoped changes

**Permission Model:**
- **ADMIN:** Full org access: team management (invite/role/deactivate), all clients, admin config, billing, leads, cases, campaigns, agreements, 1099-NEC, org settings, activity timeline
- **MANAGER:** Client/operational management: admin config, clients (create/assign), leads, cases, campaigns, agreements, 1099-NEC, billing checkout, activity timeline. Can read org settings, but org-setting/NDA setup edits stay admin-only; self-service intake-link edits are limited to the viewer's own staff record. Blocked: team management endpoints. **Phone Privacy (Phase 3):** Server enforces masking via `serializePhone()` on all workspace-facing API responses—returns `*** *** {last4}` for MANAGER/STAFF/CPA across clients, leads, engagements, messages, cases, managed-clients, and team profiles. Internal logic (SMS send, lead-convert phone match, voice lookup) uses raw numbers.
- **STAFF:** Managed clients only via matching `ClientManager` links (legacy `managedById` still mirrors the primary manager during rollout), no admin functions. Can still edit their own personal intake-link row. Receives masked phone in all responses.
- **CPA:** Future role for CPA firm integrations

**Role-Based Middleware:**
- `requireOrg` - All protected endpoints (verify orgId in JWT)
- `requireOrgAdmin` - Team management endpoints only (invite/role/deactivate staff)
- `requireAdminOrManager` - All admin-gated endpoints except team management (org:admin, ADMIN, or MANAGER role)

**Role-Check Helper Rule (MANDATORY):**
- Backend role checks MUST use the central helpers — never inline role literals (`user.role === 'MANAGER'`, `orgRole === 'org:admin'`) in routes/services:
  - `isAdminOrManager(user)` / `canSeeAllClients(user)` (`apps/api/src/lib/org-scope.ts`) — admin-or-manager tier predicate / org-wide client visibility
  - `canViewFullPhone(user)` / `serializePhone(user, phone)` (`apps/api/src/lib/phone-privacy.ts`) — phone privacy (ADMIN-only full numbers); apply `serializePhone` at response-build points only, internal logic (SMS, lead-convert matching, voice lookup) keeps raw values
  - `requireAdminOrManager` / `requireOrgAdmin` middleware (`apps/api/src/middleware/auth.ts`) — route gating
- Rationale: the MANAGER tier is encoded in exactly one place (`isAdminOrManager`); inline literals silently drift when roles change
- Regression tests enforce the matrix: `apps/api/src/routes/__tests__/manager-role-authorization.test.ts`

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

## 1099-NEC Tax Form Integration (TaxBandits API)

**Primary Service:** `apps/api/src/services/taxbandits-client.ts` (OAuth 2.0 JWT-based e-filing)

**Configuration:**
- TaxBandits env vars: `TAXBANDITS_CLIENT_ID`, `TAXBANDITS_CLIENT_SECRET`, `TAXBANDITS_USER_TOKEN`, `TAXBANDITS_SANDBOX`
- Singleton client initialized on demand, checked via `config.taxbandits.isConfigured`
- OAuth JWT: Header+Payload+Signature (HS256) with client credentials
- Token caching: 55-min expiry (60-min API token minus 5-min buffer)
- Request timeout: 30s with AbortController

**Models (Phase 4 Schema - Cleaned):**
- `Form1099NEC` - Individual tax forms with status (DRAFT, IMPORTED, PDF_READY, SUBMITTED, ACCEPTED, REJECTED)
  - `taxbanditsRecordId` (String, indexed) - TaxBandits form ID
  - `taxbanditsSubmissionId` (String, indexed, denormalized) - For batch lookups
  - `validationErrors` array for error tracking
  - `efileStatus` for IRS response tracking
- `FilingBatch` - Groups multiple 1099-NECs by client + tax year
  - `taxbanditsSubmissionId` (String, indexed) - Batch submission ID from TaxBandits
- `Contractor` - Business client contractor tracking (ssn4Encrypted, einEncrypted, name, address, phone, businessType)
- Form1099Status enum: DRAFT, IMPORTED, PDF_READY, SUBMITTED, ACCEPTED, REJECTED

**Workflow (3-Step TaxBandits Process):**
1. `DRAFT` - Form created locally with contractor data
2. `IMPORTED` - Form transmitted to TaxBandits (creates RecordId + SubmissionId)
3. `PDF_READY` - Draft PDF retrieved from TaxBandits and stored on R2
4. `SUBMITTED` - Batch transmitted to IRS via TaxBandits
5. `ACCEPTED` / `REJECTED` - IRS response received

**Routes (org-scoped with verifyBusinessAccess):**
- `POST /businesses/:businessId/1099-nec/create` - Create forms in TaxBandits (DRAFT → IMPORTED)
- `POST /businesses/:businessId/1099-nec/fetch-pdfs` - Request & download PDFs to R2 (IMPORTED → PDF_READY)
- `POST /businesses/:businessId/1099-nec/transmit` - Transmit to IRS (PDF_READY → SUBMITTED)
- `GET /businesses/:businessId/1099-nec/status` - Status counts
- `GET /businesses/:businessId/1099-nec/:formId/pdf` - Download signed URL (24-hour TTL)
- `GET /businesses/:businessId/1099-nec/batches` - List filing batches
- `GET /businesses/:businessId/1099-nec/batches/:batchId` - Batch details with forms
- `POST /businesses/:businessId/1099-nec/batches/:batchId/refresh` - Refresh batch status from TaxBandits

## Testing Patterns

**Unit Tests (Vitest):**
- Workspace app (`@ella/workspace`) has vitest configured for unit testing pure utility helpers (e.g., `compute-link-state.test.ts`)
- Configuration: `vitest.config.ts` with node environment, matches `src/**/*.test.ts` pattern
- Test scripts: `pnpm test` (run), `pnpm test:watch` (watch mode)
```typescript
// Test file naming: feature.test.ts
describe('Feature', () => {
  it('should do something', () => {
    expect(result).toBe(expected)
  })
})
```

**Testable Utility Functions (Phase 6 Pattern):**
- Extract business logic from job/service files into pure functions
- Create `grouping-utils.ts` or similar utilities module with testable functions
- Place test file in `__tests__/` directory adjacent to source
- Use type-safe fixtures (helper functions like `createMockDocument()`) for test setup
- Test both happy paths and edge cases (nulls, empty inputs, boundary conditions)
- Example: `UnionFind`, `normalizeTaxpayerName()`, `bucketDocumentsByMetadata()` extracted from batch jobs for isolated testing

**Integration Tests:**
- Mock Prisma with in-memory database
- Mock Clerk Backend SDK for org operations
- Type-safe endpoint testing
- Integration-level tests validating end-to-end flows (e.g., metadata bucketing → grouping → sorting → validation)

**Type Coverage:**
- 100% TypeScript strict mode
- Zero implicit any
- Exhaustive enums
- Type-safe test fixtures with full interface compliance

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
- `CLERK_WEBHOOK_SECRET` - Svix webhook signing secret (webhook sync migration)
- `GEMINI_API_KEY` - Google Gemini API
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `PORTAL_URL` - Client portal base URL
- `R2_*` - Cloudflare R2 credentials

**TaxBandits Integration (Phase 3.5):**
- `TAXBANDITS_CLIENT_ID` - TaxBandits OAuth client ID
- `TAXBANDITS_CLIENT_SECRET` - TaxBandits OAuth client secret
- `TAXBANDITS_USER_TOKEN` - TaxBandits user token
- `TAXBANDITS_SANDBOX` - Set to `true` for sandbox environment

**Stripe Checkout (Phase 01):**
- `STRIPE_SECRET_KEY` - Stripe secret key for Checkout session creation
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `STRIPE_SUCCESS_URL` - Checkout success redirect URL; production must be HTTPS
- `STRIPE_CANCEL_URL` - Checkout cancel redirect URL; production must be HTTPS
- `STRIPE_CURRENCY` - Currency code for Checkout sessions; stored lowercase, defaults to `usd`
- Localhost defaults are dev-only. Production config must satisfy the HTTPS return-URL guard.
- Persist `PaymentQuote` before the Stripe API call and `StripeCheckoutSession` after success; keep stored snapshots minimal, exclude internal notes like `quoteNotes`, and avoid customer/business PII in Stripe metadata.

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

**Version:** 2.5
**Last Updated:** 2026-05-22
**Status:** English-first i18n enforcement documented. TaxBandits API Integration complete. TaxBandits API client + 8 endpoints. Schema cleanup done (removed legacy fields, indexed TaxBandits IDs).
