# Ella - Codebase Summary (Quick Reference)

**Current Date:** 2026-01-26
**Current Branch:** feature/multi-tax-year
**Latest Phase:** Phase 05 Frontend Updates - Multi-Year Client UI + Engagement History

## Project Status Overview

| Phase | Status | Completed |
|-------|--------|-----------|
| **Phase 5 Frontend Updates** | **TaxEngagement types + engagement helpers (@ella/shared); Engagement history section (new client component); Returning client detection (new client component); Multi-year tab support in client overview; Portal engagementId support; API client engagement methods (list/detail/create/update/preview/delete)** | **2026-01-26** |
| **Phase 4 API Updates** | **6 TaxEngagement REST endpoints (GET list/detail, POST create with copy-from, PATCH update, DELETE with validation, GET copy-preview); Engagement-specific audit logging (logEngagementChanges); RFC 8594 deprecation headers middleware; Tax cases now support engagementId FK** | **2026-01-26** |
| **Phase 3 Schema Cleanup** | **Made engagementId required (NO nullable); Cascade onDelete; Deprecated ClientProfile (reads via engagement); New helper service engagement-helpers.ts; Verification scripts; Route layer uses engagement for all operations** | **2026-01-26** |
| **Phase 1 Schema Migration** | **TaxEngagement model (year-specific profile); EngagementStatus enum (DRAFT/ACTIVE/COMPLETE/ARCHIVED); Client.engagements relation; TaxCase.engagementId FK (nullable for backward compat); Composite indexes (engagementId, status), (engagementId, lastActivityAt); AuditEntityType.TAX_ENGAGEMENT enum value** | **2026-01-25** |
| **Phase 04 Frontend Incoming Call UI** | **Accept/Reject modal (IncomingCallModal); CallerInfo display; API methods (lookupCaller, registerPresence, unregisterPresence, heartbeat); Web Audio API ring tone generator (ring-sound.ts); Twilio SDK methods (accept/reject with type-safe events); useVoiceCall hook (incomingCall state, presence tracking, toast notifications, mounted guard); VoiceCallProvider context + error boundary; __root.tsx wrapper** | **2026-01-22** |
| **Phase 03 Voicemail System** | **Unknown caller placeholder creation; findConversationByPhone() / createPlaceholderConversation() / formatVoicemailDuration() / isValidE164Phone() / sanitizeRecordingDuration() helpers; voicemail-recording webhook enhanced for known/unknown callers; transaction-based race condition handling; 55 unit tests; Vietnamese duration formatting** | **2026-01-22** |
| **Phase 02 Incoming Call Routing** | **generateIncomingTwiml() rings staff browsers; generateNoStaffTwiml() + generateVoicemailTwiml() Vietnamese voicemail; 3 webhooks (incoming/dial-complete/voicemail-recording); call routing to online staff; rate limiting; signature validation** | **2026-01-22** |
| **Phase 01 Inbound Call Backend Foundation** | **StaffPresence model; presence endpoints (register/unregister/heartbeat); caller lookup; rate limiting; incomingAllow enabled; E.164 phone validation** | **2026-01-21** |
| **Phase 4 Constants & Labels (Actionable Status)** | **Centralized constants: ACTION_BADGE_LABELS (6 Vietnamese labels), ACTION_BADGE_ARIA_LABELS (6 a11y labels), TIME_FORMATS localization, STALE_THRESHOLD_DAYS=7, ACTION_BADGE_COLORS config; refactored action-badge.tsx for maintainability & i18n** | **2026-01-22** |
| **Phase 3 Frontend (Actionable Status)** | **ComputedStatusBadge + ActionBadge components; client list sort (activity/name/stale); status action buttons (Send to Review/Mark Filed/Reopen); TaxCaseSummary type with isInReview/isFiled; computeStatus() utility** | **2026-01-21** |
| **Phase 2 API Changes (Actionable Status)** | **3 case status endpoints; enhanced GET /clients with sort/actionCounts; ComputedStatus + ActionCounts types; activity tracking service; 23 tests** | **2026-01-21** |
| **Phase 1 Database & Backend (Actionable Status)** | **TaxCase isInReview/isFiled flags; lastActivityAt tracking; computeStatus() priority system; calculateStaleDays() detection; updateLastActivity() service; ActionCounts types; 23 comprehensive tests** | **2026-01-21** |
| **Phase 02 Duplicate Detection UI** | **DuplicateDocsCard component; grid display of DUPLICATE docs; delete/classify-anyway actions; Toast notifications; responsive layout; memoized rendering** | **2026-01-21** |
| **Phase 03 Data Entry Tab** | **Responsive 4/3/2 col grid for verified docs; category-based grouping; key field extraction (2-3 fields per doc); copy all/individual fields; detail modal; ModalErrorFallback integration** | **2026-01-21** |
| **Phase 02 Document Tab Category Checklist** | **Category-based grouping (personal/income/deductions/business/other); 5→3 status consolidation (MISSING/SUBMITTED/VERIFIED); direct row-click verification** | **2026-01-21** |
| **Phase 01 Unclassified Docs Card** | **Grid display of UPLOADED/UNCLASSIFIED documents, responsive 4/3/2 col layout, lazy PDF thumbnails, signed URL caching, empty state** | **2026-01-21** |
| **Phase 03 Voice Recording Playback** | **Recording endpoints with proxy auth; AudioPlayer component (lazy-load, seek, time); message-bubble integration; RecordingSid validation; memory-efficient streaming** | **2026-01-20** |
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

## Phase 5 Frontend Updates - Multi-Year Client Support (NEW - 2026-01-26)

**Location:** `packages/shared/src/types/tax-engagement.ts`, `packages/shared/src/utils/engagement-helpers.ts`, `apps/workspace/src/components/clients/`, `apps/workspace/src/lib/api-client.ts`, `apps/portal/src/lib/api-client.ts`

**New Files (Shared Package):**

1. **tax-engagement.ts** - TypeScript types for multi-year engagement
   - `EngagementStatus` - DRAFT | ACTIVE | COMPLETE | ARCHIVED
   - `TaxEngagement` - Full engagement with year-specific profile (filingStatus, hasW2, etc.), intakeAnswers, timestamps
   - `TaxEngagementSummary` - Lightweight version for list views

2. **engagement-helpers.ts** - Backward compatibility utilities during phase 3 transition
   - `ProfileData` - Unified interface for engagement or legacy profile fields
   - `getProfileData(taxCase, legacyProfile?)` - Extract profile from engagement (preferred) or fallback to legacy
   - `normalizeTaxCase(taxCase)` - Guarantee engagementId present (uses case.id as fallback)
   - `hasEngagementProfile(taxCase)` - Check if case has engagement-based profile

**New Components (Workspace):**

1. **engagement-history-section.tsx** - Multi-year engagement display
   - Shows client engagement history grouped by tax year
   - Status badges (DRAFT, ACTIVE, COMPLETE, ARCHIVED)
   - Quick-access links to open engagement
   - Last activity timestamp per engagement

2. **returning-client-section.tsx** - Detect & suggest previous engagements
   - Automatic detection of returning clients (prior engagements exist)
   - Lists previous tax years with engagement status
   - Quick-select button to open prior year engagement
   - Integration in new client creation flow

**API Client Enhancements (Workspace):**

`apps/workspace/src/lib/api-client.ts` - New engagement methods:
- `engagements.list(params?)` - GET /engagements with filters (clientId, taxYear, status, pagination)
- `engagements.detail(id)` - GET /engagements/:id with full details
- `engagements.create(data)` - POST /engagements (with optional copyFromId)
- `engagements.update(id, data)` - PATCH /engagements/:id
- `engagements.copyPreview(id)` - GET /engagements/:id/copy-preview
- `engagements.delete(id)` - DELETE /engagements/:id

**Portal Updates (API Client):**

`apps/portal/src/lib/api-client.ts` - Added engagementId support:
- PortalTaxCase now includes `engagementId` field
- Enables portal to reference engagement for multi-year workflows

**UI Integration:**

- Client overview tab enhanced with engagement history display
- New client creation detects returning clients and offers prior engagement quick-link
- Engagement dropdown in client header for switching between years
- Status indicators guide user through engagement lifecycle

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
**REST API (Hono framework, PORT 3002)** - 58+ endpoints across 9 modules with Zod validation, global error handling, OpenAPI docs, audit logging (Phase 01), deprecation headers (Phase 4).

**Phase 4 New Files:**
- `src/routes/engagements/index.ts` - TaxEngagement CRUD (GET list/detail, POST create with copy-from, PATCH update, DELETE, GET copy-preview)
- `src/routes/engagements/schemas.ts` - Zod schemas for engagement validation (createEngagementSchema, updateEngagementSchema, listEngagementsQuerySchema)
- `src/middleware/deprecation.ts` - RFC 8594 deprecation headers middleware (clientId→engagementId migration signals)

**Phase 4 Enhancements:**
- `src/services/audit-logger.ts` - Extended with logEngagementChanges() + computeEngagementDiff() for TaxEngagement tracking
- `src/app.ts` - Registered /engagements routes with authMiddleware
- `src/routes/cases/index.ts` - Added engagementId support (backward compat with clientId)
- `src/routes/cases/schemas.ts` - Extended to support engagementId FK

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

## Frontend Voice Services

### Phase 04 Frontend Incoming Call UI (NEW - 2026-01-22)

**Location:** `apps/workspace/src/lib/api-client.ts`, `apps/workspace/src/lib/ring-sound.ts`, `apps/workspace/src/lib/twilio-sdk-loader.ts`, `apps/workspace/src/hooks/use-voice-call.ts`, `apps/workspace/src/components/messaging/incoming-call-modal.tsx`, `apps/workspace/src/components/voice/voice-call-provider.tsx`

**New API Methods (api-client.ts - 5 methods):**
1. `lookupCaller(phoneNumber: string): Promise<CallerLookupResponse>` - Retrieve caller info (name, conversation)
2. `registerPresence(phoneNumber: string): Promise<PresenceResponse>` - Mark staff as online
3. `unregisterPresence(): Promise<PresenceResponse>` - Mark staff as offline
4. `heartbeat(): Promise<HeartbeatResponse>` - Keep presence alive (10s intervals)
5. **Types:** CallerLookupResponse (caller name, conversationId), PresenceResponse (presenceId), HeartbeatResponse (success)

**Ring Sound Generator (ring-sound.ts - NEW):**
- Web Audio API oscillator-based ring tone (440Hz frequency)
- Graceful fallback to HTMLAudioElement if Web Audio unavailable
- Play/stop/volume control methods
- No external dependencies, pure browser API

**Twilio SDK Enhancements (twilio-sdk-loader.ts):**
- Added `accept()` method to TwilioCall class
- Added `reject()` method to TwilioCall class
- Type-safe event handlers for accept/reject results
- Error handling with Vietnamese messages

**useVoiceCall Hook (use-voice-call.ts - Enhanced):**
- **New State:** `incomingCall` (caller info), `callerInfo` (lookup result), `isRinging` (boolean)
- **New Actions:**
  - `acceptIncoming()` - Accept incoming call, stop ring tone
  - `rejectIncoming()` - Reject call, stop ring tone
- **Presence Tracking:** Automatic register on mount, heartbeat every 10s, unregister on unmount
- **Mounted Guard:** Prevents hydration mismatches with useEffect flag
- **Toast Notifications:** Success/error feedback for accept/reject actions
- **Ring Tone Management:** Auto-play on incoming call, stop on accept/reject

**IncomingCallModal Component (incoming-call-modal.tsx - NEW):**
- **Layout:** Full-screen modal overlay with centered card
- **Caller Display:**
  - Large caller name from `callerInfo`
  - Phone number formatted E.164
  - "Tin nhắn đến từ..." Vietnamese header
- **Action Buttons:**
  - Green "Trả lời" (Accept) button - calls `acceptIncoming()`
  - Red "Từ chối" (Reject) button - calls `rejectIncoming()`
  - Both buttons disabled during processing
- **Ring Animation:** Pulsing call icon during ring state
- **Vietnamese UI:** All text labels in Vietnamese

**VoiceCallProvider Context (voice-call-provider.tsx - NEW):**
- Wraps app with global voice call state
- Error boundary integration for crash safety
- Re-exports useVoiceCall hook
- Mounted on `__root.tsx` at app level

**Integration Changes:**
- `apps/workspace/src/routes/__root.tsx` - Wrapped with `<VoiceCallProvider>` at root level
- `apps/workspace/src/routeTree.gen.ts` - Auto-updated by TanStack Router
- `apps/portal/src/routeTree.gen.ts` - Auto-updated (portal routes unchanged)

**Key Features:**
- **Real-time Presence:** Staff heartbeat keeps session alive (10s interval)
- **Caller Lookup:** Fetch caller name from conversation/unknown caller placeholder
- **Type-Safe Events:** Twilio SDK accept/reject with proper TypeScript types
- **Ring Tone UX:** Web Audio API with fallback to native audio
- **Error Resilience:** Toast notifications for all failure scenarios
- **Memory Safe:** Cleanup all intervals/listeners on unmount

**Security:**
- API endpoints use staff JWT auth
- Caller lookup validates conversation ownership
- Presence token expires with session

## Backend Services

### Voice API Service (Phase 01-03)

**Location:** `apps/api/src/services/voice/`, `apps/api/src/routes/voice/`, `apps/api/src/routes/webhooks/twilio.ts`

**See [phase-03-voicemail-system.md](./phase-03-voicemail-system.md) for Phase 03 Voicemail System details.**

**Quick Summary:**
- Phase 01: Backend token generation, TwiML routing, recording webhooks
- Phase 02: Frontend browser calling + incoming call routing (rings staff browsers, voicemail routing)
- Phase 03: Unknown caller support with placeholder conversation creation (NEW); voicemail-recording webhook enhanced; helper functions (findConversationByPhone, createPlaceholderConversation, formatVoicemailDuration, isValidE164Phone, sanitizeRecordingDuration); transaction-based race condition handling; 55 unit tests

**Endpoints (6 total):**
- `POST /voice/token` - Get access token (returns JWT with VoiceGrant)
- `GET /voice/status` - Check availability (returns feature flags)
- `POST /voice/calls` - Create call message (returns messageId)
- `PATCH /voice/calls/:messageId` - Update with CallSid
- `GET /voice/recordings/:recordingSid` - Recording metadata (auth required)
- `GET /voice/recordings/:recordingSid/audio` - Proxy stream (Twilio auth, no client exposure)

**Webhooks (6 total):**
- `POST /webhooks/twilio/voice` - Outbound call routing (returns TwiML)
- `POST /webhooks/twilio/voice/incoming` - Incoming call from customer (NEW Phase 02: routes to online staff)
- `POST /webhooks/twilio/voice/dial-complete` - Staff ring timeout, route to voicemail (NEW Phase 02)
- `POST /webhooks/twilio/voice/voicemail-recording` - Voicemail recording completion (NEW Phase 02)
- `POST /webhooks/twilio/voice/recording` - Outbound recording completion callback
- `POST /webhooks/twilio/voice/status` - Call status updates

**Key Features:**
- Staff JWT auth (microphone permission checks, token 5-min buffer)
- Incoming call routing: Queries StaffPresence for online staff, rings all via Twilio Client (parallel dial)
- Max 10 staff browsers per incoming call (Twilio limit)
- 30-second ring timeout, auto-route to voicemail if no answer
- Vietnamese voicemail prompts (Google Wavenet-A voice) with recording (120s max)
- RecordingSid format validation (RE + 32 hex)
- Database access control (only staff-created recordings)
- Memory-efficient streaming (no full buffering)
- HTTP caching 3600s for repeated plays
- Vietnamese-first error messages
- Rate limiting: 60 requests/minute per IP on webhooks
- Signature validation: All webhooks validate Twilio HMAC-SHA1

### Frontend Voice Calling (Phase 02 - NEW)

**Location:** `apps/workspace/src/lib/twilio-sdk-loader.ts`, `apps/workspace/src/hooks/use-voice-call.ts`, `apps/workspace/src/components/messaging/`

**Components (5):**
1. **SDK Loader** - Lazy-loads CDN SDK, provides types, caches instance
2. **useVoiceCall Hook** - Manages Device, call state, token refresh (5-min buffer), microphone checks, duration timer
3. **CallButton** - Phone icon, shows spinner on load, disabled during active calls
4. **ActiveCallModal** - Shows during call, displays duration, mute/end controls, focus trap
5. **Message Bubble** - Added CALL channel support, displays call history

**Key Features:**
- Microphone permission check via getUserMedia
- Token auto-refresh 5 min before expiry
- Duration timer updates 1/sec during connected state
- Error messages sanitized to Vietnamese UI text
- Proper cleanup on unmount (device destroy, listeners removed, timers cleared)

### Voice Recording Playback (Phase 03 - NEW)

**Location:** `apps/api/src/routes/voice/index.ts` (2 endpoints) | `apps/workspace/src/components/messaging/audio-player.tsx` (player component)

**Backend:**
- `GET /voice/recordings/:recordingSid` - Metadata + proxied audio URL (auth required)
- `GET /voice/recordings/:recordingSid/audio` - MP3 streaming proxy (Twilio credentials server-side)

**Frontend AudioPlayer:**
- Lazy loads audio on first play (not on render)
- Play/pause toggle, seek bar, time display (M:SS format)
- Error handling with Vietnamese messages
- Proper cleanup on unmount (no memory leaks)

**Message Integration:**
- Embedded in CALL channel messages (if recordingUrl present)
- Call status badges (completed/busy/no-answer/failed with color coding)
- Duration display converted from recordingDuration seconds

**Security:**
- RecordingSid format validation (RE + 32 hex)
- Database lookup verifies staff access
- Twilio auth proxy (credentials never exposed to frontend)

**Performance:**
- Lazy loading: Saves bandwidth for non-played recordings
- Streaming: No buffering (memory efficient)
- HTTP cache: 3600s for repeated plays

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

## Phase 3 Schema Cleanup - Engagement Isolation (NEW - 2026-01-26)

**Location:** `packages/db/prisma/schema.prisma`, `apps/api/src/services/engagement-helpers.ts`, `packages/db/scripts/verify-phase2.ts`, `packages/db/scripts/verify-phase3.ts`

**Summary:** Enforces TaxEngagement model as primary data source; deprecates ClientProfile single-year context.

**Key Changes:**

1. **TaxCase.engagementId Constraint** - NOW REQUIRED (was nullable)
   - All TaxCases MUST link to TaxEngagement
   - onDelete: Cascade (deleting engagement cascades to cases)
   - Prevents orphaned records
   - DB constraint enforced at schema level

2. **ClientProfile Deprecation** - Marked read-only
   - Legacy single-year profile maintained for backward compatibility
   - All new operations use TaxEngagement profile snapshots
   - Data reads from engagement's year-specific fields (filingStatus, hasW2, etc.)
   - intakeAnswers now primary in TaxEngagement, not ClientProfile

3. **Engagement Helper Service** (`engagement-helpers.ts` - NEW)
   - `findOrCreateEngagement(tx, clientId, taxYear, profile?)` - Locates engagement or creates with profile copy
   - Returns: `{ engagementId, isNew: boolean }`
   - Used in case creation routes (cases/, clients/, voice/voicemail-helpers)
   - Ensures all cases linked to engagement atomically

4. **Route Layer Updates** (6 files)
   - `apps/api/src/routes/cases/index.ts` - POST /cases uses findOrCreateEngagement
   - `apps/api/src/routes/clients/index.ts` - POST /clients creates engagement + case atomically
   - `apps/api/src/services/voice/voicemail-helpers.ts` - Placeholder conversation uses engagement
   - All routes assume engagementId present on TaxCase
   - No fallback to clientId-only queries

5. **Verification Scripts** (NEW)
   - `verify-phase2.ts` - Pre-Phase 3 checks: all cases linked, no orphaned engagements
   - `verify-phase3.ts` - Post-Phase 3 checks: schema constraints satisfied, cascade tested
   - Run via: `pnpm -F @ella/db run verify:phase2` and `verify:phase3`

**Data Flow Change:**

Old (Phase 1-2):
```
TaxCase → (nullable) engagementId → TaxEngagement
       ↘ (fallback) clientId → ClientProfile
```

New (Phase 3):
```
TaxCase → (required) engagementId → TaxEngagement
            (profile snapshot with year-specific data)
```

**Migration Path:** Phase 2 backfill script (`backfill-engagements.ts`) must run before Phase 3 deployment.

## Phase 1 Schema Migration - Multi-Year Support (2026-01-25)

**Location:** `packages/db/prisma/schema.prisma`

**Summary:** Introduced TaxEngagement model for multi-year client support with per-year profile snapshots and engagement lifecycle tracking.

**Key Additions:**

1. **EngagementStatus Enum** - Client engagement state tracking
   - `DRAFT` - Engagement created, intake not complete
   - `ACTIVE` - Intake complete, work in progress
   - `COMPLETE` - All tax cases filed
   - `ARCHIVED` - Past year, read-only

2. **TaxEngagement Model** - Year-specific profile & engagement
   - Unique constraint: `(clientId, taxYear)` - One engagement per year per client
   - Profile fields: Copied from ClientProfile (filingStatus, hasW2, etc.) for year-specific snapshots
   - `intakeAnswers (JSON)` - Year-specific intake responses
   - `status (EngagementStatus)` - Current engagement state
   - Relations: `taxCases (1:many)` - Tax forms for this year
   - Indexes: (clientId), (taxYear), (status), (clientId, status) for efficient filtering

3. **Client Model Update**
   - Added `engagements TaxEngagement[]` relation (1:many)
   - Maintains backward compatibility with existing single-year workflow

4. **TaxCase Model Update**
   - Added `engagementId String?` (nullable FK to TaxEngagement)
   - Backward compatible: existing records null, new records link to engagement
   - New indexes: (engagementId), (engagementId, status), (engagementId, lastActivityAt)
   - Will become required in Phase 3

5. **AuditEntityType Enum**
   - Added `TAX_ENGAGEMENT` for audit trail tracking

**Migration Strategy:**
- **Phase 1 (Current):** Backward compatible, engagementId nullable
- **Phase 2 (Future):** Add endpoint to create new-year engagements
- **Phase 3 (Future):** Make engagementId required, drop single-year association

**Benefits:**
- Multi-year client support with separate profiles
- Year-specific intake answers preserved per engagement
- Engagement lifecycle tracking (DRAFT→ACTIVE→COMPLETE→ARCHIVED)
- Historical data retention for compliance
- Efficient queries via composite indexes

## Phase 2 Data Migration - Backfill Engagements (NEW - 2026-01-25)

**Location:** `packages/db/scripts/backfill-engagements.ts`

**Purpose:** Migrate existing TaxCase data to multi-year engagement model by creating TaxEngagement records and linking cases.

**Script Features:**
- **Input:** All TaxCases without engagementId
- **Grouping:** By (clientId, taxYear) composite key
- **Engagement Creation:** One per unique pair, copies ClientProfile data to TaxEngagement
- **Status Assignment:** Auto-calculated (DRAFT|ACTIVE|COMPLETE based on case states)
- **Atomicity:** Transaction-based updates (prevents partial commits)
- **Verification Suite (4 checks):**
  1. No orphaned TaxCases (null engagementId)
  2. Engagement count matches unique (clientId, taxYear) pairs
  3. No referential integrity violations
  4. No duplicate (clientId, taxYear) in TaxEngagement

**Usage:** `pnpm -F @ella/db run backfill:engagements` (from root)

**Statistics Logged:** Engagements created, cases linked, errors encountered

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

**QuickEditModal** - Mini modal for inline editing (name, phone, email)
- Wrapper pattern ensures fresh state on each open
- Field-specific validation: Name (2-100), Phone (E.164 +1+10 digits), Email (RFC 5322)
- Accessibility: ARIA labels, keyboard shortcuts (Enter/Escape), auto-focus
- API: Uses `api.clients.update()` with React Query cache invalidation
- Styling: Fixed overlay, compact max-width 448px, disabled button states

## Recent Feature: Phase 05 Security Enhancements (NEW - 2026-01-20)

**2 Security Hardening Areas:**

1. **Prototype Pollution Prevention:** DANGEROUS_KEYS blocklist (__proto__, constructor, prototype, etc.) validated in updateProfileSchema
2. **XSS Prevention:** All string values sanitized via `sanitizeTextInput(value, 500)` before merge

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

**Location:** `apps/workspace/src/components/` | `apps/workspace/src/hooks/`

**6 Components + 1 Hook:**
- **IntakeProgress** - Visual progress bar for intake form completion %
- **IntakeRepeater** - Count-based repeater blocks (rental properties, K-1s, W-2s) with XSS sanitization
- **MultiSectionIntakeForm** - Smart auto-expand logic via SECTION_TRIGGERS mapping
- **TieredChecklist** - Context label mappings for multi-entity doc types (rental/K1/W2 badges)
- **SaveIndicator** - Saving/pending/error status with fixed|inline positioning
- **SkipItemModal** - Reason textarea modal for checklist item skip
- **useDebouncedSave Hook** - Debounced save with saveNow immediate action, unmount cleanup

## Recent Feature: Client Floating Chatbox (NEW - 2026-01-21)

**Location:** `apps/workspace/src/components/chatbox/`

**Components (3 new):**

1. **FloatingChatbox** (~145 LOC) - Main Facebook Messenger-style popup
   - **Props:** `caseId`, `clientName`, `clientPhone`, `clientId`, `unreadCount`, `onUnreadChange`
   - **Features:**
     - Fixed position bottom-right with z-50
     - Smooth slide-in animation (bottom-4 fade-in 200ms)
     - 15s polling for new messages when open (balanced performance)
     - Reuses existing `MessageThread` (320px height) + `QuickActionsBar` components
     - Escape key handler for accessibility
   - **State:** `isOpen` toggle, message mutations (send/fetch)
   - **Integration:** Mounted on client detail page (route: `$clientId.tsx`)
   - **Window Size:** 360px width, 500px max height (mobile-responsive)

2. **ChatboxButton** (~40 LOC) - Floating action button
   - **Features:**
     - Circular button (w-14 h-14) with MessageCircle icon
     - Unread badge (red, animated pulse, shows "99+" if >99)
     - Hover scale animation (105%) + focus ring
     - Aria labels in Vietnamese
   - **Props:** `unreadCount`, `isOpen`, `onClick`, `className`

3. **ChatboxHeader** (~90 LOC) - Header with client info
   - **Features:**
     - Gradient background (primary colors)
     - Client avatar (initials, white/20 bg)
     - Client name + phone display (truncated)
     - Action buttons: Call (optional), Minimize, Close
     - All buttons use white icons with hover (white/10 bg)
   - **Props:** `clientName`, `clientPhone`, `onMinimize`, `onClose`, `onCall`

**Integration in Client Detail Page:**
- Wrapped in `ErrorBoundary` for crash protection
- Receives unread count from parent state
- Callback `onUnreadChange` triggers unread count refresh when opened
- Uses shared API (`api.messages.list()`, `api.messages.send()`)
- Toast notifications for errors (Vietnamese UI)

**Key Features:**
- 15-second message polling interval
- React Query integration (invalidates ['messages', caseId] after send)
- Escape key closes chatbox (accessibility)
- Error boundary for robustness
- Vietnamese-first UI text

**Export:** `apps/workspace/src/components/chatbox/index.ts` (barrel export)

## Recent Feature: Phase 01 Unclassified Docs Card (NEW - 2026-01-21)

**Location:** `apps/workspace/src/components/documents/unclassified-docs-card.tsx`

**Component:** `UnclassifiedDocsCard` (~170 LOC)
- **Scope:** Grid display of documents awaiting manual classification (UPLOADED/UNCLASSIFIED status only)
- **Props:** `rawImages: RawImage[]`, `onClassify: (image: RawImage) => void`
- **Layout:** Responsive grid - 4 cols (lg), 3 cols (sm), 2 cols (default)
- **UI Features:**
  - Header with title + count badge (warning color)
  - Empty state: "Không có tài liệu chờ phân loại"
  - Hover overlay: "Phân loại" action label
  - Filename display: 2-line max with tooltip
- **Thumbnail Handling:**
  - Uses `useSignedUrl` hook for lazy loading (55 min cache)
  - Lazy-loaded `LazyPdfThumbnail` component for PDF first page
  - Fallback icons: FileText (PDF), ImageIcon (image) on error
- **Performance:**
  - Memoized `UnclassifiedDocCard` to prevent re-renders during polling
  - Signed URL caching reduces API calls
  - Lazy PDF imports reduce initial bundle
- **Integration:**
  - Exported in `apps/workspace/src/components/documents/index.ts`
  - Used in document workflow tabs alongside UploadsTab, ReviewQueueTab, VerifiedTab

## Recent Feature: Phase 03 Data Entry Tab (NEW - 2026-01-21)

**Location:** `apps/workspace/src/components/documents/data-entry-tab.tsx`

**Main Component:** `DataEntryTab` (~299 LOC)
- **Scope:** Responsive grid layout for verified docs (VERIFIED status) ready for data entry to OltPro
- **Props:** `docs: DigitalDoc[]`, `caseId: string`, `isLoading?: boolean`
- **Layout:** Responsive grid - 4 cols (lg), 3 cols (md), 2 cols (sm)
- **Grouping:** Category-based organization (income/deductions/personal/business/other via `DOC_TYPE_CATEGORIES`)
- **Key Features:**
  - **Category Headers:** Section label + doc count per category
  - **DocCard Display:**
    - Document type label + extracted year (if applicable)
    - Key fields (2-3 most important per doc type)
    - Field values with USD currency formatting for numbers
    - Hover: Copy icon (individual field), Eye icon (view modal)
  - **Copy Functionality:**
    - Individual field copy via `useClipboard` hook
    - "Copy All" button copies all fields in plain-text format
    - Formatted output: `Field Label: value` per line
  - **Detail Modal:** DataEntryModal for full document view + all extracted fields
  - **Empty State:** "Không có tài liệu đã xác minh" when no verified docs
- **Support Components:**
  - **DataEntryTabSkeleton:** Loading state with shimmer animation
  - **DocCard:** Individual card (title, key fields, actions)
  - **ModalErrorFallback:** Error boundary fallback component
- **Key Field Config:** `KEY_FIELDS` record maps doc types to priority fields (e.g., W2 → wages + federalWithholding)
- **Data Utilities:**
  - `groupDocsByCategory()` - Filter docs by category, preserve order
  - `getKeyFieldValues()` - Extract 2-3 priority fields per doc type
  - `formatValue()` - Currency formatting for numbers, type-safe fallback
  - `formatForCopy()` - Generate plain-text output for clipboard (all fields)
  - `escapeHtml()` - XSS prevention for title attributes
  - `isValidExtractedData()` - Type guard for extracted data validation
- **Performance:**
  - `useMemo` on docs grouping prevents recalculation
  - Memoized DocCard components
  - Lazy-loaded DataEntryModal
- **Integration:**
  - Exported in `apps/workspace/src/components/documents/index.ts`
  - Used in DocumentWorkflowTabs (verified tab content)
  - Part of 3-tab document workflow (Uploads | Review | Verified)

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

**Last Updated:** 2026-01-26
**Status:** Phase 5 Frontend Updates + Phase 3 Schema Cleanup + Phase 04 Frontend Incoming Call UI + All enhancements
**Branch:** feature/multi-tax-year (multi-year client support)
**Architecture Version:** 9.3 (Frontend engagement UI + engagement history + returning client detection)

For detailed phase documentation, see [PHASE-04-INDEX.md](./PHASE-04-INDEX.md) or [PHASE-06-INDEX.md](./PHASE-06-INDEX.md).
