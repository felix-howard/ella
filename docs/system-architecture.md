# System Architecture

Ella employs a layered, monorepo-based architecture prioritizing modularity, type safety, and scalability.

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│         Frontend Layer (React)                    │
│   apps/portal & apps/workspace                   │
│   - Client upload portal & staff dashboard      │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓ HTTP/REST API calls
┌──────────────────────────────────────────────────┐
│      Backend Layer (Hono API Server)             │
│   apps/api/src - REST endpoints + webhooks      │
└──────────────────┬───────────────────────────────┘
                   │
         ┌─────────┴──────────┐
         ↓                    ↓
┌─────────────────┐  ┌──────────────────────────┐
│ Prisma ORM      │  │ Inngest Cloud Platform   │
│ (Database)      │  │ (Background Jobs)        │
└────────┬────────┘  └──────────┬───────────────┘
         │                      │
         ↓                      ↓
┌──────────────────────────────────────────────────┐
│     Data Layer (PostgreSQL + Job Queue)          │
│  - Tax cases, documents, messages                │
│  - Background job execution log                  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│   Shared Packages (Monorepo Utilities)           │
│  ├─ @ella/db - Database & Prisma client         │
│  ├─ @ella/shared - Types & validation schemas   │
│  └─ @ella/ui - Component library                │
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

**Implemented Endpoints (36 total):**

**Clients (6):**
- `GET /clients` - List with search/status filters, pagination (PHASE 2: Real API calls)
- `POST /clients` - Create client + profile + case + magic link + checklist + SMS welcome
- `GET /clients/:id` - Client with profile, tax cases, portalUrl, smsEnabled flag
- `PATCH /clients/:id` - Update name/phone/email/language
- `POST /clients/:id/resend-sms` - Resend welcome message with magic link (requires PORTAL_URL)
- `DELETE /clients/:id` - Delete client

**Tax Cases (7 - Phase 2 additions):**
- `GET /cases` - List with status/year/client filters, pagination
- `POST /cases` - Create new case
- `GET /cases/:id` - Case details with document counts
- `PATCH /cases/:id` - Update status/metadata with transition validation (PHASE 2)
- `GET /cases/:id/checklist` - Dynamic checklist from profile & templates
- `GET /cases/:id/images` - Raw images for case with pagination
- `GET /cases/:id/valid-transitions` - Get valid status transitions for case (PHASE 2 NEW)

**Digital Documents (10 - Phase 2 + Phase 03 + Phase 04 additions):**
- `GET /docs/:id` - Document details with extracted data
- `POST /docs/:id/classify` - AI classify raw image to docType
- `POST /docs/:id/ocr` - Trigger OCR for data extraction
- `PATCH /docs/:id/verify` - Verify/edit extracted data with notes
- `POST /docs/:id/verify-action` - Quick verify or reject action (PHASE 2 NEW)
- `GET /cases/:id/docs` - Get digital docs for case with pagination (PHASE 2 NEW)
- `GET /docs/groups/:groupId` - Get image group with all duplicate images (PHASE 03 NEW)
- `POST /docs/groups/:groupId/select-best` - Select best image from duplicate group (PHASE 03 NEW)
- `GET /docs/groups/case/:caseId` - Get all image groups for case (PHASE 03 NEW)

**Raw Images (1 - Phase 04 NEW):**
- `PATCH /images/:id/classification` - CPA review & approve/reject AI classification (PHASE 04 NEW)

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

## Background Job Processing (Inngest)

**Purpose:** Reliable, scalable background job execution for long-running tasks like AI document classification, OCR extraction, and batch processing.

### Architecture

```
Document Upload Event
        ↓
POST /portal/:token/upload
        ↓
Create RawImage record
        ↓
Emit: inngest.send({ name: 'document/uploaded', data: {...} })
        ↓
Inngest Cloud receives event
        ↓
Matches event to classifyDocumentJob trigger
        ↓
Execute classifyDocumentJob with retry logic (3 retries)
        ↓
Steps (5 durable steps):
  1. Fetch image from R2
  2. Classify with Gemini (docType + confidence)
  3. Route by confidence (>85% auto-link, 60-85% review, <60% unclassified)
  4. Detect duplicates via pHash & group (Phase 03)
  5. OCR extraction if confidence >= 60%
        ↓
Emit: document/classification.complete event
        ↓
Frontend polls /messages/conversations for updates (Phase 05)
```

### Inngest Client & Configuration

**Singleton Pattern (`apps/api/src/lib/inngest.ts`):**
```typescript
export const inngest = new Inngest({
  id: 'ella',
})
```

**Type-Safe Events:**
- `document/uploaded` - Triggered on file upload
- `document/classification.complete` - Fired on completion (Phase 05)

### Inngest Route

**Endpoint:** `POST/GET/PUT /api/inngest`

**Responsibilities:**
- Register all Inngest functions from `jobs/` directory
- Handle function discovery & invocation
- Validate signing key (prevents unauthorized triggers)
- Serve development UI for monitoring
- Production security: Blocks jobs if INNGEST_SIGNING_KEY missing

**Configuration:**
```typescript
serve({
  client: inngest,
  functions: [classifyDocumentJob],
  signingKey: config.inngest.signingKey || undefined,
})

// Production safety check
if (!config.inngest.isProductionReady) {
  return c.json({ error: 'Inngest not configured' }, 503)
}
```

### Background Jobs - Phase 02 Implementation

**classifyDocumentJob** (`apps/api/src/jobs/classify-document.ts`)

**Configuration:**
- **ID:** `classify-document`
- **Trigger:** `document/uploaded` event
- **Retries:** 3 (exponential backoff)
- **Throttle:** 10 req/min (Gemini rate limit protection)
- **Status:** Production ready

**Durable Step Structure:**

1. **mark-processing** - Update RawImage.status = PROCESSING
2. **fetch-image** - Retrieve image from R2 via signed URL
   - Returns: { buffer: base64, mimeType }
3. **classify** - Gemini vision classification
   - Returns: { success, docType, confidence, reasoning }
4. **route-by-confidence** - Route by confidence thresholds
   - < 60%: UNCLASSIFIED, create AI_FAILED action
   - 60-85%: CLASSIFIED, create VERIFY_DOCS action
   - >= 85%: CLASSIFIED, auto-link, no action
   - Returns: { action, needsOcr, checklistItemId }
5. **detect-duplicates** - Perceptual hash grouping (Phase 03)
   - Generate 64-bit pHash from image
   - Find existing duplicates via Hamming distance (threshold: <10 bits)
   - Create/join ImageGroup if duplicate found
   - Returns: { grouped, groupId, isNewGroup, imageCount }
6. **ocr-extract** - Conditional OCR extraction (if confidence >= 60%)
   - Extract structured data with confidence score
   - Atomic DB transaction: upsert DigitalDoc + update ChecklistItem + mark LINKED
   - Returns: { digitalDocId }

**Return Value:**
```typescript
{
  rawImageId: string
  classification: { docType: DocType, confidence: number }
  routing: 'auto-linked' | 'needs-review' | 'unclassified'
  grouping: {
    grouped: boolean
    groupId: string | null
    imageCount: number
  }
  digitalDocId?: string
}
```

### Environment Configuration

**Required (Production):**
```bash
INNGEST_SIGNING_KEY=<generated-key>  # Validates cloud requests
```

**Optional (Local Dev):**
```bash
INNGEST_EVENT_KEY=<event-api-key>   # For sending events to cloud
```

**Config Structure:**
```typescript
inngest: {
  eventKey: string,         // Optional: cloud event API key
  signingKey: string,       // Required in production
  isConfigured: boolean,    // true if eventKey set
  isProductionReady: boolean // Enforces signingKey in prod
}
```

### Security & Reliability (Phase 06)

**Edge Case Handling:**
- **Idempotency Check:** Skip if rawImage.status ≠ UPLOADED (prevents duplicate Inngest retries)
- **Image Resize:** Sharp auto-downsize for files > 4MB (prevents Gemini timeout)
- **Hard Size Limit:** 20MB buffer enforced (DoS prevention)
- **Service Unavailability Detection:** Pattern match on "503", "overloaded", "resource exhausted" → retry with HIGH priority action
- **Error Message Sanitization:** Remove API keys, emails, file paths from stored errors (info disclosure prevention)

**Signing Key Validation:**
- All requests from Inngest cloud validated with signing key
- Prevents unauthorized job triggers
- Required in production deployments
- Optional in local development

**Public Route:**
- `/api/inngest` is intentionally public (no auth required)
- Allows Inngest cloud to invoke jobs reliably
- Protected by signing key, not authentication

### Event Flow Integration

**Document Upload Triggering Jobs:**
```typescript
// In portal upload route:
await inngest.send({
  name: 'document/uploaded',
  data: {
    rawImageId,
    caseId,
    r2Key,
    mimeType,
    uploadedAt: new Date().toISOString(),
  },
})
```

**Phase 02 Implementation Plan:**
- Fetch image buffer from R2 via signed URL
- Call Gemini classification with image
- Extract document type + confidence score
- If high confidence: Trigger OCR extraction job
- If low confidence: Create VERIFY_DOCS action
- Update RawImage + ChecklistItem status
- Emit completion event for real-time frontend updates

## Data Flow

### Phase 2: Case Status Transition & Document Verification Flow

```
Staff views Client Detail Page
        ↓
Frontend loads case with status & documents
        ↓
GET /cases/:id/valid-transitions (or use shared constants)
        ↓
StatusSelector component renders valid transitions
        ↓
Staff clicks status dropdown
        ↓
Frontend calls PATCH /cases/:id { status: "WAITING_DOCS" }
        ↓
Backend validates transition via isValidStatusTransition()
        ↓
If invalid:
├─ Return 400 with valid transitions
└─ Frontend shows error + available options
        ↓
If valid:
├─ Update TaxCase.status
├─ If status === ENTRY_COMPLETE: Set entryCompletedAt timestamp
├─ If status === FILED: Set filedAt timestamp
└─ Return 200 with updated case
        ↓
Frontend toast: "Đã cập nhật trạng thái: [New Status]"
        ↓
Staff views pending documents
        ↓
Frontend loads case documents (status: PENDING|EXTRACTED|PARTIAL)
        ↓
GET /cases/:id/docs { page: 1, limit: 20 }
        ↓
VerificationPanel lists documents with:
├─ Document type & confidence %
├─ Extracted data preview
├─ Verify button & Reject button
└─ Loading states during actions
        ↓
Staff clicks Verify button
        ↓
Frontend calls POST /docs/:id/verify-action { action: "verify" }
        ↓
Backend atomic transaction:
├─ Update DigitalDoc.status = VERIFIED
├─ Update ChecklistItem.status = VERIFIED
├─ Set verifiedAt timestamp
└─ Commit all changes
        ↓
Frontend toast: "Đã xác minh tài liệu"
        ↓
VerificationPanel refresh removes document from list
        ↓
---
        ↓
Alternative: Staff clicks Reject button
        ↓
Staff enters reject reason/notes
        ↓
Frontend calls POST /docs/:id/verify-action { action: "reject", notes: "..." }
        ↓
Backend atomic transaction:
├─ Update DigitalDoc.status = PENDING
├─ Update RawImage.status = BLURRY
├─ Create Action { type: BLURRY_DETECTED, priority: HIGH }
└─ Store notes in Action metadata
        ↓
Frontend toast: "Đã từ chối tài liệu"
        ↓
Action appears in queue with "Yêu cầu gửi lại tài liệu"
        ↓
Staff can send SMS reminder to client via Messages
        ↓
Client receives SMS: "Document rejected - please resend"
        ↓
Case returns to WAITING_DOCS or IN_PROGRESS
```

**Phase 2 Key Guarantees:**
- Status transitions enforced (no invalid states)
- All-or-nothing document verification (atomic)
- Audit trail via timestamps & actions
- Clear user feedback via toast notifications
- Debounced search prevents API overload

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

### Document Upload Flow (Portal - Magic Link)

**See:** [portal-enhanced-uploader.md](./portal-enhanced-uploader.md) for detailed component documentation

```
Client Portal (Magic Link Token)
        ↓
POST /portal/:token (validate token & fetch case data)
        ↓
User selects files via:
├─ Mobile: Camera capture or Gallery picker
└─ Desktop: Drag & drop or click to browse
        ↓
EnhancedUploader validates files:
├─ Type: JPEG, PNG, GIF, WebP, PDF
├─ Size: ≤ 10MB each
└─ Count: ≤ 20 files per batch
        ↓
File preview grid shows selected files
        ↓
User clicks Upload button
        ↓
XHR-based upload with progress tracking:
├─ onprogress fires real-time updates (0-100%)
├─ Progress bar & overlay on each file
└─ All files uploaded as single batch
        ↓
POST /portal/:token/upload (multipart/form-data)
        ↓
Backend validates token + file integrity
        ↓
Create RawImage records (status: UPLOADED)
        ↓
Return UploadResponse { uploaded, images[], message }
        ↓
Frontend shows success state:
├─ Checkmark overlay on completed files
├─ Success page with upload count
└─ Option to upload more or return to status
        ↓
On error (network or server):
├─ Network errors: Auto-retry (up to 2 retries, exponential backoff)
├─ Server errors: Show error message, allow manual retry
└─ File state marked as 'error' with visual indicator
```

**Retry Logic:**
- Only retries on transient network errors (`NETWORK_ERROR`, status 0)
- Server errors (429, 500, etc.) are not retried
- Max 2 automatic retries before user intervention
- User can manually retry after error

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

### AI Document Processing Pipeline Flow - Phase 02 Implementation

```
Client Uploads Documents via Portal
        ↓
POST /portal/:token/upload (multipart form)
        ↓
1. Validate files (type, size, count ≤20)
2. Upload each file to R2 storage
3. Create RawImage record (status: UPLOADED)
4. Emit inngest.send({ name: 'document/uploaded', data: {...} })
5. Return { uploaded: N, aiProcessing: true, ... }
        ↓
[Inngest Cloud Processing]
Receive document/uploaded event batch
        ↓
Match to classifyDocumentJob function
Execute with:
  - 3 retries (exponential backoff)
  - 10 req/min throttle (Gemini rate limit)
        ↓
[DURABLE STEP 1: mark-processing]
Update RawImage.status = PROCESSING
        ↓
[DURABLE STEP 2: fetch-image]
├─ Generate signed R2 URL (1hr expiry)
├─ Fetch image via HTTP
├─ Base64 encode for step durability
└─ Return { buffer, mimeType }
        ↓
[DURABLE STEP 3: classify]
├─ Decode base64 buffer
├─ Call classifyDocument() (Gemini vision)
├─ Extract { docType, confidence, reasoning }
└─ Return classification result
        ↓
[DURABLE STEP 4: route-by-confidence]
Confidence < 60%:
  ├─ Update RawImage.status = UNCLASSIFIED
  ├─ Create AI_FAILED action (NORMAL priority)
  └─ Return { action: 'unclassified', needsOcr: false }
        ↓
Confidence 60-85%:
  ├─ Update RawImage.status = CLASSIFIED
  ├─ Link to ChecklistItem (auto-link)
  ├─ Create VERIFY_DOCS action (NORMAL priority)
  │  Title: "Xác minh phân loại"
  │  Description: "{DocType}: {Confidence}% - cần xác minh"
  └─ Return { action: 'needs-review', needsOcr: true/false }
        ↓
Confidence >= 85%:
  ├─ Update RawImage.status = CLASSIFIED
  ├─ Link to ChecklistItem (auto-link)
  ├─ No action created (silent success)
  └─ Return { action: 'auto-linked', needsOcr: true/false }
        ↓
[DURABLE STEP 5: ocr-extract] (conditional)
If needsOcr && docType supports OCR:
  ├─ Decode base64 buffer
  ├─ Call extractDocumentData() (Gemini vision + prompts)
  ├─ Validate extracted JSON against schema
  └─ Call processOcrResultAtomic() for atomic DB update
        ↓
[Atomic Transaction]
All-or-nothing commit:
  ├─ Upsert DigitalDoc with extracted fields
  ├─ Update ChecklistItem.status = HAS_DIGITAL
  ├─ Mark RawImage.status = LINKED
  └─ No partial states possible
        ↓
[Action Creation Summary]
AI_FAILED → Classification failed (confidence < 60%)
  ├─ Priority: NORMAL
  ├─ Title: "Phân loại tự động thất bại"
  └─ Metadata: error message, confidence, r2Key
        ↓
VERIFY_DOCS → Medium confidence (60-85%) OR OCR validation needed
  ├─ Priority: NORMAL
  ├─ Title: "Xác minh phân loại" or "Xác minh dữ liệu OCR"
  └─ Metadata: docType, confidence, checklistItemId
        ↓
(None) → Auto-linked (confidence >= 85%)
  └─ Silent success, document processing complete
        ↓
[Portal Status Update]
Real-time checklist reflects:
  ├─ Received: Classified & verified documents
  ├─ Blurry: Images flagged for resend (future blur detection)
  └─ Missing: Still-needed documents
        ↓
[Workspace Action Queue]
Staff views actions:
  ├─ AI_FAILED → Manual classification required
  ├─ VERIFY_DOCS → Review auto-classification
  └─ HIGH priority for issues, NORMAL for review

**Error Handling:**
Transient errors (timeout, rate limit, 500/502/503):
  └─ Auto-retry up to 3 times (1s → 2s → 4s backoff)
        ↓
Non-transient errors (invalid format, missing API key):
  └─ Single attempt, create AI_FAILED action
        ↓
Validation errors (OCR confidence < 0.85):
  └─ No retry, create VERIFY_DOCS action

**Concurrency & Performance:**
- Inngest throttle: 10 jobs/min (Gemini protection)
- Per-image steps: Sequential (classify → route → ocr → atomic)
- Batch uploads: Each image independent job
- Total time/image: 2-5s (varies with Gemini latency)

**Supported Document Types for OCR:**
- W2 (employment income)
- 1099-INT (interest income)
- 1099-NEC (contractor compensation)
- SSN_CARD (Social Security card)
- DRIVER_LICENSE (state ID)
- Future (Phase 3.1): 1099-DIV, 1099-K, 1099-R
```

### Real-Time Updates & Notifications Flow - Phase 05 Implementation

```
Staff Views Client Documents Tab
        ↓
useClassificationUpdates() hook activates
        ↓
Query: GET /cases/:id/images
        ↓
React Query polling: every 5 seconds (only when tab active)
        ↓
Image States Tracked:
├─ UPLOADED → Processing initiated
├─ PROCESSING → AI classification running
├─ CLASSIFIED → AI complete (show confidence)
├─ LINKED → Auto-linked to checklist
├─ UNCLASSIFIED → Low confidence (<60%)
└─ BLURRY → Quality issues detected
        ↓
Compare current state vs previous state
        ↓
Status Change Detected:
├─ UPLOADED → PROCESSING: Show FloatingPanel "Đang xử lý N ảnh..."
├─ PROCESSING → CLASSIFIED:
│  ├─ HIGH (85%+): toast.success("W2 (95%)")
│  ├─ MEDIUM (60-85%): toast.info("Cần xác minh: 1099-NEC (72%)")
│  └─ LOW (<60%): toast.info("Độ tin cậy thấp")
├─ PROCESSING → LINKED: toast.success("Đã liên kết: W2")
├─ PROCESSING → UNCLASSIFIED: toast.info("Cần xem xét: filename")
└─ PROCESSING → BLURRY: toast.error("Ảnh mờ: filename")
        ↓
Gallery UI Updates:
├─ PROCESSING badge appears (Loader2 icon, animated)
├─ Confidence badge shows (HIGH/MEDIUM/LOW color)
├─ Image preview refreshes
└─ Review button toggles based on confidence
        ↓
Invalidate Related Queries:
├─ queryClient.invalidateQueries(['checklist', caseId])
├─ RawImageGallery re-renders
└─ ChecklistGrid reflects new status
        ↓
FloatingPanel Auto-Hides:
└─ When processingCount === 0
        ↓
Poll Stops (unsubscribe):
└─ When documents tab inactive or component unmounts

**Performance Notes:**
- refetchIntervalInBackground: false (battery/bandwidth friendly)
- Skip notifications on initial mount (prevents noise)
- Memory cleanup: previousImagesRef.clear() on unmount
- State comparison prevents duplicate notifications
- Debounced polling (5s interval, not per-update)

**Components:**
- useClassificationUpdates() - Polling hook with state tracking
- UploadProgress - Floating panel showing processing count
- RawImageGallery - Display with PROCESSING status badge
- Client Detail - Route that integrates polling + notifications
```

## Database Schema (Phase 1.1 - Complete)

**Core Models (13):**

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
├── rawImages, digitalDocs, checklistItems, imageGroups (1:many)
├── conversation, magicLinks, actions (1:many)
├── Timestamps: lastContactAt, entryCompletedAt, filedAt

RawImage - Document uploads
├── caseId, r2Key, r2Url, filename, fileSize
├── status (UPLOADED→LINKED), classifiedType, aiConfidence, blurScore
├── imageHash (pHash for duplicates), imageGroupId (duplicate grouping)
├── uploadedVia (SMS|PORTAL|SYSTEM)

ImageGroup - Duplicate document grouping (Phase 03)
├── caseId, docType, bestImageId (selected best image)
├── images (1:many RawImage), timestamps

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

## Authentication & Authorization (Phase 3)

### JWT Authentication Flow

```
User Login Form
        ↓
POST /api/auth/login (email + password)
        ↓
Backend validates credentials via bcrypt
        ↓
Query User from database
        ↓
Generate access token (JWT, 15m default)
        ↓
Generate refresh token (opaque, hashed, 7-day default)
        ↓
Return accessToken + refreshToken to client
        ↓
Client stores tokens (localStorage/cookie)
        ↓
Client attaches "Authorization: Bearer <accessToken>" to requests
        ↓
authMiddleware verifies JWT signature & expiry
        ↓
If valid: Set user context, proceed to route handler
If invalid/expired: Return 401, client triggers refresh flow
        ↓
Client calls POST /api/auth/refresh with refreshToken
        ↓
Backend validates refresh token (check hash, expiry, revocation)
        ↓
Backend rotates: revoke old token, issue new refresh token
        ↓
Return new accessToken + new refreshToken
        ↓
Client updates stored tokens, retry original request
```

### Database Models

**User Model (Phase 3)**
```
- id (cuid) - Primary key
- email (unique) - Staff email
- password (string) - bcrypt hashed (12 rounds)
- name (string) - Full name
- role (enum) - ADMIN | STAFF | CPA
- avatarUrl (optional) - Profile photo
- isActive (bool) - Deactivation flag
- lastLoginAt (datetime) - Audit trail
- createdAt, updatedAt - Timestamps
- refreshTokens (1:many) - Active refresh tokens
- actions (1:many) - Assigned tasks
```

**RefreshToken Model (Phase 3)**
```
- id (cuid) - Primary key
- userId (foreign key) - User reference
- token (unique) - SHA-256 hashed opaque token
- expiresAt (datetime) - Token expiry (default: 7 days)
- revokedAt (datetime, optional) - Revocation timestamp
- createdAt (datetime) - Issue timestamp
- Indexes: userId, token, expiresAt (cleanup queries)
- Cascade delete with user
```

### Auth Service (`src/services/auth/index.ts`)

**Core Functions:**

```typescript
// Password management
hashPassword(password) → bcrypt hashed (12 rounds)
verifyPassword(password, hashed) → boolean

// Access token (JWT, 15 min default)
generateAccessToken(user) → JWT {sub, email, name, role, exp, iat}
verifyAccessToken(token) → JWTPayload | null

// Refresh token (opaque, hashed, 7 days default)
generateRefreshToken(userId) → raw token string
verifyRefreshToken(rawToken) → {userId} | null
rotateRefreshToken(oldToken, expectedUserId) → new raw token
  - Validates token ownership before rotation
  - Revokes old token
  - Issues new token

// Token lifecycle
revokeAllTokens(userId) → void (logout everywhere)
cleanupExpiredTokens() → count (maintenance job)

// Combined auth flow
generateAuthTokens(user) → {accessToken, refreshToken}
```

**Security Measures:**
- Bcrypt rounds: 12 (industry standard, ~250ms)
- Token hashing: SHA-256 for refresh token storage
- Token ownership validation: Prevents token reuse attack
- Expiry validation: Checked during verification
- Revocation support: Per-token and global

### Auth Middleware (`src/middleware/auth.ts`)

**Middleware Types:**

```typescript
// Enforces authentication - returns 401 if no valid token
authMiddleware - Sets user context {id, email, role, name}

// Optional - sets user if valid token, continues without if not
optionalAuthMiddleware - Partial<AuthVariables>

// Role-based access control factory
requireRole(...allowedRoles) - Returns middleware for role checking

// Convenience exports
adminOnly → requireRole('ADMIN')
staffOrAdmin → requireRole('ADMIN', 'STAFF')
cpaOrAdmin → requireRole('ADMIN', 'CPA')
```

**Usage:**
```typescript
// Protect single route
app.get('/admin/users', authMiddleware, adminOnly, handler)

// Protect route group
app.use('/admin/*', authMiddleware, adminOnly)

// Optional auth
app.get('/public/data', optionalAuthMiddleware, handler)
```

**Error Responses:**
- 401 "Yêu cầu xác thực" (Vietnamese) - Missing/invalid token
- 401 "Token không hợp lệ hoặc đã hết hạn" - Expired token
- 403 "Không đủ quyền truy cập" - Insufficient role

### Configuration (`src/lib/config.ts`)

```typescript
auth: {
  jwtSecret: string         // From JWT_SECRET env (min 32 chars, required in prod)
  jwtExpiresIn: string      // From JWT_EXPIRES_IN env (default: 15m)
                            // Supports: 15m, 1h, 7d, etc.
  refreshTokenExpiresDays: number  // From REFRESH_TOKEN_EXPIRES_DAYS (default: 7)
  isConfigured: boolean     // JWT_SECRET length >= 32
}

scheduler: {
  enabled: boolean          // From SCHEDULER_ENABLED (default: false)
  reminderCron: string      // From REMINDER_CRON (default: 0 2 * * *)
}
```

**Security Validation:**
- Production: JWT_SECRET must be >= 32 chars, throws on missing
- Development: Uses insecure default ("development-secret-change-in-prod-32chars!")
- Console warning in dev if using insecure secret

## Security Architecture

**Authentication:**

- JWT tokens for stateless auth (15m default expiry)
- Secure refresh token rotation with ownership validation
- Password hashing with bcrypt (12 rounds, ~250ms)
- Token hashing: SHA-256 for refresh tokens in storage

**Authorization:**

- Role-based access control (RBAC) via middleware
- Three roles: ADMIN, STAFF, CPA
- Middleware enforces at route level
- Resource-level authorization via business logic

**Data Protection:**

- HTTPS enforced
- SQL injection prevention (Prisma parameterized queries)
- CSRF protection (SameSite cookies)
- Input validation (Zod schemas)
- Audit logging for compliance

**Sensitive Data:**

- JWT_SECRET required (min 32 chars in production)
- Refresh tokens hashed before storage
- Password hashing with strong algorithm
- PII masked in logs
- Secrets in environment variables only

**Token Security:**

- Refresh token revocation: Individual or global (logout everywhere)
- Token expiry validation: Checked on every request
- Token ownership validation: Prevents reuse attacks
- Expired token cleanup: Automatic maintenance job
- No token data in logs

## Testing Architecture (Phase 06)

### Unit Testing

**Document Classifier Tests (17 tests)**
- Classification accuracy (W2, 1099-INT, 1099-NEC, etc.)
- Low confidence handling (< 60%)
- Unsupported mime type validation
- Gemini API failure recovery
- Batch classification with concurrency

**Document Pipeline Tests (11 tests)**
- Image resizing for files > 4MB
- Confidence-based routing (auto-link, review, unclassified)
- Idempotency checks (prevent duplicate processing)
- Duplicate detection via pHash
- OCR extraction conditional logic

### Testing Infrastructure

**Vitest Configuration:**
- Environment: Node.js
- Pattern: `src/**/__tests__/**/*.test.ts`
- Coverage: Services + Jobs (excludes prompts)
- Timeout: 30s (for Gemini simulations)

**Mocking Strategy:**
- Mock Inngest, Prisma, R2 storage, Gemini API
- Mock sharp for image processing
- Mock duplicate detector service
- Type-safe mocks with vi.mocked()

### Test Coverage

| Module | Tests | Focus |
|--------|-------|-------|
| document-classifier | 8 | Classification, error handling, batch ops |
| ocr-extractor | 3 | Field extraction, validation, confidence |
| duplicate-detector | 2 | pHash generation, group assignment |
| classify-document job | 11 | Workflow integration, edge cases, retry logic |

### Integration Testing

**Classify-Document Job Tests:**
- Full pipeline flow: fetch → classify → route → duplicate detect → OCR
- Image resize handling for 4MB+ files
- Idempotency on duplicate events
- Gemini service unavailability detection
- Atomic transaction verification
- Action creation for failed classifications

**Error Scenarios Covered:**
- Missing images in R2
- Corrupted/invalid image data
- Gemini rate limiting (503, overloaded)
- Image size violations (20MB hard limit)
- Duplicate event processing (Inngest retries)
- OCR validation failures

### Test Data

- Seed scripts for consistent data
- Transaction rollback per test
- Isolated test database
- Mock image buffers (JPEG magic bytes)

---

**Last Updated:** 2026-01-15
**Phase:** Phase 06 - Testing Infrastructure & Edge Case Handling (Complete)
**Architecture Version:** 6.0 (Tested & Resilient)
**Completed Features (Phase 06):**
- ✓ Vitest unit testing setup for AI services
- ✓ Integration tests for classify-document job (17 tests total)
- ✓ Idempotency checks for Inngest duplicate events
- ✓ Image resize for files >4MB using sharp (prevents Gemini timeout)
- ✓ 20MB hard size limit enforcement (DoS prevention)
- ✓ Gemini service unavailability detection with retry logic
- ✓ Error message sanitization (API keys, emails, paths masked)
- ✓ AI_FAILED action creation for CPA manual review
**Completed Features (Phase 05):**
- ✓ Classification updates hook with 5s polling
- ✓ Real-time status tracking (UPLOADED → PROCESSING → CLASSIFIED/LINKED)
- ✓ Confidence-level notifications (HIGH/MEDIUM/LOW toasts)
- ✓ Floating status panel (UploadProgress component)
- ✓ PROCESSING image overlay in gallery
- ✓ Tab-aware polling (stops when inactive, battery-friendly)
- ✓ Automatic checklist refresh on image linking
- ✓ Memory leak prevention (cleanup on unmount)
- ✓ Initial load noise prevention
- ✓ State comparison to prevent duplicate notifications
**Completed Features (Phase 04):**
- ✓ Confidence-level system (HIGH/MEDIUM/LOW with thresholds)
- ✓ Confidence badges in image gallery
- ✓ Classification review modal for CPA verification
- ✓ Approve/reject workflow with optimistic updates
- ✓ XSS-safe signed URL validation
- ✓ Atomic database transactions (RawImage + ChecklistItem + DigitalDoc)
- ✓ BLURRY_DETECTED action creation on rejection
- ✓ Keyboard shortcuts (Enter/Esc)
- ✓ Toast notifications (success/error)
- ✓ React Query integration with cache invalidation
- ✓ 21 supported document types in selector
**Next Phase:** Phase 05.1 - WebSocket Real-time (Replace Polling)
