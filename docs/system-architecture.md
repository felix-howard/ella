# System Architecture

Ella employs a layered, monorepo-based architecture prioritizing modularity, type safety, and scalability.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Frontend Layer (React)                 │
│    apps/web - User-facing web application       │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓ HTTP/REST API calls
┌──────────────────────────────────────────────────┐
│         Backend Layer (API Server)                │
│  apps/api - Express/Fastify API endpoints        │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓ Prisma ORM queries
┌──────────────────────────────────────────────────┐
│      Shared Packages (Monorepo Utilities)        │
│  ├─ @ella/db - Database & Prisma client         │
│  ├─ @ella/shared - Types & validation schemas   │
│  └─ @ella/ui - Component library                │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓ Database queries
┌──────────────────────────────────────────────────┐
│     Data Layer (PostgreSQL)                      │
│     - User accounts & documents                  │
│     - Audit logs                                │
│     - Compliance data                           │
└──────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Frontend Layer (apps/portal & apps/workspace)

**Technology:** React 19, Vite 6, TanStack Router 1.94+, React Query 5.64+, @ella/ui, Tailwind CSS v4

**Structure:**

- `apps/portal/` - Primary user-facing frontend (document upload)
- `apps/workspace/` - Secondary workspace-specific frontend (staff dashboard)
  - 10 main pages (/, /actions, /clients, /cases, /messages, etc.)
  - 27 components (6 feature areas + 7 messaging)
  - Real-time polling for live updates
- File-based routing via TanStack Router (`src/routes/*`)
- Auto-generated route tree (`routeTree.gen.ts`)

**Responsibilities:**

- User interface rendering (Vietnamese-first)
- Client-side routing & navigation
- Form handling & validation
- Server state management (React Query)
- Real-time data polling (30s inbox, 10s active conversation)
- Optimistic updates for responsiveness
- API request orchestration

**Key Features:**

- Document upload interface (portal)
- Unified message inbox with split-view (workspace)
- Dashboard with compliance status
- Client/case management with messaging
- Action queue with priority grouping
- Accessibility: ARIA labels, semantic HTML

**API Communication:**

- HTTP REST calls to backend
- Request validation via @ella/shared schemas
- Response type safety via TypeScript
- Pagination support with limit/offset

### Backend API Layer (apps/api)

**Technology:** Hono 4.6+, Node.js server, @hono/zod-openapi, @hono/zod-validator, TypeScript

**Structure:**

- Entry: `src/index.ts` (serves on PORT 3001)
- App config: `src/app.ts` (main Hono app instance & all routes)
- Middleware: `src/middleware/error-handler.ts` (global error handling)
- Lib: `src/lib/db.ts` (Prisma re-export), `src/lib/constants.ts` (pagination, Vietnamese labels)
- Routes: `src/routes/{clients,cases,docs,actions,messages,portal,health}/` (modular endpoints)
- Services: `src/services/{checklist-generator,magic-link,storage}.ts` (business logic)

**Build & Deployment:**

- Dev: `pnpm -F @ella/api dev` (tsx watch for hot reload)
- Build: `pnpm -F @ella/api build` (tsup → ESM + type defs)
- Start: `pnpm -F @ella/api start` (runs dist/index.js)

**Implemented Endpoints (29 total):**

**Clients (6):**
- `GET /clients` - List with search/status filters, pagination
- `POST /clients` - Create client + profile + case + magic link + checklist + SMS welcome
- `GET /clients/:id` - Client with profile, tax cases, portalUrl, smsEnabled flag
- `PATCH /clients/:id` - Update name/phone/email/language
- `POST /clients/:id/resend-sms` - Resend welcome message with magic link (requires PORTAL_URL)
- `DELETE /clients/:id` - Delete client

**Tax Cases (6):**
- `GET /cases` - List with status/year/client filters, pagination
- `POST /cases` - Create new case
- `GET /cases/:id` - Case details with document counts
- `PATCH /cases/:id` - Update status/metadata
- `GET /cases/:id/checklist` - Dynamic checklist from profile & templates
- `GET /cases/:id/images` - Raw images for case

**Digital Documents (5):**
- `GET /docs/:id` - Document details with extracted data
- `POST /docs/:id/classify` - AI classify raw image to docType
- `POST /docs/:id/ocr` - Trigger OCR for data extraction
- `PATCH /docs/:id/verify` - Verify extracted data, set status VERIFIED

**Actions (2):**
- `GET /actions` - Queue grouped by priority (URGENT > HIGH > NORMAL > LOW)
- `GET/PATCH /actions/:id` - Action details & mark complete

**Messages (4, Phase 3.2):**
- `GET /messages/conversations` - List all conversations with unread counts, pagination, last message preview
- `GET /messages/:caseId` - Conversation history (SMS/portal/system) with auto-reset unread
- `POST /messages/send` - Create message, support SMS/PORTAL/SYSTEM channels
- `POST /messages/remind/:caseId` - Send missing docs reminder to specific case

**Portal (2):**
- `GET /portal/:token` - Verify magic link, return case data for client
- `POST /portal/:token/upload` - Client document upload via magic link

**Webhooks - SMS (2, Phase 3.1):**
- `POST /webhooks/twilio/sms` - Incoming SMS handler (signature validation, rate limited 60/min)
- `POST /webhooks/twilio/status` - Message status updates (optional tracking)

**Health (1):**
- `GET /health` - Server status check

**Responsibilities:**

- HTTP request handling with Hono framework
- Request validation via Zod + @hono/zod-validator
- Business logic execution via service layer
- Database transaction management (Prisma)
- Global error handling with standardized responses
- OpenAPI schema generation (accessible at `/doc`)
- Scalar API UI for interactive docs (at `/docs`)
- CORS for frontend (localhost:5173, :5174)
- Request logging via hono/logger middleware

**Core Services (Phase 1.2):**

- `checklist-generator.ts` - Generate checklist from profile & templates
- `magic-link.ts` - Create/validate passwordless access tokens
- `sms.ts` - SMS service with Twilio integration, welcome message & configuration checks
- `storage.ts` - R2 Cloudflare storage service (placeholder)

**SMS Service Implementation (Phase 1.2+):**

- Twilio API wrapper with E.164 phone formatting & error handling
- Welcome message template with magic link portal URL inclusion
- SMS enablement detection via environment variable check (TWILIO_ACCOUNT_SID)
- Resend SMS endpoint for client onboarding recovery
- Comprehensive error codes for missing configs (NO_MAGIC_LINK, SMS_NOT_CONFIGURED, PORTAL_URL_NOT_CONFIGURED)
- Vietnamese & English message support

**Unified Messaging (Phase 3.2):**

- `messages/` routes handle conversation listing, message history, and sending
- Conversation auto-creation with upsert pattern (prevents race conditions)
- Channel-aware sending: SMS via Twilio, PORTAL/SYSTEM stored in database
- Unread count tracking per conversation
- Real-time updates via polling (30s inbox, 10s active)

**Future Services:**

- Email notifications
- Message scheduling
- MMS support (images)
- Compliance rule engine

**Response Format:**
All endpoints return standard format:

```json
{
  "data": { /* endpoint-specific payload */ },
  "pagination": { "page": 1, "limit": 20, "total": 100 } // if list endpoint
}
```

**Error Handling:**

- Global error handler middleware catches all exceptions
- Returns HTTP status codes: 400 (validation), 404 (not found), 500 (server error)
- Error response includes descriptive message for debugging

### Database Abstraction (@ella/db)

**Pattern:** Prisma ORM with singleton client

**Key Components:**

#### Prisma Schema (prisma/schema.prisma)

```
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider      = "prisma-client-js"
  output        = "../src/generated"
  binaryTargets = ["native"]
}
```

#### Singleton Client (src/client.ts)

```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**Why Singleton?**

- Prevents connection pool exhaustion in development
- Hot module reloading safe
- Single connection instance per process
- Production: New instance created per server instance

**Database Queries:**

```typescript
// Safe, typed queries
import { prisma } from '@ella/db'

const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, createdAt: true },
})
```

### Shared Validation & Types (@ella/shared)

**Purpose:** Single source of truth for data contracts

**Exports:**

#### Schemas (Zod validation)

```typescript
import { emailSchema, phoneSchema, paginationSchema } from '@ella/shared/schemas'

// Runtime validation
const result = emailSchema.parse(userInput)
```

#### Types (TypeScript)

```typescript
import type { ApiResponse, Pagination, UserId } from '@ella/shared/types'

// Type-safe endpoints
const getUsers = async (pagination: Pagination): Promise<ApiResponse<User[]>> => {
  // ...
}
```

**Benefits:**

- Shared validation between frontend & backend
- Type safety across API boundaries
- Single schema maintains multiple responsibilities
- Reduced duplication & bugs

### UI Component Library (@ella/ui)

**Technology:** shadcn/ui (Radix UI + Tailwind CSS v4)

**Architecture:**

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── button.tsx      # Reusable Button component
│   │   ├── ...             # Future: card, form, modal, etc.
│   ├── lib/
│   │   └── utils.ts        # cn() class merging utility
│   └── styles.css          # Global Tailwind base styles
└── components.json         # shadcn/ui registry config
```

**Component Pattern:**

```typescript
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const buttonVariants = cva('base', {
  variants: {
    variant: { primary: 'primary', secondary: 'secondary' },
    size: { sm: 'px-2 py-1', lg: 'px-4 py-2' }
  },
  defaultVariants: { variant: 'primary', size: 'md' }
})

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }))}
      {...props}
      ref={ref}
    />
  )
)
```

**Tailwind Configuration:**

- Base color: neutral
- Version: 4.0.0+
- CSS output: src/styles.css
- Utility-first styling with variants

## Data Flow

### Unified Inbox & Messaging Flow (Phase 3.2)

```
Staff Views Unified Inbox (/messages)
        ↓
GET /messages/conversations (30s polling)
        ↓
Fetch all conversations with:
├─ Last message preview
├─ Unread count
├─ Client info (name, phone)
└─ Case status & tax year
        ↓
Render split view:
├─ Left: Conversation list with unread badges
└─ Right: Empty state or selected conversation
        ↓
Staff clicks conversation → Navigate to /messages/$caseId
        ↓
GET /messages/:caseId (10s polling while active)
        ↓
Fetch conversation & messages:
├─ Auto-create conversation if missing (upsert)
├─ Reset unread count to 0
└─ Fetch messages (paginated, desc order)
        ↓
Render message thread + quick actions bar
        ↓
Staff sends message:
├─ Choose channel (SMS or PORTAL)
├─ POST /messages/send
├─ Create message record in DB
├─ Update conversation timestamp
├─ If SMS: Send via Twilio
├─ Optimistic update: show message immediately
└─ Silent refresh: sync with server in background (10s)
        ↓
Real-time updates via polling:
├─ Inbox updates every 30s
├─ Active conversation updates every 10s
└─ Non-blocking refresh with loading indicator
```

**Key Features:**
- Race condition prevention: upsert pattern for conversation creation
- Optimistic UI: message shows immediately, syncs after send
- Multi-channel support: SMS (Twilio), PORTAL (in-app), SYSTEM (notifications)
- Accessibility: aria-labels, aria-pressed, semantic HTML
- Vietnamese UI: "Tin nhắn", "Chọn cuộc hội thoại"

### Authentication Flow

```
User Login Form (Frontend)
        ↓
POST /api/auth/login (Backend)
        ↓
Validate credentials (Zod)
        ↓
Query User (Prisma → PostgreSQL)
        ↓
Generate JWT token
        ↓
Return token + user data (apiResponseSchema)
        ↓
Store token in localStorage/cookie (Frontend)
        ↓
Attach token to future requests
```

### Document Upload Flow

```
Upload Form (Frontend)
        ↓
Select file + metadata (validated locally)
        ↓
POST /api/documents (with auth header)
        ↓
Validate request (Zod from @ella/shared)
        ↓
Check authorization
        ↓
Store file (to storage service - future)
        ↓
Create Document record (Prisma)
        ↓
Return document data (apiResponseSchema)
        ↓
Update frontend state (show in list)
```

### Compliance Check Flow

```
Scheduled Job (Backend - future)
        ↓
Query all Documents (Prisma)
        ↓
Apply compliance rules
        ↓
Identify upcoming deadlines
        ↓
Create notifications
        ↓
Send emails (via notification service - future)
        ↓
Log audit trail (Prisma)
```

### AI Document Processing Pipeline Flow (Phase 2.1 & 2.2)

```
Client Uploads Documents via Portal
        ↓
POST /portal/:token/upload (multipart form)
        ↓
Validate files (type, size, count)
        ↓
Upload to R2 storage (Cloudflare)
        ↓
Create RawImage records (status: UPLOADED)
        ↓
[PIPELINE STAGE 1: Classification]
        ├─ analyzeImage() with classify prompt
        ├─ Gemini vision identifies document type
        ├─ Returns { docType, confidence }
        └─ Update RawImage.classifiedType & aiConfidence
        ↓
[PIPELINE STAGE 2: Auto-Linking to Checklist] (Phase 2.2)
        ├─ linkToChecklistItem(rawImageId, caseId, docType)
        ├─ Search ChecklistItem by (caseId, template.docType)
        ├─ If found: Link RawImage ↔ ChecklistItem
        ├─ Update ChecklistItem.status: MISSING → HAS_RAW
        ├─ Increment ChecklistItem.receivedCount
        └─ RawImage.status: CLASSIFIED → LINKED
        ↓
[PIPELINE STAGE 3: Blur Detection]
        ├─ analyzeImage() with blur-check prompt
        ├─ Gemini assesses sharpness (0-100 scale)
        ├─ Returns { blurScore, issues }
        └─ If blurry (>70): Create BLURRY_DETECTED action
        ↓
[PIPELINE STAGE 4: OCR Extraction] (if document supports it)
        ├─ getOcrPromptForDocType(docType)
        ├─ analyzeImage() with form-specific prompt
        ├─ Extract & validate structured data
        ├─ Calculate confidence from key fields
        └─ Prepare data for atomic transaction
        ↓
[Atomic Transaction] (Phase 2.2)
        ├─ Upsert DigitalDoc with extracted fields
        ├─ Update ChecklistItem.status: HAS_RAW → HAS_DIGITAL
        ├─ Mark RawImage.status: LINKED
        ├─ All 3 operations in single transaction (ACID)
        └─ No partial states possible
        ↓
[Action Creation Rules]
        ├─ AI_FAILED → Classification or extraction error
        ├─ BLURRY_DETECTED → Image quality issue (blur >70)
        ├─ VERIFY_DOCS → OCR confidence <0.85 or invalid data
        └─ Actions appear in workspace queue
        ↓
[Portal Status Update]
        ├─ Client sees uploaded documents
        ├─ Blurry documents flagged for resend
        ├─ Verified documents marked as received
        └─ Real-time checklist progress (MISSING/HAS_RAW/HAS_DIGITAL)

**Checklist Status Lifecycle:**
- MISSING: Initial state (no docs received)
- HAS_RAW: Raw image received (classification success)
- HAS_DIGITAL: Digital doc created (OCR extraction success)
- VERIFIED: Manually verified by staff (future action)

**Retry Strategy:**
- Transient errors (timeout, rate limit, 500/502/503)
- Exponential backoff: 1s → 2s → 4s (default: 3 retries)
- Non-transient: Single attempt, create AI_FAILED action

**Concurrency Control:**
- Batch processing: 3 images parallel (tuned for Gemini rate limits)
- Per-image: Sequential stages (classify → blur → ocr → atomic commit)
- Atomic transactions prevent race conditions on concurrent uploads
```

## Database Schema (Phase 1.1 - Complete)

**Core Models (12):**

```
Staff - Authentication & authorization
├── id, email (@unique), name, role (ADMIN|STAFF|CPA)
├── avatarUrl, isActive, timestamps

Client - Tax client management
├── id, name, phone (@unique), email, language (VI|EN)
├── profile (1:1 ClientProfile)
├── taxCases (1:many TaxCase)

ClientProfile - Tax situation questionnaire
├── Dependents: hasKidsUnder17, numKidsUnder17, paysDaycare, hasKids17to24
├── Employment: hasW2, hasSelfEmployment
├── Investments: hasBankAccount, hasInvestments
├── Business: ein, businessName, hasEmployees, hasContractors, has1099K
├── Housing: hasRentalProperty

TaxCase - Per-client per-year tax filing
├── clientId, taxYear, status (INTAKE→FILED), taxTypes[]
├── rawImages, digitalDocs, checklistItems (1:many)
├── conversation, magicLinks, actions (1:many)
├── Timestamps: lastContactAt, entryCompletedAt, filedAt

RawImage - Document uploads
├── caseId, r2Key, r2Url, filename, fileSize
├── status (UPLOADED→LINKED), classifiedType, aiConfidence, blurScore
├── uploadedVia (SMS|PORTAL|SYSTEM)

DigitalDoc - Extracted/verified documents
├── caseId, rawImageId, docType, status (PENDING→VERIFIED)
├── extractedData (JSON), aiConfidence, verifiedById
├── checklistItemId (optional linking)

ChecklistTemplate - Tax form requirements
├── taxType, docType (@unique combo), labelVi/labelEn, descriptionVi/labelEn
├── isRequired, condition (JSON), sortOrder, category

ChecklistItem - Per-case checklist status
├── caseId, templateId (@unique combo), status (MISSING→VERIFIED)
├── expectedCount, receivedCount, notes

Conversation - Per-case message thread
├── caseId (@unique), unreadCount, lastMessageAt

Message - SMS/portal/system messages
├── conversationId, channel (SMS|PORTAL|SYSTEM)
├── direction (INBOUND|OUTBOUND), content, twilioSid
├── attachmentUrls[], isSystem, templateUsed

MagicLink - Passwordless access tokens
├── caseId, token (@unique), expiresAt, isActive
├── lastUsedAt, usageCount

Action - Staff tasks & reminders
├── caseId, type (VERIFY_DOCS|AI_FAILED|BLURRY_DETECTED|REMINDER_DUE|CLIENT_REPLIED)
├── priority (URGENT|HIGH|NORMAL|LOW), assignedToId
├── isCompleted, completedAt, scheduledFor, metadata (JSON)
```

**Enums (12):**
- TaxCaseStatus, TaxType, DocType (21 document types)
- RawImageStatus, DigitalDocStatus, ChecklistItemStatus
- ActionType, ActionPriority, MessageChannel, MessageDirection
- StaffRole, Language

## Monorepo Configuration

### pnpm Workspaces

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

**Workspace Structure:**

```
ella/
├── packages/
│   ├── db/       # @ella/db - Prisma client & database layer
│   ├── shared/   # @ella/shared - Types & validation schemas
│   └── ui/       # @ella/ui - Component library (shadcn/ui)
├── apps/
│   ├── api/      # @ella/api - Hono backend server
│   ├── portal/   # @ella/portal - Primary React frontend (Vite)
│   └── workspace/# @ella/workspace - Secondary React frontend
├── trigger/      # Job orchestration placeholder
└── pnpm-workspace.yaml
```

### Turbo Orchestration

```json
{
  "globalDependencies": ["**/*.env"],
  "pipeline": {
    "type-check": {
      "outputs": [],
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true
    }
  }
}
```

**Task Dependencies:**

- `build` depends on `^build` (all dependencies build first)
- Results cached for incremental builds
- Reduces redundant compilation

## Environment Configuration

**Development:**

```
DATABASE_URL=postgresql://user:pass@localhost:5432/ella_dev
NODE_ENV=development
```

**Production:**

```
DATABASE_URL=postgresql://user:pass@prod-db:5432/ella
NODE_ENV=production
PORT=3000
```

**Environment Variables:**

- Loaded from `.env` (git-ignored)
- Template: `.env.example`
- No secrets in code
- Runtime validation recommended

## Type Safety Strategy

**Layer 1: Database Layer**

```typescript
import { prisma } from '@ella/db'
const user = await prisma.user.findUnique(...)
// Result automatically typed from Prisma schema
```

**Layer 2: Validation Layer**

```typescript
import { emailSchema } from '@ella/shared/schemas'
const validEmail = emailSchema.parse(input)
// emailSchema validates + infers type
```

**Layer 3: API Layer**

```typescript
import { apiResponseSchema } from '@ella/shared/schemas'
import type { ApiResponse } from '@ella/shared/types'

const response: ApiResponse<UserData> = {
  success: true,
  data: userData,
}
```

**Result:** End-to-end type safety from DB to frontend

## Error Handling Strategy

**Backend Error Handling:**

```typescript
try {
  const user = await prisma.user.findUnique(...)
  return { success: true, data: user }
} catch (error) {
  return {
    success: false,
    error: 'User not found'
  }
}
```

**Frontend Error Handling:**

```typescript
try {
  const response = await api.getUser(id)
  if (response.success) {
    setUser(response.data)
  } else {
    setError(response.error)
  }
} catch (error) {
  setError('Network error')
}
```

## Scaling Considerations

**Horizontal Scaling:**

- Stateless API design (no session state)
- Load balancer distributes requests
- Shared PostgreSQL database
- Redis for distributed caching (future)

**Vertical Scaling:**

- Connection pooling prevents exhaustion
- Query optimization via Prisma
- Index strategy for common queries
- Pagination to limit data transfers

**Future Optimizations:**

- GraphQL for flexible queries
- Caching layer (Redis)
- CDN for static assets
- Database replication & sharding
- Microservices if modules grow

## Security Architecture

**Authentication:**

- JWT tokens for stateless auth
- Secure refresh token rotation
- Password hashing (via @prisma/client lifecycle hooks - future)

**Authorization:**

- Role-based access control (RBAC)
- Middleware checks permissions
- Resource-level authorization

**Data Protection:**

- HTTPS enforced
- SQL injection prevention (Prisma parameterized queries)
- CSRF protection (SameSite cookies)
- Input validation (Zod schemas)
- Audit logging for compliance

**Sensitive Data:**

- Database encryption (future)
- PII masked in logs
- Secrets in environment variables only

## Testing Architecture

**Unit Testing:**

- Test individual functions/components
- Mock Prisma queries
- Schema validation tests

**Integration Testing:**

- Test API endpoints
- Real database (test database)
- Authentication flow
- Error scenarios

**E2E Testing:**

- Test complete user workflows
- Frontend + Backend + Database
- Real browser (Playwright/Cypress - future)

**Test Data:**

- Seed scripts for consistent data
- Transaction rollback per test
- Isolated test database

---

**Last Updated:** 2026-01-14 07:05
**Phase:** 3.2 - Unified Inbox & Conversation Management (Complete)
**Architecture Version:** 3.2
**Next Phase:** 3.3 - SMS Status Tracking & Delivery Notifications
