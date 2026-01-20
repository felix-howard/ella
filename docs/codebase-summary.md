# Ella - Codebase Summary (Quick Reference)

**Current Date:** 2026-01-20
**Current Branch:** feature/more-enhancement

## Project Status Overview

| Phase | Status | Completed |
|-------|--------|-----------|
| **Phase 02 Voice Calls** | **Browser-based calling (Twilio Client SDK); phone icon button; active call modal with mute/end; duration timer; microphone permission check; token refresh; error sanitization; CALL channel in messages** | **2026-01-20** |
| **Phase 01 Voice API** | **Token generation (VoiceGrant); TwiML call routing; call message tracking; recording + status webhooks; E.164 phone validation; Twilio signature validation** | **2026-01-20** |
| **Phase 03 Quick-Edit Icons** | **QuickEditModal component; personal info quick-edit (name, phone, email); wrapper pattern for fresh state; field-specific validation (E.164 phone, RFC 5322 email); accessibility (ARIA, keyboard shortcuts)** | **2026-01-20** |
| **Phase 02 Section Edit Modal** | **intake-form-config.ts (95+ fields, 18 sections); SectionEditModal component; api.clients.updateProfile(); ClientOverviewSections enhanced with edit icons** | **2026-01-20** |
| **Phase 05 Testing & Validation** | **Checklist Generator: 16 new tests (count-based, research scenarios, fallback, performance); Classification: 64 doc types, comprehensive validation** | **2026-01-20** |
| **Phase 04 UX Improvements** | **IntakeProgress, IntakeRepeater, Smart Auto-Expand, SaveIndicator, SkipItemModal, useDebouncedSave hook** | **2026-01-20** |
| **Phase 03 Checklist Templates** | **+13 new templates (92 total), 9 new DocTypes (60+ total), home_sale/credits/energy categories, Vietnamese labels** | **2026-01-20** |
| **Phase 02 Intake Expansion** | **+70 missing CPA questions, new sections (prior_year, filing), React.memo optimization** | **2026-01-20** |
| **Phase 01 Condition System** | **Compound AND/OR conditions, numeric operators, cascade cleanup (31 tests)** | **2026-01-20** |
| **Phase 2 Portal UI** | **Portal Redesign - MissingDocsList, SimpleUploader, consolidated single-page** | **2026-01-20** |
| **Phase 5 Admin Settings** | **Admin Settings Polish - JSON validation, size limits, 29 tests** | **2026-01-19** |
| **Phase 4 Checklist Display** | **3-Tier Checklist, Staff Overrides, 4 new API endpoints, 3 components** | **2026-01-19** |
| **Phase 3 Checklist** | **Checklist Generator Fix - intakeAnswers priority, dynamic counts, 15 tests** | **2026-01-19** |
| **Phase 2.0 Questionnaire** | **Dynamic Intake Form - 3 components, multi-section UI, conditional logic** | **2026-01-19** |
| **Client Message UX** | **Header "Tin nhắn" button with unread badge + `/messages/:caseId/unread` endpoint** | **2026-01-18** |
| **Phase 04 Priority 3** | **OCR Expansion - 1098-T, 1099-G, 1099-MISC (16 document types total)** | **2026-01-17** |
| **Phase 01 Classification** | **Classification Enhancement - Few-shot examples, Vietnamese names, confidence calibration** | **2026-01-16** |
| **Phase 02 OCR** | **PDF OCR Support - Multi-page extraction with intelligent merging** | **2026-01-16** |
| **Phase 01** | **PDF Converter Service (200 DPI, 20MB, 10-page limits)** | **2026-01-16** |
| **Phase 04 Tabs** | **Tab Layout Refactor (3-Tab Workflow: Uploads, Review, Verified)** | **2026-01-15** |
| **Phase 03 Shared** | **Shared Components (Field Verification, Copy Tracking)** | **2026-01-15** |
| **Phase 06** | **Testing Infrastructure & Edge Case Handling** | **2026-01-15** |
| **Phase 05** | **Real-time Updates (Polling & Notifications)** | **2026-01-14** |
| **Phase 04** | **Frontend Review UX (Confidence Badges & Classification Modal)** | **2026-01-14** |
| **Phase 3.3** | **Duplicate Detection & Grouping** | **2026-01-14** |
| **Phase 3** | **Production Ready (JWT Auth + RBAC)** | **2026-01-14** |
| Phase 4.2 | Side-by-Side Document Viewer (Pan/Zoom/Field Highlighting) | **2026-01-14** |
| Phase 4.1 | Copy-to-Clipboard Workflow (Data Entry Optimization) | 2026-01-14 |
| Phase 3.2 | Unified Inbox & Conversation Management | 2026-01-14 |
| Phase 3.1 | Twilio SMS Integration (Complete: First Half + Second Half) | 2026-01-13 |
| **Phase 2** | **Make It Usable (Core Workflow)** | **2026-01-14** |
| Phase 2.2 | Dynamic Checklist System (Atomic Transactions) | 2026-01-13 |
| Phase 2.1 | AI Document Processing | 2026-01-13 |
| Phase 5 | Verification | 2026-01-12 |
| Phase 4 | Tooling (ESLint, Prettier) | 2026-01-11 |
| Phase 3 (Old) | Apps Setup (API, Portal, Workspace) | Complete |
| Phase 2 Infrastructure | Packages Setup (DB, Shared, UI) | Complete |
| Phase 1.5 | Shared UI Components | 2026-01-13 |
| Phase 1.4 | Client Portal | 2026-01-13 |
| Phase 1.3 | Workspace UI Foundation | 2026-01-13 |
| Phase 1.2 | Backend API Endpoints | 2026-01-13 |
| Phase 1.1 | Database Schema | 2026-01-12 |

## Architecture at a Glance

```
ella/ (Monorepo - pnpm workspaces)
├── apps/
│   ├── api/          # Hono backend (PORT 3002)
│   ├── portal/       # Client upload portal (PORT 5174)
│   └── workspace/    # Staff management UI (PORT 5173)
├── packages/
│   ├── db/           # Prisma client + schema
│   ├── shared/       # Zod schemas + TypeScript types
│   └── ui/           # 11 shared components library
└── .claude/          # Documentation & workflows
```

## Key Technologies

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 6, TanStack Router, Tailwind CSS 4 |
| **Backend** | Hono, Node.js, TypeScript |
| **Database** | PostgreSQL, Prisma ORM |
| **UI Components** | shadcn/ui, Radix UI, class-variance-authority, lucide-react |
| **Validation** | Zod |
| **Package Manager** | pnpm |
| **Orchestration** | Turbo |

## Core Packages

See [phase-1.5-ui-components.md](./phase-1.5-ui-components.md) for detailed UI library docs.

**@ella/db** - Database layer with 13 models, 12 enums, singleton connection pooling.
**@ella/shared** - Validation schemas + TypeScript types via Zod.
**@ella/ui** - 11-component shared library + Phase 03 shared components (FieldVerificationItem, ImageViewer, etc).

## Core Applications

### @ella/api
**REST API (Hono framework, PORT 3002)** - 43+ endpoints across 8 modules with Zod validation, global error handling, OpenAPI docs, audit logging (Phase 01 NEW).

### @ella/portal
**Client-facing upload portal (React, PORT 5174)** - Passwordless magic link auth, mobile-optimized (max 448px), file validation, real-time progress.

**Phase 2 Redesign (2026-01-20):**
- **MissingDocsList** - Clean list of required documents with XSS sanitization
- **SimpleUploader** - Single big button native file picker (no drag-drop)
- **Consolidated Route** - `/u/$token/` single-page experience (removed `/upload`, `/status` routes)
- **i18n Enhanced** - New strings: docsNeeded, tapToUpload, uploadedSuccess, noDocsNeeded

**Phase 3 Toast Integration (2026-01-20):**
- **toastStore** (lib) - Lightweight toast notifications using useSyncExternalStore (no Zustand dependency), max 3 visible, deduplication (500ms window), SSR-safe, 3s auto-dismiss for success, 5s for errors
- **ToastContainer** (component) - Mobile pill design at bottom center, stacking animation (scale/opacity for older toasts), icons: Check/X/Info, manual dismiss button
- **Integration** - SimpleUploader uses `toast.success()` / `toast.error()` for upload feedback, ToastContainer mounted in `__root.tsx` layout
- **Types:** success (mint), error (red), info (dark)

See [Phase 2 UI Components](./phase-2-ui-components-portal.md) for detailed component docs.

### @ella/workspace
**Staff management dashboard (React, PORT 5173)** - Vietnamese-first UI, Zustand state, 20+ components, real-time polling.

**Pages:**
- `/clients/$clientId` - Client detail (2 tabs: Overview, Documents + Header "Tin nhắn" button with unread badge)

**Features:**
- 10s polling: active conversation
- Copy-to-clipboard workflow (Phase 4.1)
- 3-tab document workflow (Phase 04 Tabs)
- 5s polling: classification updates on Documents tab (real-time status tracking)
- Efficient unread count fetching via `/messages/:caseId/unread` endpoint (30s cache)

See [detailed architecture guide](./system-architecture.md) for full API/data flow docs.

## Backend Services

### Voice API Service (Phase 01 - NEW)

**Location:** `apps/api/src/services/voice/`, `apps/api/src/routes/voice/`, `apps/api/src/routes/webhooks/twilio.ts`

**Purpose:** Browser-based outbound voice calling with Twilio Client SDK, recording, and call tracking.

**Core Services:**
- **Token Generator** (`token-generator.ts`) - JWT tokens with VoiceGrant for staff identities (1-hour TTL, outbound only)
- **TwiML Generator** (`twiml-generator.ts`) - XML response for call routing + recording + status callbacks
- **Voice Routes** (`routes/voice/index.ts`) - 4 endpoints for token, status, call creation, CallSid update
- **Voice Webhooks** (`routes/webhooks/twilio.ts`) - 3 webhooks for call routing, recording completion, status updates

**API Endpoints:**
- `POST /voice/token` - Generate voice access token (auth required), returns `{ token, expiresIn, identity }`
- `GET /voice/status` - Check voice feature availability, returns `{ available, features: { outbound, recording, inbound } }`
- `POST /voice/calls` - Create call record + message placeholder, body `{ caseId, toPhone }`, returns `{ messageId, conversationId, toPhone, clientName }`
- `PATCH /voice/calls/:messageId` - Update message with Twilio CallSid, body `{ callSid }`, returns `{ success, messageId, callSid }`

**Webhooks:**
- `POST /webhooks/twilio/voice` - Call routing (returns TwiML with Dial + recording config)
- `POST /webhooks/twilio/voice/recording` - Recording completion (stores recordingUrl, recordingDuration, updates content)
- `POST /webhooks/twilio/voice/status` - Call status updates (completed, busy, no-answer, failed, canceled)

**Database Schema Extensions (Message model):**
- `callSid: String?` - Twilio call identifier
- `recordingUrl: String?` - S3-compatible MP3 URL (Twilio CDN)
- `recordingDuration: Int?` - Recording length in seconds
- `callStatus: String?` - Terminal state: completed, no-answer, busy, failed, canceled

**Configuration (config.ts):**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - SMS credentials (reused)
- `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` - Voice API credentials (NEW)
- `TWILIO_TWIML_APP_SID` - TwiML application for call routing (NEW)
- `TWILIO_WEBHOOK_BASE_URL` - Callback URL base for webhooks (NEW)
- `voiceConfigured` - Boolean flag: requires all 4 voice env vars + 3 SMS env vars

**Security:**
- Staff identity validation (non-empty staffId required for token)
- Webhook signature validation (Twilio HMAC verification)
- Rate limiting (60 req/min per IP for webhooks)
- Call recording enabled by default (compliance)
- XSS-safe TwiML generation (XML escaping)

**Call Flow:**
1. Frontend requests `POST /voice/token` → Gets JWT with VoiceGrant
2. Frontend initiates call with `POST /voice/calls` → Creates Message (status='initiated')
3. Twilio callback to `POST /webhooks/twilio/voice` → Returns TwiML (includes recording config)
4. Call connects, recording starts
5. Recording completes → `POST /webhooks/twilio/voice/recording` → Stores recordingUrl + duration
6. Call terminates → `POST /webhooks/twilio/voice/status` → Updates callStatus (terminal state)

**Error Handling:**
- `VOICE_NOT_CONFIGURED` (503) - Voice deps missing
- `UNAUTHORIZED` (401) - No staffId in JWT
- `CASE_NOT_FOUND` (404) - Invalid caseId
- `MESSAGE_NOT_FOUND` (404) - CallSid not in system
- Twilio retry on 5xx: exponential backoff (0s, 15s, 30s)

### Frontend Voice Calling (Phase 02 - NEW)

**Location:** `apps/workspace/src/lib/twilio-sdk-loader.ts`, `apps/workspace/src/hooks/use-voice-call.ts`, `apps/workspace/src/components/messaging/`

**Purpose:** Browser-based outbound voice calling with Twilio Client SDK, featuring active call modal, mute/end controls, duration timer, and microphone permission checks.

**SDK Loader (`twilio-sdk-loader.ts` - NEW):**
- Lazy-loads Twilio SDK from CDN (https://sdk.twilio.com/js/client/releases/2.3.0/twilio.js)
- Provides type definitions for `TwilioDeviceInstance`, `TwilioCall`, `TwilioCallEvent`
- Caches loaded SDK to prevent duplicate requests
- Returns type-safe Twilio Device class

**Voice Call Hook (`use-voice-call.ts` - NEW):**
- **State:** isAvailable, isLoading, callState (idle|connecting|ringing|connected|disconnecting|error), isMuted, duration, error
- **Actions:** initiateCall(toPhone, caseId), endCall(), toggleMute()
- **Features:**
  - Auto-loads Twilio SDK and fetches voice token on mount
  - Microphone permission check before initiating calls (getUserMedia)
  - Token refresh mechanism (5-min buffer before expiry)
  - Duration timer (increments every 1s during connected state)
  - Event listeners for ringing, accept, disconnect, cancel, error
  - Proper cleanup on unmount (device destroy, listeners removal, timer clear)
  - Vietnamese error messages with sanitization (removes technical details)

**Call Button Component (`call-button.tsx` - NEW):**
- Phone icon button in conversation header
- Shows loading spinner during SDK load
- Disabled during active calls or if voice unavailable
- Green pulsing icon during active call
- Vietnamese aria labels and tooltips
- Accessible (role, aria-label, aria-hidden for icons)

**Active Call Modal (`active-call-modal.tsx` - NEW):**
- Shows during connected call state
- Displays: client name, phone number, call duration (HH:MM:SS)
- Controls: Mute button (with visual indicator), End call button
- Focus trap to prevent interaction with page during call
- Backdrop click blocked during active call
- Escape key closes modal but doesn't disconnect call
- Vietnamese UI text

**Message Bubble Enhancement (`message-bubble.tsx` - MODIFIED):**
- Added CALL channel support (PhoneCall icon, label "Cuộc gọi", green color)
- Messages with channel='CALL' display as voice call records
- Shows call duration if available

**Integration with Messaging (`messages/$caseId.tsx` - MODIFIED):**
- Integrated voice calling via useVoiceCall() hook
- Call button added to conversation header
- Active call modal conditionally rendered
- Call button click opens phone input or initiates call directly

**API Integration:**
- `POST /voice/token` - Get access token for Twilio Device
- `POST /voice/calls` - Create message record + mark call initiated
- `GET /voice/status` - Check if voice feature available on backend

**Error Handling:**
- Microphone permission denied → "Bạn cần cấp quyền microphone để gọi điện"
- Device not found → "Không tìm thấy microphone"
- Network errors → "Lỗi kết nối mạng"
- Token refresh failure → "Không thể làm mới phiên gọi. Vui lòng tải lại trang"
- All technical errors sanitized to user-friendly Vietnamese messages

**Security:**
- Microphone permission checked before each call
- Token validation with 5-min buffer (prevents expired tokens mid-call)
- No sensitive data in error messages
- Call records tracked in database (call message channel)

**Features:**
- Browser-based calling (no app installation needed)
- Mute/unmute during call
- Call duration tracking (real-time counter)
- Microphone access verification
- Token auto-refresh before expiry
- Focus trap modal (prevents page interaction)
- Accessibility: ARIA labels, keyboard shortcuts (ESC to close)
- Vietnamese-first UI (all labels, tooltips, error messages)

### Audit Logger Service (Phase 01 - NEW)

**Location:** `apps/api/src/services/audit-logger.ts`

**Purpose:** Field-level change tracking for compliance audits and data governance.

**Core Functions:**
- `logProfileChanges(clientId, changes[], staffId?)` - Async batch logging of field changes
- `computeIntakeAnswersDiff(oldAnswers, newAnswers)` - Diff computation for intake answers
- `computeProfileFieldDiff(oldProfile, newProfile)` - Direct field change detection

**Features:**
- Non-blocking: Fires as background task (doesn't slow API responses)
- Field-level: Tracks individual changes, not entire records
- Staff attribution: Tracks who made changes and when
- Error resilient: Failures don't fail API requests

**Database:** AuditLog model with entityType (CLIENT_PROFILE|CLIENT|TAX_CASE), field names, old/new values, staff attribution

**Integration:** Used in `PATCH /clients/:id/profile` for intake answers & profile updates

### Checklist Generator Service (Phase 01 Condition System - UPGRADED)

**Location:** `apps/api/src/services/checklist-generator.ts` (~500 LOC)

**Phase 01 Upgrade (2026-01-20):**
- **Condition Types Framework** - 3-format support: legacy flat, simple with operators, compound AND/OR
- **Compound Conditions** - Type: AND/OR with nested conditions array, max depth 3 (prevents stack overflow)
- **Numeric Operators** - ===, !==, >, <, >=, <= for numeric/equality comparisons (legacy format had only strict equality)
- **Type Guards** - `isSimpleCondition()`, `isCompoundCondition()`, `isLegacyCondition()`, `isValidOperator()` in `@ella/shared`
- **Recursion Safe** - Depth tracking prevents DoS via deeply nested conditions
- **Cascade Cleanup API** - `POST /clients/:id/cascade-cleanup` endpoint auto-cleans dependent answers when parent toggles false

**New Cascade Cleanup Endpoint:**
- Accepts: `{ changedKey: string, caseId?: string }`
- Deletes dependent intake answers from `intakeAnswers` JSON
- Removes MISSING checklist items with failed conditions (if caseId provided)
- Returns: `{ deletedAnswers: string[], deletedItems: number }`
- Prevents orphaned conditional data (e.g., if hasChildren=false, childAge answers deleted)

**Condition Evaluation Flow:**
1. Parse JSON (10KB max size limit for DoS protection)
2. Dispatch to handler based on type (compound, simple, legacy)
3. Compound: Recursive evaluation of AND/OR with depth tracking
4. Simple: Operator comparison (actualValue vs expectedValue)
5. Legacy: Implicit AND across all key-value pairs (backward compatible)

**Test Suite (31 new tests):**
- 8 compound AND/OR logic tests
- 6 numeric operator tests (>, <, >=, <=, ===, !==)
- 5 cascade cleanup tests (dependency detection, orphaned data)
- 4 depth limit tests (recursion prevention)
- 3 legacy format tests (backward compatibility)
- 2 type guard tests
- 3 edge cases (invalid JSON, missing keys, empty conditions)

**Key Constants:**
- `MAX_CONDITION_SIZE` = 10KB (JSON string limit)
- `MAX_CONDITION_DEPTH` = 3 (max nesting levels)
- `COUNT_MAPPINGS` - Maps doc type to intake answer count key (w2Count, rentalPropertyCount, k1Count)

### Checklist Generator Service (Phase 03 - Expanded Templates)

**Location:** `packages/db/prisma/seed-checklist-templates.ts` | `apps/api/src/services/checklist-generator.ts`

**New Phase 03 DocTypes (9 additions, 60+ total types):**
- `EV_PURCHASE_AGREEMENT` - Electric vehicle purchase documentation (tax credits)
- `ENERGY_CREDIT_INVOICE` - Solar, insulation, home energy improvements
- `CLOSING_DISCLOSURE` - HUD closing statement (home sale)
- `FORM_8332` - Release of claim to exemption
- `BALANCE_SHEET` - Business financial statements
- `ARTICLES_OF_INCORPORATION` - Business formation docs
- `OPERATING_AGREEMENT` - Business operating agreements
- `MORTGAGE_POINTS_STATEMENT` - Deductible mortgage points
- `EXTENSION_PAYMENT_PROOF` - Form 4868 / prior year extension

**Checklist Templates Expansion:**
- **New Count:** 92 templates (Phase 03 +13 new)
- **New Categories:** home_sale, credits (energy), business_formation
- **Template Categories (22 types):**
  - personal (5): SSN, DL, passport, birth cert, ITIN
  - employment (2): W2, W2G
  - income_1099 (10): INT, DIV, NEC, MISC, K, R, G, SSA, B, S, C, SA, Q
  - k1 (4): K1, K1_1065, K1_1120S, K1_1041
  - health (4): 1095-A/B/C, 5498-SA
  - education (2): 1098-T, 1098-E
  - deductions (3): 1098, 8332, mortgage_points
  - business (6): bank statement, P&L, balance sheet, business license, EIN, payroll
  - receipts (6): generic, daycare, charity, medical, property tax, estimated tax
  - home_sale (2): closing disclosure, lease agreement (NEW)
  - credits (2): EV purchase, energy invoice (NEW)
  - prior_year (2): prior return, extension proof (NEW)
  - foreign (4): bank statement, tax statement, FBAR, 8938
  - crypto (1): crypto statement
  - business_formation (3): articles, operating agreement (NEW)

**COUNT_MAPPINGS Expansion:**
```typescript
const COUNT_MAPPINGS = {
  W2: 'w2Count',
  SCHEDULE_K1: 'k1Count',
  SCHEDULE_K1_1065: 'k1Count',
  SCHEDULE_K1_1120S: 'k1Count',
  SCHEDULE_K1_1041: 'k1Count',
  RENTAL_STATEMENT: 'rentalPropertyCount'
}
```

**Vietnamese Labels (All 92 templates):**
Each template includes `labelVi`, `descriptionVi`, `hintVi` for full i18n support.

### Checklist Generator Service (Phase 3 - Enhanced)

**Location:** `apps/api/src/services/checklist-generator.ts`

**Key Features:**
- **ConditionContext:** Combines legacy profile fields + dynamic intakeAnswers JSON
- **Priority System:** intakeAnswers checked first, fallback to profile fields (prevents data conflicts)
- **Condition Evaluation:** AND logic across multiple keys, JSON size limit (10KB DoS protection)
- **Dynamic Counts:** w2Count, rentalPropertyCount, k1Count read from intakeAnswers
- **Defaults:** Bank statements 12 months, others template expectedCount or 1
- **Type Validation:** intakeAnswers validated as plain object (rejects arrays/primitives)
- **Refresh Flow:** Preserves VERIFIED items, re-evaluates MISSING items on profile updates

**Functions:**
- `generateChecklist(caseId, taxTypes[], profile)` - Create checklist items from templates
- `refreshChecklist(caseId)` - Re-evaluate MISSING items after profile/intakeAnswers change

**Unit Tests (15):** Condition evaluation, intakeAnswers priority, AND logic, count mappings, invalid JSON, DoS protection, refresh flow

### AI Classification & Document Processing

**Locations:**
- Classification Prompt: `apps/api/src/services/ai/prompts/classify.ts`
- Classifier Service: `apps/api/src/services/ai/document-classifier.ts`
- OCR Extraction: `apps/api/src/services/ai/ocr-extractor.ts`
- PDF Conversion: `apps/api/src/services/pdf/pdf-converter.ts`

### Document Classification (Phase 01 - Enhanced)

**Function:** `classifyDocument(imageBuffer, mimeType): Promise<DocumentClassificationResult>`

**Classification Enhancements (2026-01-16):**
- **6 Few-Shot Examples:** W-2, SSN Card, 1099-K, 1099-INT, 1099-NEC, Driver's License with confidence scores
- **Vietnamese Name Handling:** Family name FIRST, common surnames, ALL CAPS format, middle names
- **Confidence Calibration:** HIGH (0.85-0.95), MEDIUM (0.60-0.84), LOW (<0.60), UNKNOWN (<0.30)
- **Alternativeypes:** Included when confidence <0.80 to help reviewers

**Supported Document Types (60+ types + UNKNOWN):**
Includes: ID (3), Employment (2), 1099-Series (13), K-1 (4), Health (4), Education (2), Deductions (2), Business (10), Receipts (6), Home Sale (2), Credits (2), Prior Year (2), Foreign (4), Crypto (1), Other (2).

**Phase 03 Additions (9 new):**
EV_PURCHASE_AGREEMENT, ENERGY_CREDIT_INVOICE, CLOSING_DISCLOSURE, FORM_8332, BALANCE_SHEET, ARTICLES_OF_INCORPORATION, OPERATING_AGREEMENT, MORTGAGE_POINTS_STATEMENT, EXTENSION_PAYMENT_PROOF.

**Vietnamese Classification Labels (Phase 03):**
All 60+ DocTypes now have Vietnamese labels in classifier service for bilingual support.

**Performance:** 2-5s per image

### PDF Converter Service (Phase 01 - Enhanced Phase 3)

**Function:** `convertPdfToImages(pdfBuffer): Promise<PdfConversionResult>`
- 200 DPI PNG rendering for optimal OCR & classification accuracy
- Magic bytes validation + encryption detection
- 20MB size limit, 10-page maximum, auto temp cleanup
- Vietnamese error messages (INVALID_PDF, ENCRYPTED_PDF, TOO_LARGE, TOO_MANY_PAGES)

**Phase 3 Enhancement (2026-01-17):**
- Now used in classification pipeline (Step 2: fetch-image)
- PDF first page converted to PNG before Gemini classification
- Solves API compatibility - Gemini may reject raw PDF input
- Matches OCR extractor behavior for consistency

### OCR Extraction Service (Phase 02 - Enhanced Phase 2 Priority 1)

**Function:** `extractDocumentData(buffer, mimeType, docType): Promise<OcrExtractionResult>`
- **Single Images:** Direct Gemini vision → JSON data + confidence score
- **Multi-Page PDFs:**
  - Auto-converts each page to PNG
  - Processes each page independently through OCR
  - **Intelligent Merge:** Later pages override earlier values (handles amendments)
  - **Weighted Confidence:** Confidence weighted by field contribution across pages
  - Returns: `pageCount`, `pageConfidences[]`, merged `extractedData`

**OCR Extraction Strategy (Exclusion-Based):**
Excludes 9 types: PASSPORT, PROFIT_LOSS_STATEMENT, BUSINESS_LICENSE, EIN_LETTER, RECEIPT, BIRTH_CERTIFICATE, DAYCARE_RECEIPT, OTHER, UNKNOWN. All other types require OCR.

**Phase 2 Priority 1 - New Document Types (2026-01-17):**
- **FORM_1099_K** - Payment Card Transactions (Square, Clover, PayPal)
- **SCHEDULE_K1** - Partnership Income (K-1 forms)
- **BANK_STATEMENT** - Business Cash Flow documentation

**Phase 3 - Extended OCR Support (2026-01-17):**
- **FORM_1099_DIV** - Dividends and distributions
- **FORM_1099_R** - Retirement distributions (IRAs, pensions, annuities)
- **FORM_1099_SSA** - Social Security benefits
- **FORM_1098** - Mortgage interest and property taxes
- **FORM_1095_A** - Health insurance marketplace coverage

**Phase 4 Priority 3 - OCR Expansion (2026-01-17 NEW):**
- **FORM_1098_T** - Tuition statements, education credits
- **FORM_1099_G** - Government payments, unemployment compensation
- **FORM_1099_MISC** - Miscellaneous income (rents, royalties, other)

**Supported OCR Prompts (16 total):**
- `prompts/ocr/w2.ts` - W-2 employment income
- `prompts/ocr/1099-int.ts` - Interest income
- `prompts/ocr/1099-nec.ts` - Contractor compensation
- `prompts/ocr/1099-k.ts` - Payment card transactions
- `prompts/ocr/k-1.ts` - Partnership income
- `prompts/ocr/bank-statement.ts` - Business cash flow
- `prompts/ocr/1099-div.ts` - Dividends
- `prompts/ocr/1099-r.ts` - Retirement distributions
- `prompts/ocr/1099-ssa.ts` - Social Security benefits
- `prompts/ocr/1098.ts` - Mortgage interest
- `prompts/ocr/1095-a.ts` - Health insurance marketplace
- `prompts/ocr/1098-t.ts` (NEW Phase 4 P3) - Education credits
- `prompts/ocr/1099-g.ts` (NEW Phase 4 P3) - Government payments
- `prompts/ocr/1099-misc.ts` (NEW Phase 4 P3) - Miscellaneous income
- `prompts/ocr/ssn-dl.ts` - SSN card & driver's license

**Performance:** +500ms per page for PDFs

**Testing:** 20+ unit tests covering single/multi-page, merging, confidence weighting

See [Phase 01 PDF Converter documentation](./phase-01-pdf-converter.md) for full details.

## Development Quick Start

```bash
pnpm install
pnpm -F @ella/db generate && pnpm -F @ella/db push && pnpm -F @ella/db seed
turbo run dev    # All apps in parallel
turbo lint       # ESLint
pnpm format      # Prettier
pnpm type-check  # TypeScript
```

## Environment Variables

**Required:** `DATABASE_URL=postgresql://...`

**Auth (Phase 3):** `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_DAYS`

**AI (Phase 2.1):** `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_BATCH_CONCURRENCY`
- Health endpoint reports model availability (Phase 02)
- Startup validation runs non-blocking on server start
- Cached status accessible via `GET /health` → `gemini` field

**SMS (Phase 3.1):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

See [phase-02-api-endpoints.md](./phase-02-api-endpoints.md) for full environment reference.

## Field Reference System (Phase 05 - Updated 2026-01-17)

**Purpose:** Centralized field mappings and Vietnamese labels for document type verification workflow.

**Files:**
- `apps/workspace/src/lib/doc-type-fields.ts` - Field arrays for each document type (18 types)
- `apps/workspace/src/lib/field-labels.ts` - Vietnamese labels for 200+ extracted data fields

**1099-NEC Field Update (Phase 3 - 2026-01-17):**
- Expanded from 6 to 18 fields
- Added payer/recipient full info (address, phone, TIN/SSN)
- Flattened state tax array (state, statePayerStateNo, stateIncome)
- Updated field casing to match OCR schema (payerTIN, recipientTIN)

**Verification Modal Integration:**
- Uses `getFieldLabel(docType, fieldKey)` for display
- Flattens nested `stateTaxInfo` arrays automatically
- Supports 24+ document types with type-safe field references

See [phase-05-verification-modal.md](./phase-05-verification-modal.md) for detailed field mappings and verification workflow.

## Recent Feature: Client Messages Tab (NEW - 2026-01-15)

**Location:** `apps/workspace/src/components/client-detail/`

**Component:** `ClientMessagesTab` (~210 LOC)
- SMS-only messaging within client detail page
- 10s polling (only when tab active)
- Race condition protection via fetch ID tracking
- Reuses MessageThread + QuickActionsBar
- Error handling + retry button
- Vietnamese UI

See [Client Messages Tab Feature](./client-messages-tab-feature.md) for full details.

## Recent Feature: Phase 02 Intake Questions Expansion (NEW - 2026-01-20)

**Location:** `packages/shared/src/types/intake-answers.ts` | `packages/db/prisma/seed-intake-questions.ts` | `apps/workspace/src/components/clients/`

**Scope: +70 Missing CPA Questions from PDF Guides**

**IntakeAnswers Type Expansion (~40 new fields):**

New categories:
- **Prior Year / Filing (7):** hasExtensionFiled, estimatedTaxPaid, estimatedTaxAmountTotal, estimatedTaxPaidQ1-Q4, priorYearAGI
- **Income - Employment (3):** w2Count, has1099NEC, num1099Types, hasJuryDutyPay
- **Home Sale (5):** homeSaleGrossProceeds, homeSaleGain, monthsLivedInHome, homeOfficeSqFt, homeOfficeMethod (SIMPLIFIED|REGULAR)
- **Rental Income (4):** rentalPropertyCount, rentalMonthsRented, rentalPersonalUseDays, k1Count
- **Dependents (4):** numDependentsCTC, daycareAmount, childcareProviderName, childcareProviderEIN
- **Deductions (5):** helocInterestPurpose (HOME_IMPROVEMENT|OTHER), noncashDonationValue, medicalMileage, hasCasualtyLoss
- **Credits (3):** energyCreditInvoice, hasRDCredit
- **Foreign (4):** fbarMaxBalance, feieResidencyStartDate, feieResidencyEndDate, foreignGiftValue

**New Form Sections (18 total, 2 new):**
- `prior_year` - Extension, estimated tax payments by quarter, prior year AGI
- `filing` - Delivery preference (EMAIL|MAIL|PICKUP), refund routing details

**Seed Data Expansion (116 total questions, +50):**
- Form 1040 base questions (filing status, refund method, tax year)
- Prior year section (7 questions with conditional visibility)
- Filing/delivery section (3 questions)
- Estimated tax Q1-Q4 breakdown (conditional on estimatedTaxPaid=true)
- All sections now include Vietnamese labels + hints

**Component Optimization:**
- **IntakeQuestion** - Added React.memo for performance with 100+ questions
  - Prevents unnecessary re-renders on form value changes
  - Memoization key: questionKey, fieldType, fieldValue changes
  - Comment: "Memoized for performance with 100+ questions"
- Export pattern: `export const IntakeQuestion = memo(function IntakeQuestion({...}))`

**Numeric Validation Enhancements:**
- Estimated tax Q1-Q4 hints specify: "Nhập giá trị từ 0 - 99,999,999" (input 0 - 99,999,999)
- Number fields constrained via fieldType validation (0-99 internally for age/count fields)

**Validation Schema Updates (@ella/shared):**
- intakeAnswersSchema now validates 40+ optional fields
- Size limit: 50KB JSON string (intake answers)
- Type constraints: boolean | number | string | undefined

**Backward Compatibility:**
- Dynamic [key: string] property in IntakeAnswers interface allows custom fields
- parseIntakeAnswers() safe-parses JSON with fallback to empty object
- Condition evaluation supports legacy format (Phase 01 compatible)

See [Phase 2 - Checklist & Questionnaire Redesign](./phase-2-checklist-questionnaire-redesign.md) for form details.

## Recent Feature: Phase 4 Checklist Display Enhancement (NEW - 2026-01-19)

**Location:** `apps/workspace/src/components/cases/`

**Components (3 new):**
1. **ChecklistProgress** (~50 LOC) - Visual progress bar showing completion %, status breakdown (Missing, Has Raw, Has Digital, Verified, Not Required)
2. **TieredChecklist** (~350+ LOC) - Main 3-tier checklist (Required/Applicable/Optional) with staff actions (skip, unskip, view, add notes), file preview integration, expandable sections
3. **AddChecklistItemModal** (~140 LOC) - Form modal for staff to add manual items, document type dropdown, optional reason (500 char), expected count (1-99)

**API Endpoints (4 new):**
- `POST /cases/:id/checklist/items` - Add manual checklist item
- `PATCH /cases/:id/checklist/items/:itemId/skip` - Skip item (mark NOT_REQUIRED)
- `PATCH /cases/:id/checklist/items/:itemId/unskip` - Restore skipped item (smart status inference)
- `PATCH /cases/:id/checklist/items/:itemId/notes` - Update item notes

**Database Schema Updates:**
- ChecklistItem: Added `isManuallyAdded`, `addedById`, `addedReason`, `skippedAt`, `skippedById`, `skippedReason` fields
- Staff: Added relations to track AddedChecklistItems, SkippedChecklistItems
- Composite index: `[caseId, status]` for efficient queries

**Constants Library:**
- `checklist-tier-constants.ts` - CHECKLIST_TIERS (3 tiers with Vietnamese labels + colors), CHECKLIST_STATUS_DISPLAY (5 statuses)

**Tier Categorization Logic:**
- Required: `isRequired=true` AND no condition
- Applicable: Has conditional logic
- Optional: `isRequired=false` AND no condition

**API Client Methods:**
- `addChecklistItem(caseId, data)` - POST new item
- `skipChecklistItem(caseId, itemId, reason)` - PATCH skip
- `unskipChecklistItem(caseId, itemId)` - PATCH unskip (auto-infers status)
- `updateChecklistItemNotes(caseId, itemId, notes)` - PATCH notes

See [Phase 4 - Checklist Display Enhancement](./phase-4-checklist-display-enhancement.md) for full details.

## Recent Feature: Phase 5 Admin Settings Polish (NEW - 2026-01-19)

**Location:** `apps/api/src/routes/admin/`

**Validators (2 new):**
1. **jsonStringSchema** - Validates JSON strings with 2000 char size limit (DoS protection)
2. **conditionJsonSchema** - Validates condition objects: `{ key: boolean | string | number }` (rejects arrays/primitives)

**API Endpoints (3 modules):**
- Intake Questions CRUD: `GET/POST/PUT/DELETE /admin/intake-questions`
- Checklist Templates CRUD: `GET/POST/PUT/DELETE /admin/checklist-templates`
- Doc Type Library CRUD: `GET/POST/PUT/DELETE /admin/doc-type-library`

**Test Suite (29 tests):**
- 8 intake question tests (filtering, CRUD, invalid JSON)
- 5 checklist template tests (CRUD, preserve immutable fields)
- 3 doc type library tests (CRUD with aliases/keywords)
- 13 schema validation tests (JSON format, size limits, type safety)

**Admin UI Tabs (4):**
- Appearance - UI theme settings
- Checklist - Checklist template management
- Questions - Intake question management
- Doc Library - Document type library management

See [Phase 5 - Admin Settings Polish](./phase-5-admin-settings-polish.md) for full details.

## Recent Feature: Phase 05 Testing & Validation (NEW - 2026-01-20)

**Location:** `apps/api/src/services/__tests__/` | `apps/api/src/services/ai/__tests__/`

**Test Coverage Summary:**

### Checklist Generator Tests (Phase 05 Expansion - 16 NEW)
**File:** `apps/api/src/services/__tests__/checklist-generator.test.ts` (~1,310 LOC)
**Framework:** Vitest with Prisma mocking
**Total Tests:** 46 tests across 3 describe blocks

**New Phase 05 Test Categories:**

1. **Count-Based Items (5 tests)** - Dynamic document counts from intake answers
   - `rentalPropertyCount` for RENTAL_STATEMENT, LEASE_AGREEMENT
   - `k1Count` for SCHEDULE_K1 variants
   - `num1099NECReceived` for FORM_1099_NEC
   - Template default fallback when count not provided
   - Zero/negative count rejection

2. **Research-Based Scenarios (5 tests)** - Real-world tax situations
   - Simple W2 employee: SSN, ID, W2 documents
   - Self-employed with vehicle: Mileage log + compound conditions
   - Foreign accounts above FBAR threshold (>$10,000)
   - Foreign accounts below threshold (excluded)
   - Multiple rental properties: Sets expectedCount correctly

3. **Profile Fallback Behavior (3 tests)** - Priority resolution
   - intakeAnswers takes priority over legacy profile fields
   - Fallback to profile when key not in intakeAnswers
   - Returns false when key in neither source

4. **Performance Tests (2 tests)**
   - 100 templates with various condition types (<100ms)
   - Deeply nested OR with 10 conditions (<50ms)

5. **Prior Tests (31):** Condition evaluation, AND/OR logic, operators, nested conditions, depth limits, etc.

**Mock Setup:**
- Mocked `prisma.checklistTemplate.findMany()`, `prisma.checklistItem.createMany()`, `prisma.taxCase.findUnique()`
- Helper: `createMockProfile()`, `createMockTemplate()` factories

**Key Test Insights:**
- Tests validate intakeAnswers as primary data source
- Confirms count-based items (w2Count=3 → 3 expected W-2s)
- Validates compound AND/OR condition evaluation (max depth 3)
- Performance baseline: <100ms for 100 templates

### Classification Prompt Tests (Phase 05 Expansion - DOC TYPE COUNT: 24 → 64)
**File:** `apps/api/src/services/ai/__tests__/classification-prompts.test.ts` (~380 LOC)
**Framework:** Vitest
**Total Tests:** 32 tests across 3 describe blocks

**Test Structure:**

1. **Few-Shot Examples (6 tests)**
   - W-2 Form with title & wage boxes
   - SSN Card
   - 1099-K payment card
   - 1099-INT interest income
   - 1099-NEC contractor income
   - Driver License

2. **Vietnamese Name Handling (3 tests)**
   - Includes VIETNAMESE NAME HANDLING section
   - Lists common surnames (Nguyen, Tran, Le, Pham)
   - Explains family name FIRST convention

3. **Confidence Calibration (4 tests)**
   - HIGH: 0.85-0.95
   - MEDIUM: 0.60-0.84
   - LOW: <0.60
   - Never > 0.95 guidance

4. **Document Types (7 tests)**
   - All major categories (ID, TAX FORMS, BUSINESS)
   - All 1099 variants (INT, DIV, NEC, MISC, K, R, G, SSA)
   - ID types (SSN_CARD, DRIVER_LICENSE, PASSPORT)
   - Deduction forms (1098, 1098_T, 1095_A)
   - Business docs (BANK_STATEMENT, SCHEDULE_K1)

5. **JSON Response Format (2 tests)**
   - Specifies JSON format requirement
   - Includes docType, confidence, reasoning, alternativeTypes

6. **Classification Rules (2 tests)**
   - 1099 variant verification
   - CORRECTED checkbox detection

7. **Validation Tests (8 tests)**
   - Valid classification results
   - Results with alternativeTypes
   - UNKNOWN docType handling
   - Confidence boundary tests (0, 1)
   - Invalid results (wrong type, out-of-range confidence)
   - Missing required fields (docType, confidence, reasoning)

**SUPPORTED_DOC_TYPES Count Update:**
- **Phase 04/03:** 24 types → **Phase 05:** 64 types (COMPREHENSIVE INTAKE COVERAGE)
- Test verifies exact count: `expect(SUPPORTED_DOC_TYPES.length).toBe(64)`
- Includes: ID (3), Income Forms (10), K-1 (4), Deductions (3), Business (4), Receipts (6), Home Sale (2), Credits (2), Prior Year (2), Foreign (4), Crypto (1), Other (2)

**Validation Schema:**
- Type safety via TypeScript enums
- Field presence checks (docType, confidence, reasoning required)
- Type constraints (string docType, number confidence 0-1, string reasoning)
- Null/undefined rejection

## Recent Feature: Phase 02 Section Edit Modal (NEW - 2026-01-20)

**Location:** `apps/workspace/src/components/clients/` | `apps/workspace/src/lib/`

**New Files:**
1. **intake-form-config.ts** - Centralized intake form configuration
   - `SECTION_CONFIG` - 18 sections with Vietnamese labels (personal_info, prior_year, filing, etc.)
   - `FIELD_CONFIG` - 95+ fields with labels, sections, formats, and options
   - `SELECT_LABELS` - Display labels for enum values (homeOfficeMethod, accountingMethod, etc.)
   - `NON_EDITABLE_SECTIONS` - Read-only sections (personal_info, tax_info)
   - Helper: `formatToFieldType()` - Converts format type to IntakeQuestion fieldType

2. **SectionEditModal** (~200 LOC) - Modal component for editing section data
   - Props: `isOpen`, `onClose`, `sectionKey`, `client`
   - Features: Re-uses IntakeQuestion component, dirty tracking, Escape key handling
   - Integration: Uses `api.clients.updateProfile()` for saving
   - UX: Toast notifications, error display, submit button disabled during save
   - Supports all field types: BOOLEAN, NUMBER, CURRENCY, NUMBER_INPUT, SELECT, TEXT

3. **api-client.ts** - Added new method
   - `updateProfile(clientId, data: UpdateProfileInput)` - PATCH /clients/:id/profile
   - Input: `{ intakeAnswers: Record<string, boolean|number|string> }`

**ClientOverviewSections** - Enhanced with edit capability
- Added edit icons next to section titles (Pencil icon)
- Integrates SectionEditModal for field editing
- State: `editingSectionKey` tracks active editing modal
- Click handler: Opens modal for that section

**Usage Pattern:**
```typescript
const [editingSectionKey, setEditingSectionKey] = useState<string | null>(null)
// In section header:
<button onClick={() => setEditingSectionKey(sectionKey)}>
  <Pencil className="w-4 h-4" />
</button>
// Render modal:
<SectionEditModal
  isOpen={editingSectionKey === sectionKey}
  onClose={() => setEditingSectionKey(null)}
  sectionKey={editingSectionKey || ''}
  client={client}
/>
```

**Integration with Audit Logging:**
- Section edits trigger `PATCH /clients/:id/profile` endpoint
- Backend logs all field changes via audit logger service (Phase 01)
- Staff attribution tracked automatically

## Recent Feature: Phase 03 Quick-Edit Icons (NEW - 2026-01-20)

**Location:** `apps/workspace/src/components/clients/`

**New Component: QuickEditModal** (~260 LOC)
- **Purpose:** Mini modal for inline editing of personal info fields (name, phone, email)
- **File:** `apps/workspace/src/components/clients/quick-edit-modal.tsx`

**Features:**
- **Wrapper Pattern:** Component wrapper ensures fresh state on each open (no stale form data)
  - Parent checks `isOpen` prop, returns null if false
  - Inner component `QuickEditModalContent` mounts/unmounts with modal
  - Effect: `useState` initializes to fresh values each time modal opens
- **Field-Specific Validation:**
  - **Name:** 2-100 characters, required
  - **Phone:** US E.164 format (+1 + 10 digits), required, example: +14155551234
  - **Email:** RFC 5322 compliant pattern, optional but validated if provided, max 254 chars
- **Accessibility:**
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
  - Error messages with `role="alert"`
  - Keyboard shortcuts: Enter (save), Escape (close)
  - Global escape listener for reliable key handling
  - Auto-focus input on modal open (50ms delay for browser focus)
- **UX Polish:**
  - Input auto-focus on mount (focus timer with cleanup)
  - Format hint for phone field (Vietnamese: "Định dạng: +1 và 10 số")
  - Save button disabled if no changes
  - Loading state: Spinner + "Đang lưu..." text while saving
  - All buttons disabled during submission
  - Toast notifications: Success message with field label
  - Backdrop click closes modal (when not saving)

**API Integration:**
- Uses `api.clients.update(clientId, data)` endpoint (existing)
- Input type: `UpdateClientInput` with `{ name?, phone?, email? }`
- Email can be null (empty string → null for optional field)

**State Management:**
- React Query mutation for update request
- Automatic cache invalidation via `queryClient.invalidateQueries(['client', clientId])`
- Error state displayed in modal with clear messaging

**Integration with ClientOverviewSections:**
- Personal info section marked with `editable: true` for name, phone, email rows
- Quick edit icons shown as pencil buttons next to field values
- Click handler: `setQuickEditField(fieldName)` opens modal
- Modal receives current value, client ID, field name as props
- On close: `setQuickEditField(null)` hides modal

**Type Definitions:**
```typescript
export type QuickEditField = 'name' | 'phone' | 'email'

interface QuickEditModalProps {
  isOpen: boolean
  onClose: () => void
  field: QuickEditField
  currentValue: string
  clientId: string
}
```

**Validation Rules (Field-Specific):**
- **Phone E.164:** Regex `/^\+1\d{10}$/` (business requirement: US-based tax services)
- **Email RFC 5322:** Simplified pattern supporting common cases, full DNS validation not required
- **Name length:** Enforced at input and validation layers (2-100 chars)
- Whitespace trimmed before validation and save

**Styling:**
- Fixed position overlay with black/50 backdrop
- Compact modal: max-width 28rem (448px), responsive with mx-4 margin
- Dialog with rounded-xl corners, shadow-xl depth
- Header/body/footer sections with consistent spacing (p-4)
- Border separators between sections
- Focus ring on input: ring-primary/50 with smooth transitions
- Button disabled states: opacity-50, cursor-not-allowed
- Vietnamese labels and UI text throughout

## Recent Feature: Phase 05 Security Enhancements (NEW - 2026-01-20)

**Location:** `apps/api/src/routes/clients/schemas.ts` | `apps/api/src/routes/clients/index.ts`

**Security Hardening (2 areas):**

1. **Prototype Pollution Prevention (DANGEROUS_KEYS)**
   - **File:** `apps/api/src/routes/clients/schemas.ts` (lines 106-119)
   - **Blocklist:** 10 dangerous keys: `__proto__`, `constructor`, `prototype`, `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`
   - **Validation:** `updateProfileSchema` includes `.refine()` check via `DANGEROUS_KEYS.has(key)`
   - **Error Message:** "Reserved key name not allowed (potential prototype pollution)"
   - **Scope:** Applies to `intakeAnswers` partial updates in `PATCH /clients/:id/profile`

2. **XSS Prevention for String Values**
   - **File:** `apps/api/src/routes/clients/index.ts` (lines 467-476)
   - **Implementation:** Sanitizes all string values in intakeAnswers via `sanitizeTextInput(value, 500)`
   - **Defense Layer:** Backend sanitization + frontend escaping (defense-in-depth)
   - **Function:** Applies to each string entry during profile update before merge
   - **Example:** `"<script>alert('xss')</script>"` → sanitized before storage

**Additional Tests Added (Phase 05):**
- **profile-update.test.ts** (22 tests) - Tests PATCH /clients/:id/profile endpoint with XSS/injection payloads
- **audit-logger.test.ts** (22 tests) - Validates audit logging of profile changes

## Recent Feature: Phase 04 Checklist Recalculation Integration (UPDATED - 2026-01-20)

**Location:** `apps/workspace/src/lib/api-client.ts` | `apps/workspace/src/components/clients/section-edit-modal.tsx`

**API Response Enhancement:**
- **UpdateProfileResponse Interface** - New response type for profile update endpoint (POST /clients/:id/profile)
  - `profile: ClientProfile` - Updated client profile
  - `checklistRefreshed: boolean` - Indicates if checklist was regenerated
  - `cascadeCleanup.triggeredBy: string[]` - Field keys that triggered cascade cleanup
  - Backend handles: Evaluates conditions on intakeAnswers change, regenerates checklist items, cascades cleanup of dependent answers

**Frontend Integration:**
- **SectionEditModal** - Enhanced with checklist query invalidation
  - onSuccess handler: Invalidates `['checklist', activeCaseId]` query when `response.checklistRefreshed=true`
  - Toast feedback: Shows "Checklist đã được cập nhật theo thay đổi" if cascade cleanup triggered
  - Pattern: Optimistic UI + server-driven refresh status (avoids unnecessary re-queries)
- **Query Invalidation Pattern:** React Query `invalidateQueries()` ensures stale checklist data refreshed on next fetch
- **User Feedback:** Two-tier toast system: main success + optional info toast for cascade events
- **Integration with Phase 05 Security:** Works seamlessly with XSS sanitization and prototype pollution prevention

## Recent Feature: Phase 04 UX Improvements (UPDATED - 2026-01-20)

**Location:** `apps/workspace/src/components/clients/` | `apps/workspace/src/components/cases/` | `apps/workspace/src/hooks/`

**Components (6 new + 1 hook):**

### IntakeProgress (~75 LOC)
- **Path:** `apps/workspace/src/components/clients/intake-progress.tsx`
- **Purpose:** Visual progress indicator for intake form completion
- **Props:** `questions[]`, `answers` object
- **Features:** Calculates % of visible (conditional) questions answered, shows `answered/total (%)` with progress bar
- **Condition Evaluation:** Supports legacy flat object + simple `key:value` format

### IntakeRepeater (~390 LOC)
- **Path:** `apps/workspace/src/components/clients/intake-repeater.tsx`
- **Purpose:** Repeater component for count-based intake fields (rental properties, K-1s, W-2s)
- **Props:** `countKey`, `itemLabel`, `labelVi`, `maxItems`, `fields[]`, `answers`, `onChange`
- **Features:** Renders N blocks based on count (e.g., 3 rentals = 3 property blocks), XSS sanitization for text fields, separate field input components
- **Field Types:** TEXT, NUMBER, BOOLEAN, SELECT with Vietnamese labels
- **Export:** `REPEATER_CONFIGS` (pre-built rental/k1/w2 configurations)

### MultiSectionIntakeForm Smart Auto-Expand (~360 LOC)
- **Path:** `apps/workspace/src/components/clients/multi-section-intake-form.tsx`
- **Updates:** Enhanced section auto-expand logic
- **SECTION_TRIGGERS:** Record mapping section name → answer keys that trigger auto-expand
  - `business` → `['hasSelfEmployment']`
  - `dependents` → `['hasKidsUnder17', 'hasKids17to24', 'hasOtherDependents']`
  - `health` → `['hasMarketplaceCoverage', 'hasHSA']`
  - `deductions` → `['hasMortgage', 'hasPropertyTax', 'hasCharitableDonations', 'hasMedicalExpenses']`
  - `credits` → `['hasEnergyCredits', 'hasEVCredit', 'hasAdoptionExpenses']`
  - `foreign` → `['hasForeignAccounts', 'hasForeignIncome']`
  - `prior_year` → `['hasExtensionFiled', 'estimatedTaxPaid']`
- **getSectionDefaultOpen():** Returns true if (1) section config defaultOpen, (2) section has answers, or (3) trigger key is true

### TieredChecklist Context Labels (~350 LOC)
- **Path:** `apps/workspace/src/components/cases/tiered-checklist.tsx`
- **Updates:** Added `CONTEXT_LABEL_MAPPINGS` for multi-entity doc types
- **Mapping:** Maps DocType → `{ countKey, labelPrefix }`
  - `RENTAL_STATEMENT`, `RENTAL_PL`, `LEASE_AGREEMENT` → countKey: `rentalPropertyCount`, labelPrefix: `'Bất động sản'`
  - `SCHEDULE_K1*` (4 variants) → countKey: `k1Count`, labelPrefix: `'K-1'`
  - `W2` → countKey: `w2Count`, labelPrefix: `'W-2'`
- **Usage:** Displays context badge (e.g., "W-2 #1") for items with `expectedCount > 1`

### SaveIndicator & SavedBadge (~135 LOC)
- **Path:** `apps/workspace/src/components/clients/save-indicator.tsx`
- **SaveIndicator Props:** `isSaving`, `isPending`, `error`, `position` (fixed|inline)
- **States:** Saving spinner → "Đang lưu..." | Pending pulse → "Chờ lưu..." | Error alert → "Lỗi: {message}"
- **Position:** Fixed (bottom-right, z-50) or inline (flow with content)
- **SavedBadge:** Brief "Đã lưu" confirmation badge with check icon, auto-hide via CSS animation

### SkipItemModal (~105 LOC)
- **Path:** `apps/workspace/src/components/cases/skip-item-modal.tsx`
- **Purpose:** Modal for entering skip reason (replaces JS prompt() for UX)
- **Props:** `isOpen`, `onClose`, `onSubmit`, `itemLabel`, `isSubmitting`
- **Features:** Textarea (500 char limit, auto-focus), validation (reason required), submit disabled when empty
- **Vietnamese:** Title "Bỏ qua mục", placeholder with example, hint text

### useDebouncedSave Hook (~135 LOC)
- **Path:** `apps/workspace/src/hooks/use-debounced-save.ts`
- **Options:** `delay` (default 1500ms), `onSave(data): Promise<void>`, `onSuccess`, `onError`, `enabled`
- **Returns:** `{ save, saveNow, cancel, isSaving, isPending, error }`
- **Behavior:**
  - `save(data)` → Debounced, updates `isPending` while waiting
  - `saveNow(data)` → Immediate (cancels pending debounce)
  - `cancel()` → Clear pending save
  - Handles unmount cleanup to prevent memory leaks
  - Tracks save errors in `error` state

## Design System

**Colors:** Mint #10b981, Coral #f97316, Success #22c55e, Error #ef4444
**Typography:** System font stack, 10-24px sizes
**Spacing:** 4-32px scale, rounded 6-full

## Documentation Structure

| File | Purpose |
|------|---------|
| [codebase-summary.md](./codebase-summary.md) | This file - quick reference |
| [phase-1.5-ui-components.md](./phase-1.5-ui-components.md) | UI library detailed reference |
| [client-messages-tab-feature.md](./client-messages-tab-feature.md) | Client Messages Tab implementation |
| [system-architecture.md](./system-architecture.md) | System design & data flow |
| [code-standards.md](./code-standards.md) | Coding standards & patterns |
| [project-overview-pdr.md](./project-overview-pdr.md) | Project vision & requirements |

---

**Last Updated:** 2026-01-20
**Status:** Phase 02 Voice Calls (Browser-based calling, Twilio Client SDK, active call modal, mute/end controls, duration timer, microphone permissions, token refresh, error sanitization) + Phase 01 Voice API (Token generation, TwiML routing, recording + status webhooks, E.164 validation, Twilio signature validation) + Phase 05 Security Enhancements (XSS sanitization + prototype pollution prevention) + Phase 04 Checklist Recalculation (UpdateProfileResponse) + Phase 03 Quick-Edit Icons (QuickEditModal, validation) + Phase 02 Section Edit Modal (SectionEditModal, 18 sections) + Phase 05 Testing & Validation (46 checklist + 32 classification tests) + Phase 04 UX Improvements (6 components + hook) + Phase 03 Checklist Templates (92 templates, 60+ doc types) + Phase 02 Intake Expansion (+70 CPA questions)
**Branch:** feature/more-enhancement
**Architecture Version:** 8.2.0 (Phase 02 Voice Calls - Browser-based calling with Twilio Client SDK, active call modal, mute/end/timer controls, microphone permission checks, token refresh management)

For detailed phase documentation, see [PHASE-04-INDEX.md](./PHASE-04-INDEX.md) or [PHASE-06-INDEX.md](./PHASE-06-INDEX.md).
