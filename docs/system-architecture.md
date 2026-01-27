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
  - Client detail: 2-tab layout (Overview, Documents) + Header messaging button
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
- Client/case management with messaging (inline "Tin nhắn" header button with unread badge)
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

- Entry: `src/index.ts` (serves on PORT 3002, validates Gemini on startup Phase 02)
- App config: `src/app.ts` (main Hono app instance & all routes)
- Middleware: `src/middleware/error-handler.ts` (global error handling)
- Lib: `src/lib/db.ts` (Prisma re-export), `src/lib/constants.ts` (pagination, Vietnamese labels)
- Routes: `src/routes/{clients,cases,docs,actions,messages,portal,health}/` (modular endpoints)
- Services: `src/services/{checklist-generator,magic-link,storage,ai/gemini-client}.ts` (business logic + AI validation)

**Build & Deployment:**

- Dev: `pnpm -F @ella/api dev` (tsx watch for hot reload)
- Build: `pnpm -F @ella/api build` (tsup → ESM + type defs)
- Start: `pnpm -F @ella/api start` (runs dist/index.js)

**Implemented Endpoints (58 total - Phase 01-04 Voice + Phase 2 Actionable Status + Phase 4 Engagements):**

**Tax Engagements (6 - Phase 4 NEW: Multi-year client support):**
- `GET /engagements` - List engagements with clientId/taxYear/status filters, pagination
- `GET /engagements/:id` - Engagement details with client info & related tax cases
- `POST /engagements` - Create engagement (with optional copy-from for year-to-year profile reuse)
- `PATCH /engagements/:id` - Update engagement profile (status, filing info, intake answers with merge logic)
- `DELETE /engagements/:id` - Delete engagement if no tax cases exist (prevents orphaned data)
- `GET /engagements/:id/copy-preview` - Preview copyable fields from engagement (excludes intakeAnswers for privacy)

**Voice Management (10 - Phase 01-04 Voice Calls):**
- `POST /voice/token` - Generate staff access token with VoiceGrant (outbound + inbound)
- `GET /voice/status` - Check voice feature availability
- `POST /voice/presence/register` - Register staff as online (Phase 01)
- `POST /voice/presence/unregister` - Mark staff offline (Phase 01)
- `POST /voice/presence/heartbeat` - Update lastSeen to keep presence alive (Phase 01)
- `GET /voice/caller/:phone` - Lookup caller info for incoming call UI (Phase 01)
- `POST /voice/calls` - Create outbound call message record
- `PATCH /voice/calls/:messageId` - Update with Twilio CallSid
- `GET /voice/recordings/:recordingSid` - Recording metadata with auth
- `GET /voice/recordings/:recordingSid/audio` - Proxied audio stream (auth + secure)

**Checklist Management (4 - Phase 4 NEW):**
- `POST /cases/:id/checklist/items` - Add manual checklist item (staff override)
- `PATCH /cases/:id/checklist/items/:itemId/skip` - Skip item (mark NOT_REQUIRED)
- `PATCH /cases/:id/checklist/items/:itemId/unskip` - Restore skipped item
- `PATCH /cases/:id/checklist/items/:itemId/notes` - Update item notes

**Clients (7 - Phase 2 NEW: +2 enhanced with actionable status):**
- `GET /clients` - List with **sort param** (activity/name), returns **ClientWithActions** with computed status & action badges
- `POST /clients` - Create client + profile + case + magic link + checklist + SMS welcome
- `GET /clients/:id` - Client with profile, tax cases, portalUrl, smsEnabled flag
- `PATCH /clients/:id` - Update name/phone/email/language
- `PATCH /clients/:id/profile` - Update client profile (intakeAnswers + filingStatus) with audit logging
- `POST /clients/:id/resend-sms` - Resend welcome message with magic link (requires PORTAL_URL)
- `DELETE /clients/:id` - Delete client

**Tax Cases (10 - Phase 2 NEW: +3 status action endpoints; Phase 4: engagementId FK):**
- `GET /cases` - List with status/year/client filters (NOTE: clientId deprecated; use engagementId), pagination
- `POST /cases` - Create new case (now supports engagementId FK instead of direct clientId)
- `GET /cases/:id` - Case details with document counts, **isInReview/isFiled flags**, lastActivityAt, engagementId
- `PATCH /cases/:id` - Update status/metadata with transition validation (engagementId support)
- `POST /cases/:id/send-to-review` - Move case to REVIEW state (Phase 2 NEW)
- `POST /cases/:id/mark-filed` - Mark case as FILED with filedAt timestamp (Phase 2 NEW)
- `POST /cases/:id/reopen` - Reopen filed case, returns to REVIEW (Phase 2 NEW)
- `GET /cases/:id/checklist` - Dynamic checklist from profile & templates
- `GET /cases/:id/images` - Raw images for case with pagination
- `GET /cases/:id/valid-transitions` - Get valid status transitions for case

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

**Messages (5, Phase 3.2 + UX Enhancement):**
- `GET /messages/conversations` - List all conversations with unread counts, pagination, last message preview
- `GET /messages/:caseId` - Conversation history (SMS/portal/system) with auto-reset unread
- `GET /messages/:caseId/unread` - Fetch unread count for specific case (efficient single-case query)
- `POST /messages/send` - Create message, support SMS/PORTAL/SYSTEM channels
- `POST /messages/remind/:caseId` - Send missing docs reminder to specific case

**Portal (2):**
- `GET /portal/:token` - Verify magic link, return case data for client
- `POST /portal/:token/upload` - Client document upload via magic link

**Webhooks - SMS (2, Phase 3.1):**
- `POST /webhooks/twilio/sms` - Incoming SMS handler (signature validation, rate limited 60/min)
- `POST /webhooks/twilio/status` - Message status updates (optional tracking)

**Health (1):**
- `GET /health` - Server status check with Gemini & PDF support (Phase 02, Phase 03)
  - Response includes: `status`, `timestamp`, `gemini`, `pdfSupport`, `supportedFormats`
  - **Gemini Status:**
    - `configured` (bool), `model` (string), `available` (bool), `checkedAt` (ISO timestamp), `error` (nullable)
    - `activeModel` (current working model) & `fallbackModels[]` array (Phase 03 Gemini fallback)
  - **PDF Support (Phase 03 NEW):**
    - `enabled` (bool), `maxSizeMB` (20), `maxPages` (10), `renderDpi` (200)
    - `popplerInstalled` (bool) - Critical: must be true for PDF processing
    - `popplerError` (nullable) - Error details if poppler unavailable
  - **Supported Formats:** Images (JPEG, PNG, etc.) & Documents (PDF)
  - Gemini validation runs non-blocking on startup; status cached for efficiency

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

**Core Services (Phase 1.2+):**

- `checklist-generator.ts` - Generate checklist from profile & templates (Phase 3: intakeAnswers priority)
- `magic-link.ts` - Create/validate passwordless access tokens
- `sms.ts` - SMS service with Twilio integration, welcome message & configuration checks
- `storage.ts` - R2 Cloudflare storage service (placeholder)
- `pdf/pdf-converter.ts` - PDF to PNG conversion for OCR processing (Phase 01)
- `audit-logger.ts` - Field-level change tracking for compliance & audit trails (Phase 01 NEW)

**Checklist Generator Service (Phase 3 - Enhanced):**

- **ConditionContext Interface:** Combines legacy profile fields + dynamic intakeAnswers (new)
- **Condition Evaluation:** Checks intakeAnswers first, falls back to profile fields
  - Prevents mismatches between questionnaire answers & legacy data
  - Supports AND logic across multiple conditions
  - JSON size limit: 10KB (DoS protection)
- **Expected Count Logic:** Uses intake answers for dynamic counts
  - W2: `w2Count` from intakeAnswers
  - Rental Property: `rentalPropertyCount` from intakeAnswers
  - Schedule K1: `k1Count` from intakeAnswers
  - Bank Statements: 12 months default
  - Fallback: template `expectedCount` or 1
- **intakeAnswers Validation:** Type-checked at runtime (must be plain object, not array)
- **Refresh Flow:** Preserves verified items, re-evaluates MISSING items only
- **15 Unit Tests:** Condition evaluation, AND logic, fallback behavior, invalid JSON, DoS protection

**Audit Logger Service (Phase 01 - NEW):**

**Location:** `apps/api/src/services/audit-logger.ts`

**Purpose:** Field-level change tracking for compliance, audit trails, and data governance (IRS 7-year retention requirement).

**Key Features:**
- Non-blocking async logging (doesn't slow down API responses via fire-and-forget pattern)
- Batch insert for efficiency (Prisma createMany)
- Field-level granularity (tracks individual field changes, not entire records)
- Support for nested JSON fields (intakeAnswers partial updates)
- Staff attribution (tracks who made changes and when)
- Error resilience with structured logging

**Core Functions:**

1. **logProfileChanges(clientId, changes[], staffId?)** - Log profile field changes asynchronously
   - `changes`: Array of `{ field, oldValue, newValue }`
   - Converts to AuditLog entries with CLIENT_PROFILE entity type
   - Handles Prisma.JsonNull for explicit null values
   - Fires as background task (non-blocking)

2. **computeIntakeAnswersDiff(oldAnswers, newAnswers)** - Compute changes for intake answers
   - Optimized: Only compares keys in newAnswers (partial update pattern)
   - Returns only changed fields with old/new values
   - Uses JSON.stringify for deep equality on primitives

3. **computeProfileFieldDiff(oldProfile, newProfile)** - Compute direct profile field changes
   - Currently handles filingStatus field
   - Extensible to other scalar fields (e.g., businessName, ein)
   - Type-safe field comparison

**Integration with PATCH /clients/:id/profile:**
- Before database update: Compute all changes (intakeAnswers + direct fields)
- If changes exist: Log asynchronously via logProfileChanges()
- Response includes audit metadata
- No changes = no logging (efficiency optimization)

**Phase 4 Extension: Engagement Audit Logging**
- New function: **logEngagementChanges(engagementId, changes[], staffId?)** - Log TaxEngagement field changes
  - Tracks creation events (clientId, taxYear, copySource)
  - Tracks profile updates (filingStatus, intake answers, status transitions)
  - Uses AuditEntityType.TAX_ENGAGEMENT enum value
  - Non-blocking async pattern (fire-and-forget)
- New function: **computeEngagementDiff(oldEngagement, newEngagement)** - Compute field-level changes
  - Compares direct fields (filingStatus, hasW2, status, etc.)
  - Handles intakeAnswers merge logic (partial update)
  - Returns array of FieldChange objects
- Integration with POST/PATCH /engagements endpoints for compliance tracking

**Database Schema (AuditLog Model):**
```
id: cuid (primary key)
entityType: enum (CLIENT_PROFILE, CLIENT, TAX_CASE) - tracks entity type
entityId: string - references client/profile/case ID
field: string - field name that changed (e.g., "intakeAnswers.w2Count")
oldValue: Json? - previous value (null for new fields)
newValue: Json? - new value (null for deleted fields)
changedById: string? - Staff ID who made change
changedBy: Staff relation - join to staff for attribution
createdAt: timestamp - when change was logged

Indexes:
- (entityType, entityId) - efficient queries by entity
- (changedById) - audit by staff member
- (createdAt) - time-based queries, audit retention cleanup
```

**Error Handling:**
- Catches Prisma errors and logs with structured format
- Includes field names (for debugging) but excludes values (privacy)
- Non-critical: Audit log failures don't fail API requests
- Production: Consider sending critical errors to monitoring service (Sentry, DataDog)

**Usage Example:**
```typescript
// In PATCH /clients/:id/profile endpoint
const intakeChanges = computeIntakeAnswersDiff(oldAnswers, newAnswers)
const profileChanges = computeProfileFieldDiff(oldProfile, newProfile)
const allChanges = [...intakeChanges, ...profileChanges]

// Log asynchronously (fire-and-forget)
if (allChanges.length > 0) {
  logProfileChanges(clientId, allChanges, staffId).catch(err => {
    console.error('Audit logging failed:', err)
    // Don't throw - API response already sent
  })
}
```

**Compliance Considerations:**
- IRS 7-year record retention: Implement scheduled cleanup job
- Field masking: PII never stored in audit logs (values are audit records, not compliance records)
- Staff attribution: Enables user activity tracking for compliance audits
- Atomic updates: All changes for single request logged together

**Deprecation Headers Middleware (Phase 4 NEW):**

- Location: `src/middleware/deprecation.ts`
- Implements RFC 8594 deprecation standards
- Detects clientId usage in query params or URL paths
- Adds headers to deprecated API calls:
  - `Deprecation: true` - Signals deprecated endpoint
  - `Sunset: Wed, 25 Jul 2026 00:00:00 GMT` - Removal date (6 months)
  - `X-Deprecation-Reason` - Migration guidance (use engagementId instead)
  - `Link: </docs/api-migration>; rel="deprecation"` - Documentation link
- Helper function: **addDeprecationWarning()** - Adds warning to response body for deprecated fields
- Migration path: All clientId-based queries should transition to engagementId queries
- Sunset enforcement: System will remove clientId support after deadline

**SMS Service Implementation (Phase 1.2+):**

- Twilio API wrapper with E.164 phone formatting & error handling
- Welcome message template with magic link portal URL inclusion
- SMS enablement detection via environment variable check (TWILIO_ACCOUNT_SID)
- Resend SMS endpoint for client onboarding recovery
- Comprehensive error codes for missing configs (NO_MAGIC_LINK, SMS_NOT_CONFIGURED, PORTAL_URL_NOT_CONFIGURED)
- Vietnamese & English message support

**AI Service: Gemini Client with Model Fallback (Phase 03):**

- **Configuration (`src/lib/config.ts`):**
  - `GEMINI_MODEL`: Primary model (default: `gemini-2.5-flash`)
  - `GEMINI_FALLBACK_MODELS`: Comma-separated fallback list (default: `gemini-2.5-flash-lite,gemini-2.5-flash`)
  - `GEMINI_MAX_RETRIES`: Retry attempts per model (default: 3)
  - `GEMINI_RETRY_DELAY_MS`: Initial retry backoff (default: 1000ms, exponential)

- **Model Fallback Chain (`src/services/ai/gemini-client.ts`):**
  - Tries primary model first
  - Auto-falls back to alternatives on 404 "model not found" errors
  - Caches working model for session persistence
  - Skips already-tried fallback models during request

- **Functions:**
  - `generateContent(prompt, image?)` - Text/multimodal with fallback & retries
  - `generateJsonContent<T>(prompt, image?)` - JSON parsing with fallback
  - `analyzeImage<T>(buffer, mimeType, prompt)` - Vision analysis with validation
  - `validateGeminiModel()` - Startup health check with fallback validation
  - `getGeminiStatus()` - Returns: configured, model, activeModel, fallbackModels[], available, checkedAt

- **Fallback Logic:**
  - Primary model → Fallback 1 → Fallback 2 → ... → All failed error
  - Triggers fallback on 404/not found/does not exist/not supported patterns
  - Retries transient errors (rate limit, timeout, 500/502/503) up to maxRetries
  - Non-retryable errors fail immediately
  - Successful request caches working model for future calls

- **Error Patterns:**
  - Retryable: /rate.?limit/, /timeout/, /503/, /500/, /502/, /overloaded/, /resource.?exhausted/, /quota.?exceeded/, /service.?unavailable/
  - Model not found: /404/, /not found/, /model.*not.*found/, /does not exist/, /is not supported/

**Error Localization (Phase 04):**

- **Vietnamese Error Messages (`src/services/ai/ai-error-messages.ts`):**
  - Maps technical Gemini errors to 10 error types: MODEL_NOT_FOUND, RATE_LIMIT, QUOTA_EXCEEDED, SERVICE_UNAVAILABLE, INVALID_IMAGE, IMAGE_TOO_LARGE, TIMEOUT, CLASSIFICATION_FAILED, OCR_FAILED, UNKNOWN
  - Provides Vietnamese user-facing messages for each type with severity levels (info/warning/error)
  - ReDoS-safe regex patterns with non-greedy quantifiers
  - Null-safe input handling for robustness

- **Action Priority Calculation:**
  - Maps error severity → action priority (error → HIGH, warning/info → NORMAL)
  - Enables workspace to surface critical issues first

- **Error Sanitization:**
  - Removes API keys, email addresses, file paths from error metadata before storage
  - Prevents credential leakage in logs/database

- **Idempotency Fix (Phase 04):**
  - Atomic compare-and-swap on `RawImage.status` to prevent race conditions
  - Single database operation prevents concurrent processing of same image

**Document Classification Service (Phase 01 - Enhanced 2026-01-16):**

- **Classification Function:** `classifyDocument(imageBuffer, mimeType): Promise<DocumentClassificationResult>`
- **Prompt File:** `src/services/ai/prompts/classify.ts` - Enhanced with few-shot examples & calibration
- **Classifier Service:** `src/services/ai/document-classifier.ts` - Batch & single classification
- **Features:**
  - 6 few-shot examples (W-2, SSN Card, 1099-K, 1099-INT, 1099-NEC, Driver's License)
  - Vietnamese name handling (family name first, common surnames, ALL CAPS format)
  - Confidence calibration rules: HIGH (0.85-0.95), MEDIUM (0.60-0.84), LOW (<0.60), UNKNOWN (<0.30)
  - Alternative types returned when confidence <0.80
  - Processing time: 2-5s per image
- **Supported Document Types (27 + UNKNOWN):**
  - ID Documents: SSN_CARD, DRIVER_LICENSE, PASSPORT
  - Tax Income (10): W2, 1099-INT, 1099-DIV, 1099-NEC, 1099-MISC, 1099-K, 1099-R, 1099-G, 1099-SSA, SCHEDULE_K1
  - Tax Credits (3): 1098, 1098-T, 1095-A
  - Business (4): BANK_STATEMENT, PROFIT_LOSS_STATEMENT, BUSINESS_LICENSE, EIN_LETTER
  - Other (4): RECEIPT, BIRTH_CERTIFICATE, DAYCARE_RECEIPT, OTHER
- **Batch Classification:** `batchClassifyDocuments(images[], concurrency)` with configurable concurrency limit
- **OCR Extraction Eligibility:** Exclusion-based - 9 types excluded (PASSPORT, PROFIT_LOSS_STATEMENT, BUSINESS_LICENSE, EIN_LETTER, RECEIPT, BIRTH_CERTIFICATE, DAYCARE_RECEIPT, OTHER, UNKNOWN), all others require OCR

**PDF Converter Service & Classification Pipeline (Phase 01-03):**

- **PDF Conversion Function:** `convertPdfToImages(pdfBuffer): Promise<PdfConversionResult>`
  - Converts PDF → PNG images (200 DPI) via poppler-based pdf-poppler library
  - **Dual Usage:**
    - Classification: First page only, used before Gemini classification (Phase 3 fix)
    - OCR: All pages extracted, used for field data extraction
  - **Poppler Dependency:** Required for PDF rendering (`pdf-poppler` npm package)
    - Validation: 20MB limit, %PDF magic bytes, 10-page max, encryption detection
    - Error Handling: Vietnamese messages (INVALID_PDF, ENCRYPTED_PDF, TOO_LARGE, TOO_MANY_PAGES)
    - Performance: ~1-2s for 3-page, ~2-5s for 10-page PDF
    - Auto-cleanup: Temp directories removed in finally block
  - **Deployment Note:** Server must have poppler installed (Linux: `apt-get install poppler-utils`, macOS: `brew install poppler`)
  - **Health Check:** `/health` endpoint reports `pdfSupport.popplerInstalled` status & errors

- **OCR Extraction Service (Phase 02+03, Enhanced Phase 2 Priority 1):** `extractDocumentData(buffer, mimeType, docType)`
  - **Single Image:** Direct Gemini vision analysis with confidence scoring
  - **Multi-Page PDFs (Phase 03):** Intelligent multi-page extraction flow with merging
    - Each PDF page converted to PNG via poppler (Phase 03 addition)
    - Independent OCR extraction per page (field values cached)
    - Merge strategy: Later pages override earlier values (handles amendments)
    - Weighted confidence: Final confidence based on field contribution
    - Result includes: pageCount, pageConfidences[], merged data
    - Logs PDF processing details for debugging
  - **Phase 2 Priority 1 Additions:** 3 new document types with OCR support:
    - FORM_1099_K (Payment Card Transactions) - Square, Clover, PayPal
    - SCHEDULE_K1 (Partnership Income) - K-1 form extraction
    - BANK_STATEMENT (Business Cash Flow) - Bank transaction statements

- **Type Extensions (Phase 02+03):**
  - `OcrExtractionResult`: Added `pageCount?`, `pageConfidences?[]` fields
  - Supports both single images and multi-page PDFs transparently
  - Pipeline health endpoint exports `getPipelineStatus()` with PDF support flags

- **Merge Logic:** Tax documents often have corrections on page 2+; algorithm prioritizes later pages while tracking per-field page origins
- **OCR Prompts (16 total):**
  - Core: W2, 1099-INT, 1099-NEC, SSN/DL
  - Phase 2 Priority 1: 1099-K, K-1, Bank Statement
  - Phase 3: 1099-DIV, 1099-R, 1099-SSA, 1098, 1095-A
  - Phase 4 Priority 3: 1098-T, 1099-G, 1099-MISC

See [Phase 01 PDF Converter documentation](./phase-01-pdf-converter.md) and [Phase 02 OCR PDF Support](./phase-02-ocr-pdf-support.md) for details.

**Unified Messaging (Phase 3.2 + UX Enhancement + Phase 02 Voice Calls):**

- `messages/` routes handle conversation listing, message history, and sending
- Conversation auto-creation with upsert pattern (prevents race conditions)
- Channel-aware sending: SMS via Twilio, PORTAL/SYSTEM/CALL stored in database
- Unread count tracking per conversation with efficient per-case query
- Real-time updates via polling (30s inbox, 10s active)
- Client detail header: "Tin nhắn" button with unread badge (queries `/messages/:caseId/unread`)
- Browser-based voice calling via Twilio Client SDK (Phase 02 Voice Calls - NEW):
  - Phone icon button in conversation header
  - Active call modal with mute/end controls and duration timer
  - Microphone permission check before calls
  - Token refresh mechanism (5-min buffer before expiry)
  - Call state tracking (idle → connecting → ringing → connected → disconnecting)
  - Duration timer (increments 1s/sec during connected state)
  - CALL channel in message bubbles with PhoneCall icon
  - Vietnamese error messages with sanitization
  - Focus trap modal (prevents page interaction during calls)

**Engagement Helper Service (Phase 3 - NEW):**

**Location:** `apps/api/src/services/engagement-helpers.ts`

**Purpose:** Atomic find-or-create TaxEngagement for case creation workflows.

**Core Function:** `findOrCreateEngagement(tx, clientId, taxYear, profile?)`

- **Input:** Prisma transaction, clientId, taxYear, optional ClientProfile
- **Output:** `{ engagementId, isNew: boolean }`
- **Behavior:**
  - Queries: `TaxEngagement.findUnique({ where: { clientId_taxYear } })`
  - If exists: Return engagementId, isNew=false
  - If not: Create with DRAFT status, copy profile fields with null-safety
  - Profile copy: All fields (filingStatus, hasW2, ein, intakeAnswers, etc.)
  - Used in: Case creation routes, voice voicemail helpers
  - Atomic: Runs in Prisma transaction to ensure consistency

**Usage Pattern:**
```typescript
const { engagementId, isNew } = await findOrCreateEngagement(
  tx,
  clientId,
  taxYear,
  clientProfile
)

const newCase = await tx.taxCase.create({
  data: {
    clientId,
    engagementId,  // REQUIRED in Phase 3
    taxYear,
    // ...
  }
})
```

**Verification Scripts (Phase 3):**

1. `verify-phase2.ts` - Pre-Phase 3 gate
   - Checks: All TaxCases have engagementId (null count = 0)
   - Checks: No orphaned engagementIds (referential integrity)
   - Exit: Pass (0) / Fail (1) for CI/CD pipelines
   - Run: `pnpm -F @ella/db run verify:phase2`

2. `verify-phase3.ts` - Post-Phase 3 validation (if created)
   - Checks: Schema constraint enforced (engagementId required)
   - Checks: Cascade delete works (orphan records cleanup)
   - Run: `pnpm -F @ella/db run verify:phase3`

**Checklist Display Enhancement (Phase 4 - NEW):**

- **Staff Override Capabilities:**
  - Add manual checklist items: `POST /cases/:id/checklist/items`
  - Skip/unskip items: `PATCH /cases/:id/checklist/items/:itemId/skip`, `unskip`
  - Update item notes: `PATCH /cases/:id/checklist/items/:itemId/notes`

- **Database Schema Extensions:**
  - ChecklistItem: `isManuallyAdded`, `addedById`, `addedReason`, `skippedAt`, `skippedById`, `skippedReason`
  - Staff: Relations to track `AddedChecklistItems`, `SkippedChecklistItems` for audit trail
  - Composite index `[caseId, status]` for efficient checklist queries

- **Frontend Components (Phase 4 NEW):**
  - `ChecklistProgress` - Progress bar showing completion % & status breakdown
  - `TieredChecklist` - 3-tier display (Required/Applicable/Optional) with staff actions
  - `AddChecklistItemModal` - Staff form to add items with validation
  - Constants: `checklist-tier-constants.ts` - Tier colors, labels (Vietnamese-first)

- **Tier Categorization Logic:**
  - Required: `template.isRequired=true` AND no condition
  - Applicable: Template has conditional logic (matched vs intake answers)
  - Optional: `template.isRequired=false` AND no condition

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

1. **check-idempotency** - Atomic compare-and-swap (prevents race conditions)
   - Skip if already processed (PROCESSING, CLASSIFIED, LINKED, etc.)
   - Mark status = PROCESSING only if status was UPLOADED
2. **fetch-image** - Retrieve image from R2 via signed URL
   - Returns: { buffer: base64, mimeType, wasResized, isPdf }
3. **check-duplicate** - Perceptual hash grouping (Phase 03)
   - Generate 64-bit pHash from image (skip PDFs - pHash on images only)
   - Find existing duplicates via Hamming distance (threshold: <10 bits)
   - Create/join ImageGroup if duplicate found
   - Early exit if duplicate (skip AI classification - cost saving)
4. **classify** - Gemini vision classification
   - Returns: { success, docType, confidence, reasoning, taxYear, source }
   - Native PDF reading (no conversion needed)
   - Handles service unavailability with retry
5. **route-by-confidence** - Route by confidence thresholds
   - < 60%: UNCLASSIFIED, create AI_FAILED action
   - 60-85%: CLASSIFIED, create VERIFY_DOCS action
   - >= 85%: CLASSIFIED, auto-link, no action
   - Returns: { action, needsOcr, checklistItemId }
6. **rename-file** - Auto-rename to meaningful filename (Phase 04)
   - Skip if unclassified or classification failed
   - Validate caseId format (CUID defense-in-depth)
   - R2 copy+delete atomic pattern (idempotent, race-condition safe)
   - Fetch client name from TaxCase record
   - Rename: {r2Key} → {caseId}/docs/{TaxYear}_{DocType}_{Source}_{ClientName}
   - Update RawImage.r2Key, displayName, category atomically
   - Graceful degradation: failure doesn't break job
   - Returns: { renamed, newKey, displayName, category, error? }
7. **ocr-extract** - Conditional OCR extraction (if confidence >= 60%)
   - Extract structured data with confidence score
   - Atomic DB transaction: upsert DigitalDoc + update ChecklistItem + mark LINKED
   - Returns: { digitalDocId }

**Return Value:**
```typescript
{
  rawImageId: string
  classification: { docType: DocType, confidence: number }
  routing: 'auto-linked' | 'needs-review' | 'unclassified'
  rename: {
    renamed: boolean
    newKey: string | null
    displayName: string | null
    category: DocCategory
  }
  duplicateCheck: {
    checked: boolean
    imageHash: string | null
  }
  digitalDocId?: string
  wasResized: boolean
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

### Unified Inbox & Messaging Flow (Phase 3.2 + UX Enhancement)

```
Staff Views Client Detail Page (/clients/$clientId)
        ↓
Client Detail Header shows:
├─ Client profile info (name, phone, email)
├─ SMS status badge
├─ Case status selector
├─ Edit button
└─ "Tin nhắn" button with unread badge
        ↓
GET /messages/:caseId/unread (30s cache)
        ↓
Fetch unread count: { caseId, unreadCount }
        ↓
Display badge on button if unreadCount > 0
        ↓
Staff clicks "Tin nhắn" button → Navigate to /messages/$caseId
        ↓
---
        ↓
Alternative: Staff Views Unified Inbox (/messages)
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

### Phase 3 Schema Enforcement Flow

```
POST /cases (create new case)
        ↓
1. Fetch ClientProfile by clientId
2. Call findOrCreateEngagement(tx, clientId, taxYear, profile)
   ├─ Check: TaxEngagement exists? (clientId, taxYear composite key)
   ├─ If yes: Return engagementId, isNew=false
   ├─ If no: Create DRAFT engagement, copy profile fields
   └─ Return: { engagementId, isNew=true }
        ↓
3. Create TaxCase with REQUIRED engagementId
   └─ DB constraint enforced at schema level
        ↓
4. Generate checklist with engagement profile
   └─ Uses TaxEngagement.intakeAnswers (not ClientProfile)
        ↓
5. Return case with engagementId populated
        ↓
[No fallback to clientId-only queries]
        ↓
If engagementId missing:
   └─ DB constraint violation → 500 error (developer bug)

**Benefits Phase 3:**
- No orphaned TaxCases (all linked to engagement)
- Cascade delete prevents dangling records
- Year-specific profile always available
- Profile snapshot preserved for audit trail
- Type-safe: engagementId non-nullable everywhere
```

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

### AI Document Processing Pipeline Flow - Phase 02+03 Implementation

```
Client Uploads Documents via Portal
        ↓
POST /portal/:token/upload (multipart form)
        ↓
1. Validate files (type, size, count ≤20)
   - Phase 03: Supports JPEG, PNG, GIF, WebP, PDF
   - Phase 03: PDF size ≤20MB, pages ≤10
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
  - Phase 03: Poppler required for PDF handling
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
[DURABLE STEP 5: ocr-extract] (conditional) - Phase 03: Multi-page PDF support
If needsOcr && docType supports OCR:
  ├─ Decode base64 buffer
  ├─ Phase 03: If PDF, convert all pages to PNG via poppler
  ├─ Call extractDocumentData() with intelligent merging (single image or multi-page PDF)
  │  - Per-page OCR extraction with independent confidence scores
  │  - Merge strategy: Later pages override earlier (handles amendments)
  │  - Result includes pageCount, pageConfidences[], merged data
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

**Supported Document Types for OCR (16 total):**
- Core: W2, 1099-INT, 1099-NEC, SSN_CARD, DRIVER_LICENSE
- Phase 2 Priority 1: 1099-K, SCHEDULE_K1, BANK_STATEMENT
- Phase 3: 1099-DIV, 1099-R, 1099-SSA, FORM_1098, FORM_1095_A
- Phase 4 Priority 3: FORM_1098_T, FORM_1099_G, FORM_1099_MISC
```

### Phase 03 Storage Rename - R2 File Renaming Operation (NEW)

**Location:** `packages/shared/src/utils/filename-sanitizer.ts` | `apps/api/src/services/storage.ts`

**Purpose:** Rename files in R2 storage from generic names (e.g., `cases/abc123/raw/123456.pdf`) to meaningful names based on AI classification results (e.g., `cases/abc123/docs/2025_W2_GoogleLlc_JohnSmith.pdf`).

**Filename Convention:**
- Format: `{TaxYear}_{DocType}_{Source}_{ClientName}`
- Example: `2025_W2_GoogleLlc_JohnSmith.pdf`
- Rules: No spaces (underscores), no Vietnamese diacritics, no special chars, max 60 chars total

**Utilities (filename-sanitizer.ts):**
- `removeDiacritics(text)` - Removes Vietnamese accents/tones (ă, â, đ, ê, ô, ơ, ư)
- `toPascalCase(text)` - Converts to PascalCase ("google llc" → "GoogleLlc")
- `sanitizeComponent(input, maxLength)` - Removes special chars, enforces length
- `generateDocumentName(components)` - Generates final filename from naming components
- `getDisplayNameFromKey(r2Key)` - Extracts display name from R2 key

**Storage Service (storage.ts):**
- `renameFile(oldKey, caseId, components): RenameResult` - Main rename operation
  - Uses R2 copy+delete pattern (no native rename in S3/R2)
  - Step 1: Copy object to new key in `cases/{caseId}/docs/` folder
  - Step 2: Delete old key (safe to fail - orphaned file acceptable, DB is source of truth)
  - Returns: `{ success, newKey, oldKey, error? }`

**Behavior:**
- Skips rename if keys are identical (no-op)
- Preserves file extension from original key
- Defaults to `.pdf` if extension not found
- Succeeds even if delete fails (orphaned old file is acceptable per design)
- Returns error only if copy fails (new file not created)

**Integration (Phase 04 - INTEGRATED INTO classify-document JOB):**
- Called as Step 5 in classifyDocumentJob after route-by-confidence (Step 4)
- Automatic rename for all classified documents (confidence ≥ 60%)
- Requires DocumentNamingComponents from classification: taxYear, docType, source, clientName
- Client name fetched from TaxCase record (single DB query per classification)
- Graceful degradation: rename failure doesn't break job or OCR steps
- Updates RawImage.r2Key, displayName, and category atomically
- Gracefully handles R2 not configured (returns success without operation)
- Telemetry logged for rename failures (for debugging & monitoring)

**Test Coverage (10 tests):**
- Copy+delete pattern validation
- Extension preservation & default handling
- Identical key detection (no-op)
- Copy failure handling (returns error)
- Delete failure handling (succeeds with orphaned file)
- Vietnamese character handling
- Null taxYear defaulting to current year
- Empty source handling
- Complex docType handling

**Filename Sanitizer Tests (33 tests):**
- Diacritics removal (Vietnamese accents)
- PascalCase conversion
- Component sanitization (special char removal)
- Document name generation
- Display name extraction from R2 keys

### Real-Time Updates & Notifications Flow - Phase 05 Implementation

```
Staff Views Client Documents Tab
        ↓
useClassificationUpdates() hook activates
        ↓
Query: GET /cases/:id/images AND GET /cases/:id/docs
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
Invalidate Related Queries (on status changes):
├─ CLASSIFIED/LINKED: Invalidate ['checklist', caseId]
├─ RawImageGallery re-renders with updated status
└─ ChecklistGrid reflects new status
        ↓
Hook Returns:
├─ images: polled RawImage array (re-fetched every 5s)
├─ docs: polled DigitalDoc array (re-fetched every 5s)
├─ processingCount: active PROCESSING images
└─ isPolling: enabled state
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

**Query Invalidation Strategy:**
- Hook polls both images AND docs queries simultaneously
- On classification status change (CLASSIFIED/LINKED):
  - Invalidates checklist query → RawImageGallery & ChecklistGrid refresh
  - docs array keeps in sync with latest DigitalDoc records
  - Modal submissions (classify-review, manual-classify) also invalidate docs
- Prevents stale data in classification/verification workflows

**Components:**
- useClassificationUpdates() - Polling hook with dual query tracking + invalidation
- UploadProgress - Floating panel showing processing count
- RawImageGallery - Display with PROCESSING status badge
- ClassificationReviewModal - Invalidates docs on approve/reject
- ManualClassificationModal - Invalidates docs on classification
- Client Detail - Route that integrates polling + docs tracking
```

## Database Schema (Phase 3 Schema Cleanup - Complete)

**Core Models (15 - Phase 3.0 UPDATE: TaxCase.engagementId now REQUIRED, onDelete Cascade):**

```
AuditLog - Compliance & audit trail (Phase 01 NEW)
├── id, entityType (CLIENT_PROFILE|CLIENT|TAX_CASE|TAX_ENGAGEMENT)
├── entityId, field, oldValue, newValue (Json)
├── changedById (optional), createdAt
├── Indexes: (entityType, entityId), (changedById), (createdAt)

Staff - Authentication & authorization
├── id, email (@unique), name, role (ADMIN|STAFF|CPA)
├── avatarUrl, isActive, timestamps
├── auditLogs (1:many AuditLog)

Client - Tax client management (permanent)
├── id, name, phone (@unique), email, language (VI|EN)
├── profile (1:1 ClientProfile) - Deprecated legacy global profile
├── engagements (1:many TaxEngagement) - Year-specific engagement records
├── taxCases (1:many TaxCase) - Per-form filings

ClientProfile - Tax situation questionnaire (DEPRECATED - Phase 3 reads via TaxEngagement)
├── Dependents: hasKidsUnder17, numKidsUnder17, paysDaycare, hasKids17to24
├── Employment: hasW2, hasSelfEmployment
├── Investments: hasBankAccount, hasInvestments
├── Business: ein, businessName, hasEmployees, hasContractors, has1099K
├── Housing: hasRentalProperty
├── NOTE: All new operations use TaxEngagement profile snapshot instead
├── Maintained for backward compat only; reads fallback to engagement

TaxEngagement - Year-specific client profile (Phase 1.0 NEW - Multi-year support; Phase 3: PRIMARY data source)
├── id, clientId (@fk, onDelete: Cascade), taxYear, status (DRAFT|ACTIVE|COMPLETE|ARCHIVED)
├── Profile fields (same as ClientProfile for year-specific storage)
├── intakeAnswers (JSON) - Year-specific intake responses [Phase 3: PRIMARY source, not ClientProfile]
├── taxCases (1:many, onDelete: Cascade) - Tax forms for this engagement year
├── Unique constraint: (clientId, taxYear)
├── Indexes: (clientId), (taxYear), (status), (clientId, status)
├── Purpose: Multi-year client support, year-specific profile snapshots [Phase 3: All ops use engagement profile]

TaxCase - Per-client per-year tax filing
├── clientId, engagementId (REQUIRED @fk TaxEngagement, onDelete: Cascade) [Phase 3 CHANGE]
├── taxYear, status (INTAKE→FILED), taxTypes[]
├── rawImages, digitalDocs, checklistItems, imageGroups (1:many)
├── conversation, magicLinks, actions (1:many)
├── Timestamps: lastContactAt, entryCompletedAt, filedAt
├── Indexes: (engagementId), (engagementId, status), (engagementId, lastActivityAt)

RawImage - Document uploads
├── caseId, r2Key, r2Url, filename, fileSize
├── status (UPLOADED→LINKED), classifiedType, aiConfidence, blurScore
├── category (DocCategory?) - AI-assigned document category (Phase 01: IDENTITY, INCOME, EXPENSE, ASSET, EDUCATION, HEALTHCARE, OTHER)
├── displayName (String? VarChar(255)) - Sanitized filename for display (Phase 01)
├── imageHash (pHash for duplicates), imageGroupId (duplicate grouping)
├── uploadedVia (SMS|PORTAL|SYSTEM)
├── reuploadRequested Boolean, reuploadRequestedAt DateTime (Phase 01)
├── reuploadReason String?, reuploadFields Json? (Phase 01)
├── Indexes: (caseId), (status), (category) - Filter by document category

ImageGroup - Duplicate document grouping (Phase 03)
├── caseId, docType, bestImageId (selected best image)
├── images (1:many RawImage), timestamps

DigitalDoc - Extracted/verified documents (Phase 01-B: Entry Workflow)
├── caseId, rawImageId, docType, status (PENDING→VERIFIED)
├── extractedData (JSON), aiConfidence, verifiedById
├── fieldVerifications Json? - field-level verification status (Phase 01)
├── copiedFields Json? - copy tracking for data entry (Phase 01)
├── entryCompleted Boolean, entryCompletedAt DateTime? (Phase 01)
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

**Enums (14 - Phase 1.0 NEW: +1 EngagementStatus, Phase 01: +1 DocCategory):**
- TaxCaseStatus, TaxType, DocType (60+ document types)
- RawImageStatus, DigitalDocStatus, ChecklistItemStatus
- ActionType, ActionPriority, MessageChannel, MessageDirection
- StaffRole, Language
- **EngagementStatus** (NEW Phase 1.0) - DRAFT, ACTIVE, COMPLETE, ARCHIVED
- **DocCategory** (NEW Phase 01) - IDENTITY, INCOME, EXPENSE, ASSET, EDUCATION, HEALTHCARE, OTHER

## Phase 01 Database Schema Update - Document Categorization (2026-01-27)

### DocCategory Enum & RawImage Fields

**New Enum: DocCategory** (7 categories)
```
IDENTITY    - Giáy tờ tùy thân: SSN Card, Driver License, Passport, etc.
INCOME      - Thu nhập: W2, all 1099 variants, K-1 forms
EXPENSE     - Chi phí: Receipts, Invoices, Deduction documentation
ASSET       - Tài sản: Property docs, Vehicle documents, Real estate
EDUCATION   - Giáo dục: 1098-T, 1098-E (education credits)
HEALTHCARE  - Y tế: 1095-A/B/C (health insurance forms)
OTHER       - Khác: Unclassified or miscellaneous documents
```

**RawImage Schema Changes (Phase 01)**
```prisma
model RawImage {
  // Existing fields...

  // Phase 01: Document categorization
  category        DocCategory?           // AI-assigned document category
  displayName     String? @db.VarChar(255)  // Sanitized filename (naming convention)

  // Indexes for filtering
  @@index([category])                    // Filter by document category
}
```

**Purpose & Usage**
- **AI-Assigned Categorization:** When Gemini classifies documents, it assigns both `classifiedType` (specific type like W2) and `category` (broad category)
- **Display Name:** Stores human-readable filename after sanitization (removes special chars, limits length)
- **Indexing Strategy:** Category index enables efficient filtering by document class (e.g., "show all INCOME documents")
- **Backward Compatibility:** Both fields optional; existing RawImages not affected

**Implementation Notes**
- Migration: Add columns (nullable, no data change required)
- Gemini classifier prompt updated to infer category from docType classification
- Frontend: New category filter in Document Gallery for staff navigation
- Query optimization: Use `@@index([category])` for dashboard queries grouping docs by category

---

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

## Phase 1 Schema Migration - Multi-Year Support (2026-01-25)

### Overview

Phase 1 Schema Migration introduces **TaxEngagement** model to support multi-year client engagements. This enables clients to have multiple tax years managed separately while maintaining historical data and per-year profile snapshots.

### Key Changes

**New Enum: EngagementStatus**
```
DRAFT      // Engagement created but intake not complete
ACTIVE     // Intake complete, work in progress
COMPLETE   // All tax cases filed
ARCHIVED   // Past year, read-only
```

**New Model: TaxEngagement**
```prisma
model TaxEngagement {
  id        String           @id @default(cuid())
  clientId  String
  client    Client           @relation(fields: [clientId], references: [id], onDelete: Cascade)
  taxYear   Int
  status    EngagementStatus @default(DRAFT)

  // Year-specific profile snapshot (copied from ClientProfile schema)
  filingStatus, hasW2, hasBankAccount, hasInvestments, hasKidsUnder17, numKidsUnder17,
  paysDaycare, hasKids17to24, hasSelfEmployment, hasRentalProperty,
  businessName, ein, hasEmployees, hasContractors, has1099K,
  intakeAnswers (JSON)

  // Relations
  taxCases TaxCase[]

  @@unique([clientId, taxYear])
  @@index([clientId])
  @@index([taxYear])
  @@index([status])
  @@index([clientId, status])  // Filter by status
}
```

**Updated Models**
- **Client:** Added `engagements TaxEngagement[]` relation (1:many)
- **TaxCase:** Added `engagementId String?` (nullable FK for backward compatibility)
- **TaxCase:** Added indexes: `(engagementId)`, `(engagementId, status)`, `(engagementId, lastActivityAt)`
- **AuditEntityType:** Added `TAX_ENGAGEMENT` value

### Migration Path

**Phase 1 (Current):** Backward compatible - `engagementId` nullable, allows existing single-year workflow

**Phase 2 (Future):** New endpoint `POST /clients/:id/engagements` to create new year engagements

**Phase 3 (Future):** Make `engagementId` required on TaxCase (drop single-year direct association)

### Benefits

1. **Multi-Year Support** - Clients can file multiple years with separate profiles
2. **Historical Data** - Year-specific intakeAnswers preserved per engagement
3. **Status Tracking** - Engagement lifecycle (DRAFT → ACTIVE → COMPLETE → ARCHIVED)
4. **Efficient Querying** - Composite indexes enable fast filtering by status & activity
5. **Backward Compatible** - Existing TaxCase records work without engagementId

### Data Model Hierarchy

```
Client (permanent)
├── ClientProfile (legacy, per-client)
└── TaxEngagement[] (per-year)
    ├── status: EngagementStatus
    ├── Profile snapshot (filingStatus, hasW2, etc.)
    ├── intakeAnswers (year-specific)
    └── TaxCase[] (per-form filings)
        ├── status: TaxCaseStatus
        └── Documents (RawImage, DigitalDoc, Checklist, etc.)
```

### Frontend/Backend Implications

**Backend:**
- Client profile queries should prefer `TaxEngagement.intakeAnswers` over `ClientProfile`
- Checklist generation uses engagement-specific profile
- Audit logging tracks changes per engagement year

**Frontend:**
- Case detail pages implicitly use engagement context
- Future: Engagement selector UI for clients with multiple years
- Profile updates save to both ClientProfile (legacy) and TaxEngagement (new)

---

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

## Phase 2: Actionable Client Status System - API Changes Summary

**Completion Date:** 2026-01-21

### New/Updated API Endpoints

#### 1. Enhanced GET /clients Endpoint

**New Features:**
- `sort` parameter: `activity` (default, by lastActivityAt) or `name` (alphabetical)
- Returns `ClientWithActions` type with computed status & action counts
- Efficient aggregation using Prisma `_count` for MISSING docs

**Response Structure:**
```typescript
{
  data: ClientWithActions[],
  pagination: { page, limit, total }
}

// ClientWithActions type:
{
  id, name, phone, email, language, createdAt, updatedAt
  computedStatus: ComputedStatus | null  // NEW
  actionCounts: ActionCounts | null      // NEW
  latestCase: {
    id, taxYear, taxTypes
    isInReview, isFiled               // NEW flags
    lastActivityAt                    // Activity tracking
  }
}

// ActionCounts type:
{
  missingDocs: number        // ChecklistItem.status = MISSING
  toVerify: number          // DigitalDoc.status = EXTRACTED
  toEnter: number           // DigitalDoc status VERIFIED but entryCompleted = false
  staleDays: number | null  // Days since lastActivityAt (null if < threshold)
  hasNewActivity: boolean   // Unread messages in conversation
}

// ComputedStatus:
'INTAKE' | 'WAITING_DOCS' | 'IN_PROGRESS' | 'READY_FOR_ENTRY' |
'ENTRY_COMPLETE' | 'IN_REVIEW' | 'FILED'
```

#### 2. New Case Status Action Endpoints

**POST /cases/:id/send-to-review** - Move case to REVIEW state
- Sets `isInReview = true`
- Updates `lastActivityAt` timestamp
- Validates: case not already filed, not already in review
- Response: `{ success: true }`
- Errors: `ALREADY_FILED`, `ALREADY_IN_REVIEW`, `NOT_FOUND`

**POST /cases/:id/mark-filed** - Mark case as FILED
- Sets `isFiled = true`, `filedAt = now`, `lastActivityAt = now`
- Validates: case not already filed
- Response: `{ success: true }`
- Errors: `ALREADY_FILED`, `NOT_FOUND`

**POST /cases/:id/reopen** - Reopen filed case
- Sets `isFiled = false`, `isInReview = true`, `filedAt = null`
- Updates `lastActivityAt` timestamp
- Validates: case must be filed
- Response: `{ success: true }`
- Errors: `NOT_FILED`, `NOT_FOUND`

### Database Schema Changes

**TaxCase Model (Phase 2 Additions):**
```prisma
model TaxCase {
  // Existing fields...

  // Phase 2: Status flags + activity tracking
  isInReview       Boolean   @default(false)
  isFiled          Boolean   @default(false)
  filedAt          DateTime?
  lastActivityAt   DateTime  @default(now()) @updatedAt

  // For efficient sorting
  @@index([lastActivityAt])
  @@index([isInReview, isFiled])
}
```

### Activity Tracking Integration

**New Service:** `activity-tracker.ts`
- `updateLastActivity(caseId)` - Updates `TaxCase.lastActivityAt = now()`
- Called on: document uploads, client messages, document verification, data entry completion

**Integration Points:**
- `POST /portal/:token/upload` - After client document upload
- `POST /messages/send` - After message sent
- `POST /docs/:id/verify-action` - After document verification
- `POST /docs/:id/complete-entry` - After data entry completion
- `POST /webhooks/twilio/sms` - After SMS message received

**Database Queries Optimized:**
- Indexed on `(lastActivityAt DESC)` for sorting clients by activity
- Combined with `isInReview`, `isFiled` flags for status filtering
- Efficient aggregation: `_count.checklistItems { where: { status: MISSING } }`

### Frontend Integration

**New API Client Methods** (`apps/workspace/src/lib/api-client.ts`):
```typescript
// Cases status actions
cases: {
  sendToReview: (caseId) => POST /cases/:id/send-to-review
  markFiled: (caseId) => POST /cases/:id/mark-filed
  reopen: (caseId) => POST /cases/:id/reopen
}

// Clients list with computed status
clients: {
  list: (params: { page, limit, search?, status?, sort? })
    => GET /clients with ClientWithActions response
}
```

### Computed Status Priority

**System:** `computeStatus()` utility in `@ella/shared`

**Priority Chain** (evaluated in order):
1. **FILED** - `isFiled === true`
2. **IN_REVIEW** - `isInReview === true`
3. **ENTRY_COMPLETE** - All docs verified + all docs have entryCompleted
4. **READY_FOR_ENTRY** - All docs verified but some missing entryCompleted
5. **IN_PROGRESS** - Has some extracted/verified docs, intake answered
6. **WAITING_DOCS** - Intake answered but no documents received
7. **INTAKE** - Default state (just created, no intake answers)

**Stale Detection:** `calculateStaleDays(lastActivityAt)`
- Returns days since last activity, or `null` if < 3 days (default threshold)
- Used for workspace "Stale Cases" section

### Testing

**New Tests (23 total):**
- Computed status calculation with various doc states
- Action counts aggregation (missingDocs, toVerify, toEnter)
- Case status transitions (send-to-review, mark-filed, reopen)
- Activity tracking on multiple operations
- Stale days calculation with threshold
- Sort parameter handling (activity vs name)
- ClientWithActions response structure

---

## Codebase Overview (Generated 2026-01-27)

### Project Structure

```
ella/
├── .claude/                    # Claude Code configuration & skills
├── .github/                    # GitHub Actions workflows
├── packages/                   # Shared libraries
│   ├── db/                     # Prisma database layer (@ella/db)
│   │   ├── prisma/
│   │   │   └── schema.prisma  # Database schema (14 enums, 26 models)
│   │   └── src/
│   │       ├── client.ts      # Singleton Prisma client
│   │       └── generated/     # Auto-generated Prisma types
│   ├── shared/                # Validation & types (@ella/shared)
│   │   └── src/
│   │       ├── schemas/       # Zod validation schemas
│   │       ├── types/         # TypeScript types
│   │       └── utils/         # Utilities (computeStatus, etc.)
│   └── ui/                    # Component library (@ella/ui)
│       └── src/
│           ├── components/    # shadcn/ui components
│           └── styles.css     # Tailwind globals
├── apps/                       # Applications
│   ├── api/                    # Hono backend server (3002)
│   │   ├── src/
│   │   │   ├── routes/        # API endpoints (58 total)
│   │   │   ├── services/      # Business logic (AI, PDF, SMS, etc.)
│   │   │   ├── jobs/          # Inngest background jobs
│   │   │   ├── middleware/    # Auth, error handling, rate limiting
│   │   │   └── lib/           # Config, utilities
│   │   └── package.json
│   ├── portal/                 # Client upload portal (React, 5173)
│   │   ├── src/
│   │   │   ├── routes/        # Client-side pages
│   │   │   ├── components/    # UI components
│   │   │   └── lib/           # Utilities, API client
│   │   └── vite.config.ts
│   └── workspace/              # Staff dashboard (React, 5174)
│       ├── src/
│       │   ├── routes/        # Pages (/clients, /cases, /messages, etc.)
│       │   ├── components/    # 27+ feature components
│       │   ├── stores/        # Zustand state management
│       │   └── lib/           # Utilities, API client
│       └── vite.config.ts
├── docs/                       # Documentation (40+ files)
├── pnpm-workspace.yaml        # Monorepo config
├── turbo.json                 # Turbo build orchestration
├── tsconfig.json              # TypeScript base config
├── eslint.config.js           # Linting rules
└── .prettierrc                 # Code formatting config
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | Hono | 4.6+ |
| **Database** | PostgreSQL + Prisma | Latest |
| **Frontend** | React | 19 |
| **Build** | Vite | 6 |
| **Router** | TanStack Router | 1.94+ |
| **Data Fetching** | React Query | 5.64+ |
| **State** | Zustand | Latest |
| **UI Framework** | shadcn/ui + Tailwind | v4 |
| **AI Service** | Google Gemini | 2.5-flash |
| **Jobs** | Inngest Cloud | Latest |
| **SMS** | Twilio | Latest |
| **Storage** | Cloudflare R2 | Latest |
| **Auth** | JWT + Bcrypt | Session-based |

### File Statistics

- **Total Models:** 26 (TaxCase, RawImage, DigitalDoc, etc.)
- **Total Enums:** 14 (TaxCaseStatus, DocType, DocCategory, etc.)
- **API Endpoints:** 58 (clients, cases, docs, messages, voice, etc.)
- **Frontend Components:** 27+ (Dashboard, Checklist, Gallery, etc.)
- **Services:** 15+ (AI, PDF, SMS, Audit, etc.)
- **Background Jobs:** 1 main (classifyDocumentJob with 6 durable steps)
- **Database Migrations:** Auto-generated by Prisma

### Feature Areas

**Phase 01 Complete (Jan 2026)**
- Database schema with multi-year support (TaxEngagement)
- Backend API with 58 endpoints
- Document upload & classification pipeline
- AI-powered OCR extraction (Gemini)
- SMS integration (Twilio)
- Real-time polling for updates
- Staff authentication & role-based access
- Comprehensive audit logging

**Phase 02 In Progress**
- Document category system (DocCategory enum)
- Enhanced document filtering & organization
- Staff verification workflow
- Client status computation

**Phase 03-06 Planned**
- WebSocket real-time updates
- Advanced document deduplication
- Multi-language support
- Compliance automation
- Comprehensive testing suite

---

**Last Updated:** 2026-01-27
**Phase:** Phase 3 - Schema Cleanup (Engagement Isolation Complete)
**Architecture Version:** 9.2 (Multi-Year Engagement Isolation with enforced constraints)
**Completed Features (Phase 06):**
- ✓ Vitest unit testing setup for AI services
- ✓ Integration tests for classify-document job (17 tests total)
- ✓ Idempotency checks for Inngest duplicate events
- ✓ Image resize for files >4MB using sharp (prevents Gemini timeout)
- ✓ 20MB hard size limit enforcement (DoS prevention)
- ✓ Gemini service unavailability detection with retry logic
- ✓ Error message sanitization (API keys, emails, paths masked)
- ✓ AI_FAILED action creation for CPA manual review
**Completed Features (Phase 1 & 2 Debug - 2026-01-17):**
- ✓ Smart stuck detection for images in PROCESSING >5 minutes
- ✓ Modal display accuracy improved with stuck image filtering
- ✓ Gemini model reverted to gemini-2.5-flash (more stable)
- ✓ Progress notifications exclude stale/abandoned jobs

**Completed Features (Phase 05):**
- ✓ Classification updates hook with 5s polling + stuck detection
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
