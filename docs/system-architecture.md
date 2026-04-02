# System Architecture

Ella employs a layered, monorepo-based architecture prioritizing modularity, type safety, and scalability with multi-tenancy support.

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│         Frontend Layer (React 19)                 │
│   apps/portal & apps/workspace                   │
│   - Clerk auth, org-scoped views, team UI       │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓ HTTP/REST API (Clerk JWT)
┌──────────────────────────────────────────────────┐
│      Backend Layer (Hono 4.6+)                    │
│   apps/api - REST endpoints + webhooks          │
│   Multi-tenant org scoping, Clerk Backend SDK    │
└──────────────────┬───────────────────────────────┘
                   │
         ┌─────────┴──────────┐
         ↓                    ↓
┌─────────────────┐  ┌──────────────────────────┐
│ PostgreSQL      │  │ External Services        │
│ (via Prisma)    │  │ - Clerk org management  │
└────────┬────────┘  │ - Google Gemini AI      │
         │           │ - Twilio Voice/SMS      │
         ↓           │ - Cloudflare R2         │
┌─────────────────────────────────────────────────┐
│     Data Layer (Org-Scoped)                      │
│  - Organizations, Staff, Clients, Cases         │
│  - Client.managedById (single manager FK)       │
│  - Documents, Messages, Audit logs              │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│   Shared Packages                                │
│  @ella/db - Prisma client, migrations           │
│  @ella/shared - Types, validation, utilities    │
│  @ella/ui - shadcn/ui component library         │
└──────────────────────────────────────────────────┘
```

## Frontend Layer

**Technology:** React 19, Vite, TanStack Router 1.94+, React Query 5.64+, Tailwind CSS 4

**Apps:**
- `apps/portal/` - Client magic link upload portal
- `apps/workspace/` - Staff dashboard with team management

**Key Pages (Workspace):**
- `/` - Dashboard with stats & quick actions
- `/clients` - Client list with Kanban/list views
- `/clients/:id` - Client detail with tabs: Overview, Files, Documents, Data Entry, Schedule C, Schedule E, Draft Return (Phase 04), 1099-NEC (Phase 3 - BUSINESS clients only)
- `/cases/:id` - Tax case with checklist & documents
- `/messages` - Unified inbox with split-view conversations
- `/actions` - Action queue with priority filtering
- `/team` - Team member management (Phase 3)
- `/accept-invitation` - Clerk org invite acceptance (Phase 6)

**Key Pages (Portal):**
- `/` - Document upload portal (magic link auth)
- `/schedule-c/:token` - Schedule C expense form (magic link auth)
- `/schedule-e/:token` - Schedule E rental form (magic link auth)
- `/draft/:token` - Draft tax return viewer (magic link, public, Phase 03)

**Authentication (Clerk + Multi-Tenancy):**
- `ClerkAuthProvider` - Wraps root, sets JWT token getter
- `useAutoOrgSelection()` - Auto-selects first org on sign-in
- `useOrgRole()` - Returns `{ isAdmin, role }` for RBAC
- Zero-org fallback: Localized UI (org.noOrg)
- Sidebar: Displays org name, role badge, conditional Team nav

**State Management:**
- React Query: Server state, auto cache invalidation
- Zustand: UI state (sidebar, toast), session persistence
- File-based routing: `src/routes/*` (auto-generated tree)

**API Client:**
- Type-safe endpoint groups (team, clients, cases, messages, etc.)
- Org context: Bearer JWT includes orgId (workspace)
- Portal: Token-based public endpoints (no auth, portal app)
- Retry logic: 3 attempts, exponential backoff
- Pagination: limit=20, max=100
- **Portal API Methods (portalApi):**
  - `getDraft(token)` - Fetch draft return data + signed PDF URL
  - `trackDraftView(token)` - Post-load view tracking (fire & forget)

## Backend Layer

**Technology:** Hono 4.6+, Node.js, @hono/zod-openapi, Prisma

**Structure:**
- Entry: `src/index.ts` (PORT 3002, Gemini validation)
- App: `src/app.ts` (Hono instance, all routes)
- Middleware: Error handler, request logging, rate limiting
- Routes: `src/routes/{team,clients,cases,docs,messages,voice,webhooks,leads,forms}/`
- Services: `src/services/{auth,org,ai,webhook-handlers,sms,magic-link}/`
- Database: `src/lib/db.ts` (Prisma singleton)

**Endpoints (80+ total):**

**Draft Return Sharing (6 - Phase 02 Backend + Phase 04 Frontend Complete):**
- `POST /draft-returns/:caseId/upload` - Upload PDF, create DraftReturn + MagicLink (14-day TTL)
- `GET /draft-returns/:caseId` - Get current draft + link status + version history
- `POST /draft-returns/:id/revoke` - Deactivate link (prevent client access)
- `POST /draft-returns/:id/extend` - Extend expiry by 14 days
- `GET /portal/draft/:token` - Validate token, return draft data + signed PDF URL (public)
- `POST /portal/draft/:token/viewed` - Increment viewCount, update lastViewedAt (public)

**Portal PDF Viewer (Phase 02-05 Complete):**
- Phase 02: Core react-pdf viewer with fit-to-width scaling, DPI rendering, responsive loading
- Phase 03: iFrame wrapper for public portal page with token validation, view tracking, error handling
- Phase 04: Gesture support (swipe navigation, pinch-to-zoom, double-tap)
- Phase 05: Lazy loading in route to split bundle, auto-hide controls on mobile
- Components: `PdfViewer` (navigation), `PdfDocument` (rendering)
- Features: Fit-to-width, DPI-aware crisp display, touch-friendly controls, fallback buttons
- View tracking: Auto-calls trackDraftView on PDF load (fire & forget)
- Bilingual: Auto-syncs language from client preference (EN/VI)
- Error handling: Invalid token, expired link, revoked link, PDF unavailable, browser unsupported

**Workspace Draft Return Tab (Phase 04 - Workspace UI Complete):**
- Component: `DraftReturnTab` - Main tab component in `/clients/:id` page
- States: Loading (spinner), Error (retry button), Empty (upload prompt), Active (draft summary + actions)
- Upload: Drag-drop or file picker, PDF validation (50MB max), upload progress
- Link display: Filename, fileSize, status badge, shareable link with copy button
- Actions: Extend link (14 days), Revoke link (with confirmation), Upload new version
- Version history: Track all drafts, display uploadedBy + timestamp, mark current version
- View tracking: Display viewCount + lastViewedAt
- i18n: 26 keys (EN/VI) for all UI strings

**Schedule E & Rental (10 - Phase 2):**
- `GET /schedule-e/:caseId` - Fetch Schedule E data + magic link status
- `POST /schedule-e/:caseId/send` - Create record, generate link, send SMS
- `POST /schedule-e/:caseId/resend` - Extend TTL, resend SMS
- `PATCH /schedule-e/:caseId/lock` - Lock form (SUBMITTED → LOCKED)
- `PATCH /schedule-e/:caseId/unlock` - Unlock form (LOCKED → SUBMITTED)
- `GET /rental/:token` - Validate token, fetch form data
- `PATCH /rental/:token/draft` - Auto-save draft (debounced)
- `POST /rental/:token/submit` - Submit form, create version entry
- Staff routes authenticated, public routes token-authenticated

**Public Client Intake Form (3 - Phase 02):**
- `GET /form/:orgSlug` - Get intake form metadata (public, no auth). Returns form fields, validation rules, client language preference
- `GET /form/:orgSlug/:staffSlug` - Get form routed to specific staff member (public). Staff-specific form via formSlug, includes manager assignment
- `POST /form/:orgSlug/submit` - Submit completed intake form (public). Creates Client record with source=GENERIC_FORM (no staff) or STAFF_FORM (routed to staff), optional file uploads, returns confirmationUrl. autoSendFormClientUploadLink controls SMS notification after submission.
- Public endpoints unauthenticated; orgSlug + staffSlug route to correct staff member; ClientSource distinguishes generic forms vs staff-routed forms

**Lead Management (9 - Phase 02 API Endpoints + Tag-Based Categorization Complete):**
- `POST /leads` - Create lead from registration form (public, rate-limited 5/min). P2002 duplicate phone+org returns success (idempotent). Accepts `tags` string array for flexible categorization.
- `GET /leads` - List org leads (org-scoped, admin required). Supports pagination (limit 1-100), status filter (NEW|CONTACTED|CONVERTED|LOST), tag filters (hasSome, hasAll operators), full-text search (firstName, lastName, phone, businessName)
- `GET /leads/tags` - Get distinct tags (admin required). Returns array of unique tag strings across all org leads, sorted alphabetically. Used for tag filter dropdowns + tag management UI.
- `GET /leads/:id` - Get lead detail with SMS send history (last 20 SMS logs ordered by sentAt desc). Returns tags array + campaignTag (original source)
- `PATCH /leads/:id` - Update lead (status, notes, firstName, lastName, email, businessName, tags). All text fields + tags sanitized. Tags support add/remove mutations.
- `GET /leads/:id/convert-check` - Check for duplicate client by phone (admin required). Returns hasDuplicate + existingClient data
- `POST /leads/:id/convert` - Convert lead to Client with transaction (create Client + TaxEngagement + TaxCase). Carries over tags to new Client. Optional welcome SMS with magic link. Server enforces phone uniqueness (409 if duplicate)
- `POST /leads/bulk-sms` - Send bulk SMS to leads with form link personalization. Supports tag-based filtering + batched concurrency (default 5 concurrent). SMS templates: `{{firstName}}` and `{{formLink}}` replacement. Tracks SmsSendLog per message. Auto-updates lead status from NEW→CONTACTED on success
- `DELETE /leads/:id` - Delete lead (org-scoped, admin required)
- Rate limiter on public create (5/min), authMiddleware + requireOrgAdmin on all protected endpoints. Phone normalized to E.164 format. Tags: flexible string array (1-100 chars each), stored with GIN index for fast containment queries. SMS integration via Twilio with optional staff form routing

**Team & Organization (19 - Phase 3 + Phase 02 Profile API + Phase 04 Navigation + Phase 02 Intake Form):**
- `GET /org-settings` - Get org profile + autoSendFormClientUploadLink toggle (Phase 02 Intake Form)
- `PATCH /org-settings` - Update org profile + autoSendFormClientUploadLink (Phase 02 Intake Form)
- `GET /team/members` - List org staff (reads from DB)
- `POST /team/invite` - Send Clerk org invitation via Backend API (webhook syncs results to DB)
- `PATCH /team/members/:staffId/role` - Update role via Clerk Backend API (webhook syncs to DB)
- `DELETE /team/members/:staffId` - Deactivate staff via Clerk Backend API (webhook syncs to DB)
- `GET /team/members/:staffId/profile` - Get member profile with assigned clients (Phase 02)
- `PATCH /team/members/:staffId/profile` - Update name/phone (self only, Phase 02)
- `POST /team/members/:staffId/avatar/presigned-url` - Get R2 upload URL (self only, Phase 02)
- `PATCH /team/members/:staffId/avatar` - Confirm avatar upload (self only, Phase 02)
- `GET /staff/me` - Get current staff details with avatarUrl + formSlug field (Phase 04 navigation + Phase 02 Intake Form)
- `PATCH /staff/me/form-slug` - Update personal form slug (self only, Phase 02 Intake Form)
- `GET /client-assignments` - List staff-client mappings
- `POST /client-assignments` - Create assignment (app-level, not Clerk-synced)
- `POST /client-assignments/bulk` - Bulk assign (app-level, not Clerk-synced)
- `PUT /client-assignments/transfer` - Transfer client (app-level, not Clerk-synced)
- Similar for invitations & staff assignments

**Clients (14+ with Tag Support):**
- `GET /clients` - List with org scoping + sort + tag filters (Phase 2: supports `sort=recentUploads`, returns `uploads: { newCount, totalCount, latestAt }` per client. Tag filtering: hasSome, hasAll operators). Returns tags + source enum.
- `GET /clients/tags` - Get distinct tags (admin required). Returns array of unique tag strings across all org clients, sorted alphabetically. Used for tag filter dropdowns.
- `POST /clients` - Create with organization. Accepts tags array + source enum (MANUAL, FORM, GENERIC_FORM, STAFF_FORM, CONVERTED)
- `GET /clients/:id` - Detail with org verification. Returns tags array + source enum + conversion metadata (convertedLeads)
- `PATCH /clients/:id` - Update profile/intakeAnswers/tags. Tags support add/remove/replace mutations
- `DELETE /clients/:id` - Deactivate
- `GET /clients/:id/resend-sms` - Resend welcome link
- `POST /clients/:id/avatar/presigned-url` - Get R2 upload URL for client avatar (Phase 02 Backend)
- `PATCH /clients/:id/avatar` - Confirm avatar upload + return signed download URL (Phase 02 Backend)
- `DELETE /clients/:id/avatar` - Remove client avatar (Phase 02 Backend)
- `PATCH /clients/:id/notes` - Update client notes/internal comments (Phase 02 Backend)
- `GET /clients/:id/activity` - Get recent activity timeline (uploads, messages, case updates, Phase 02 Backend)
- `GET /clients/:id/stats` - Get quick stats (totalFiles, taxYears, verifiedPercent, lastMessageAt, Phase 02 Backend)
- Status endpoints for action tracking. Client.source expanded to 5 values (vs 2 previously): MANUAL, FORM, GENERIC_FORM, STAFF_FORM, CONVERTED tracks full origin path

**Cases & Engagements (14+):**
- `GET /engagements` - List org engagements
- `POST /engagements` - Create (with copy-from for year reuse)
- `GET /engagements/:id` - Engagement detail
- `PATCH /engagements/:id` - Update profile
- `GET /cases/:id` - Case detail with checklist
- `GET /cases/:id/images` - Case images with `isNew` boolean per image (Phase 2)
- `PATCH /cases/:id` - Update case status
- Actions for compliance tracking

**Documents & Classification (13+):**
- `POST /documents/upload` - Upload images
- `POST /documents/classify` - Trigger AI classification
- `GET /documents/:id` - Document detail
- `PATCH /documents/:id/verify` - Mark verified with extracted fields
- `GET /documents/:id/ocr` - Request OCR extraction
- `POST /images/:id/mark-viewed` - Create DocumentView record for document view tracking (Phase 2)
- Endpoints for document lifecycle

**1099-NEC Tax Form Integration (5 - Phase 3 Tax1099 API Integration Complete):**
- `GET /clients/:clientId/1099-nec/status` - Get form status counts (DRAFT, VALIDATED, IMPORTED, PDF_READY, SUBMITTED, ACCEPTED, REJECTED). Business clients only. Org-scoped.
- `POST /clients/:clientId/1099-nec/validate` - Validate all DRAFT forms via Tax1099 API. Requires BUSINESS client + org admin. Transitions forms from DRAFT→VALIDATED or DRAFT→error status.
- `POST /clients/:clientId/1099-nec/import` - Import form from Tax1099 into DB. Requires org admin. Decrypts contractor SSN, validates data, transitions to IMPORTED.
- `POST /clients/:clientId/1099-nec/fetch-pdfs` - Fetch PDFs for IMPORTED forms from Tax1099 API. Stores on R2, transitions forms to PDF_READY. Org admin only.
- `GET /clients/:clientId/1099-nec/:formId/pdf` - Download signed PDF URL for form. 24-hour TTL. Read-only endpoint.
- Models: Form1099NEC (with status enum, validation errors, eFile tracking), FilingBatch (groups multiple forms by tax year). Tax1099 API integration via singleton client with configuration.

**Messages & Voice (15):**
- `GET /messages` - List conversations (org-scoped)
- `POST /messages` - Send SMS/portal/system message
- `GET /conversations/:id/messages` - Thread detail
- `POST /voice/token` - Generate Twilio token (VoiceGrant)
- `POST /voice/presence/register` - Register staff online
- `GET /voice/caller/:phone` - Lookup incoming caller
- Recording endpoints with auth

**Webhooks:**
- `POST /webhooks/clerk` - Clerk event sync (user/org/membership lifecycle). Signed with Svix. Handlers: user.updated (sync email/name/avatar), user.deleted (deactivate staff), organization.created/updated (upsert org), organizationMembership.created/updated/deleted (sync staff member, handle out-of-order events). Uses upserts for idempotency. Returns 500 on handler error for Clerk retry.
- `POST /webhooks/incoming-call` - Twilio incoming call routing
- `POST /webhooks/voicemail-recording` - Voicemail callback
- `POST /webhooks/sms-received` - Incoming SMS

## Multi-Tenancy Architecture

**Organization Model:**
```
Organization (root entity)
├── clerkOrgId (unique, synced from Clerk)
├── name, slug, logoUrl, isActive
└── Relations:
    ├── Staff[] (organization members)
    ├── Client[] (org clients, each with managedById FK)
    └── Audit[] (all changes)
```

**Data Scoping:**
- `buildClientScopeFilter(user)` - Core scoping function
- **Admin:** See all org clients
- **Staff:** See only managed clients (Client.managedById = staffId)
- Applied to: Clients, Cases, Engagements, Messages, Documents, Images, Actions

**Permission Model:**
- **ADMIN:** Manage org, team, client assignments
- **STAFF:** View assigned clients only, no admin functions
- **CPA:** Future role for CPA firm integrations

**Middleware:**
- `requireOrg` - Verify orgId in JWT, all protected endpoints
- `requireOrgAdmin` - Verify org:admin role from Clerk, team endpoints only

**Audit Logging:**
- AuditLog tracks: entity type, id, field, old/new values, changedBy, timestamp
- All org-scoped changes logged for compliance

## Database Schema

**Key Models (Multi-Tenant):**
- **Organization** - Org root with Clerk integration, autoSendFormClientUploadLink (bool, Phase 02 Intake Form - auto-send SMS to staff on form submission)
- **Staff** - organizationId FK, clerkId (unique), role (ADMIN|STAFF|CPA), notifyOnUpload (default: true), notifyAllClients (default: false), formSlug (optional unique slug for public form routing, Phase 02 Intake Form). Notification preferences for client upload alerts.
- **Client** - organizationId FK, managedById FK (Staff, single manager), profile data, intakeAnswers Json, avatarUrl (optional signed R2 URL), notes (HTML up to 50KB), notesUpdatedAt, source (enum: DIRECT|INTAKE_FORM, Phase 02 Intake Form - tracks client origin), clientType (INDIVIDUAL|BUSINESS), businessName, einEncrypted, businessAddress, businessPhone. Phase 02 1099-NEC: tracks business entity type + details for contractor management
- **TaxCase** - Year-specific tax case, engagementId FK
- **TaxEngagement** - Year-specific engagement (copy-from support)
- **ScheduleCExpense** - 20+ fields, version history
- **ScheduleEExpense** - 1:1 with TaxCase. Status (DRAFT/SUBMITTED/LOCKED), up to 3 rental properties (JSON array), 7 IRS expense fields (insurance, mortgage interest, repairs, taxes, utilities, management fees, cleaning/maintenance), custom expense list, version history, property-level totals
- **Contractor** - clientId FK (BUSINESS clients only), ssn4Encrypted (last 4 SSN digits, encrypted), name, address, phone, einEncrypted (optional, encrypted), businessType (INDIVIDUAL|SOLE_PROP|PARTNERSHIP|S_CORP|C_CORP), amount1099 (gross payments). Phase 02 1099-NEC: contractor tracking for Schedule NEC reporting
- **RawImage** - Classification states, AI confidence, perceptual hash, re-upload tracking, relationships to documentViews, documentGroupId FK (Phase 2/3 multi-page grouping), pageNumber (Phase 3 page order detection), aiMetadata JSON (Phase 1 metadata extraction: taxpayerName, ssn4, pageMarker with currentPage/totalPages, continuationMarker)
- **DocumentView** - Staff document view tracking (staffId + rawImageId unique composite). Tracks which staff members viewed which RawImage documents with timestamp (viewedAt). Enables per-CPA "new upload" badge calculations and document engagement metrics.
- **DocumentGroup** - Phase 2/3 multi-page document grouping: baseName (base filename), documentType (identified type), pageCount (pages in group), confidence (AI confidence), images relation (array of RawImages). Indexes: caseId, caseId+createdAt. Phase 3 Enhancement: sortDocumentsByPageMarker() orders docs by extracted pageMarker.currentPage with fallback to upload order. validatePageSequence() checks for gaps and duplicates in page ordering.
- **DigitalDoc** - OCR extracted fields
- **DraftReturn** - taxCaseId FK (Cascade delete), r2Key (unique storage), filename, fileSize, version tracking (auto-increment per case), uploadedById FK to Staff (Restrict delete), status (ACTIVE|REVOKED|EXPIRED|SUPERSEDED), viewCount, lastViewedAt, magicLinks array relation (1-to-many draft-to-links). Indexes: taxCaseId (single), taxCaseId+status (compound), unique(taxCaseId, version)
- **MagicLink** - type (PORTAL|SCHEDULE_C|SCHEDULE_E|DRAFT_RETURN), token (unique, 12-char base36), caseId/type reference, optional draftReturnId FK (SetNull, for DRAFT_RETURN type), isActive, expiresAt (14-day TTL for DRAFT_RETURN, null for others), usageCount, lastUsedAt. Indexes: token (unique), caseId+type (compound), draftReturnId
- **Message** - SMS/PORTAL/SYSTEM/CALL channels
- **AuditLog** - Complete change trail
- **Lead** - Marketing lead capture. Fields: id (cuid), firstName, lastName, phone (unique per org + organizationId), email, businessName, status (NEW|CONTACTED|CONVERTED|LOST), campaignTag (renamed from source; eventSlug or null), tags (String[] for categorization, auto-populated from campaignTag on creation), notes (5KB max), organizationId FK, convertedToId FK (Client, null if not converted), createdAt/updatedAt. Indexes: organizationId+status, organizationId+phone, tags (GIN). Phase 02 Marketing API Complete. Phase 01 Tag-Based Categorization Added.
- **SmsSendLog** - Audit trail for SMS to leads. Fields: id (cuid), message, status (SENT|FAILED), twilioSid (optional), error (optional), sentAt timestamp, createdAt/updatedAt. Relations: leadId FK, sentById FK (Staff), organizationId FK. Used by bulk-sms endpoint to track per-message delivery. Phase 02 Marketing API Complete.

**Phase 02 Types (Document Upload Notification & Intake Form):**
- **ClientUploads** - Type: `{ newCount: number, totalCount: number, latestAt?: Date }`. Per-client upload tracking based on DocumentView records. `newCount` = images without DocumentView record (unviewed). `totalCount` = all images in client's cases. `latestAt` = most recent image createdAt. Included in GET /clients response via aggregation query.
- **ClientSource** - Enum: `MANUAL | FORM | GENERIC_FORM | STAFF_FORM | CONVERTED`. Tracks client origin: MANUAL = created via staff portal, FORM = deprecated (phase 02), GENERIC_FORM = created via public intake form, STAFF_FORM = created by staff via form link, CONVERTED = converted from Lead. Phase 01 Tag-Based Categorization extended enum.
- **Client Tags** - Phase 01 addition. String[] field for flexible categorization beyond source. Indexed via GIN for fast filtering.

**Indexes:**
- Organization: clerkOrgId (unique), name
- Staff: organizationId + clerkId (compound unique)
- Client: organizationId + status, managedById (FK index)
- DraftReturn: taxCaseId (single), taxCaseId + status (compound), status (single) - optimize case-to-drafts + status filtering
- Messages: conversationId + createdAt (ordering)

## Authentication Flow

**Request-Time (Read-Only) Pattern:**
1. Frontend logs in via Clerk UI
2. Receives JWT with: userId, orgId, orgRole (org:admin|org:member)
3. Frontend sets JWT in Authorization header (Bearer token)
4. Backend middleware extracts claims (read-only: no DB writes)
5. Middleware looks up Staff by clerkId from DB (verify staff exists)
6. No sync occurs at request time — auth is stateless DB lookup

**Event-Time (Async) Pattern:**
- Clerk events trigger webhook on state changes (user/org/membership)
- Webhook handler syncs to DB asynchronously (decoupled from requests)
- DB becomes eventual-consistent with Clerk state

**Org Verification:**
- All endpoints verify orgId from JWT matches resource org
- Staff see only managed clients (Client.managedById = staffId)
- Admins see all org clients

## Clerk Webhook Sync (Event-Driven User/Org Sync)

**Overview:**
Webhooks from Clerk sync user, organization, and membership changes to DB in real-time. Single source of truth: Clerk state flows to DB via webhooks + JWT token parsing. Handlers use Prisma upserts for idempotency (safe on event retries).

**Event Handlers:**
- **user.updated** - Sync email, name, avatar to Staff (updateMany by clerkId)
- **user.deleted** - Deactivate staff (isActive=false, set deactivatedAt)
- **organization.created/updated** - Upsert Organization (handles out-of-order events)
- **organizationMembership.created** - Link user to org: (1) ensure org exists (upsert), (2) check if staff exists by email (pre-existing), (3) upsert/update staff with clerkId, role (ADMIN|STAFF), org assignment
- **organizationMembership.updated** - Update staff role (maps org:admin → ADMIN, org:member → STAFF)
- **organizationMembership.deleted** - Deactivate staff for that org (scope by organizationId + clerkId)

**Route Handler (POST /webhooks/clerk):**
- Svix signature verification (svix-id, svix-timestamp, svix-signature headers)
- Awaits handler so Clerk retries on failure (500 = retry, 400 = permanent failure)
- Svix verification error → 400, handler error → 500

**Error Handling & Idempotency:**
- Each handler validates required fields before DB operations
- Missing fields → log warning, return gracefully (no error thrown)
- Upsert pattern prevents duplicates on re-delivery
- Out-of-order events: membership.updated may arrive before .created; org.updated upserts to handle created arriving late

**Key Insights:**
- Membership created handler checks if staff exists by email (legacy pre-Clerk staff may have email but no clerkId yet)
- Deactivation uses isActive flag + deactivatedAt timestamp (soft delete pattern)
- Organization slug optional (null allowed)
- Field mapping: Clerk identifier field (email) → Staff.email

## Phase 02: Portal PDF Viewer - Core React PDF Rendering

**Overview:**
Mobile-first PDF viewer using react-pdf library with fit-to-width scaling, DPI-aware rendering, and responsive skeleton loading. Lazy-loaded to avoid bundling react-pdf (~150KB) for users who don't view PDFs.

**Components:**
```
apps/portal/src/components/pdf-viewer/
  ├── index.tsx
  │   ├── Page navigation state (currentPage, numPages)
  │   ├── Load handlers (success/error callbacks)
  │   ├── Gesture handler integration (swipe, pinch, double-tap)
  │   ├── Auto-hide controls UI (visible toggle)
  │   └── Navigation + controls bar with auto-hide
  │
  ├── pdf-document.tsx
  │   ├── ResizeObserver for container width tracking
  │   ├── Fit-to-width calculation
  │   ├── DPI-aware rendering (devicePixelRatio)
  │   ├── Loading state with pulse skeleton
  │   └── Error state with fallback buttons
  │
  ├── pdf-controls.tsx
  │   ├── Navigation buttons (← →)
  │   ├── Page indicator (current/total)
  │   ├── Mobile-optimized touch targets (44px min)
  │   └── Fade in/out animation
  │
  ├── use-pdf-gestures.ts
  │   ├── Swipe detection (left/right for page nav)
  │   ├── Pinch-to-zoom (scale factor)
  │   ├── Double-tap to fit-width reset
  │   └── Touch event listeners + cleanup
  │
  └── use-auto-hide.ts
      ├── Auto-hide timer (3s default after interaction)
      ├── show() callback to reset and display
      ├── Cleanup on unmount
      └── Configurable delay + initial visibility
```

**Key Features:**

1. **Fit-to-Width Scaling**
   - Calculates natural PDF width from rendered canvas
   - Scale formula: `containerWidth / naturalWidth`
   - ResizeObserver tracks responsive width changes
   - Prevents recalculation race conditions (hasCalculatedFit ref)

2. **DPI-Aware Rendering**
   - Multiplier: `window.devicePixelRatio` (1.0 on standard, 2.0+ on retina)
   - Effective scale: `fitScale × dpiMultiplier`
   - Crisp rendering on high-DPI displays

3. **Loading State**
   - 8.5:11 aspect ratio placeholder (max-w-[400px])
   - Pulse animation during fit calculation
   - Prevents layout shift (min-h-0 on scrollable container)

4. **Error Handling**
   - Browser unsupported fallback (AlertTriangle icon)
   - Open in New Tab button (external link icon)
   - Download PDF button (file-down icon)
   - Bilingual error messages (EN/VI via i18n)

**Props (PdfViewer):**
```typescript
interface PdfViewerProps {
  url: string         // PDF URL from signed R2 link
  filename: string    // Original filename for download
}
```

**Data Flow:**
1. Page route passes url + filename to PdfViewer
2. PdfDocument loads Document from react-pdf
3. ResizeObserver measures container width
4. Page renders at scale 1, canvas renders
5. onRenderSuccess handler calculates fit scale
6. Page re-renders at `fitScale × dpi` for crisp display
7. Page navigation controls currentPage state
8. PdfViewer renders selected page at calculated scale

**Bundle Impact:**
- react-pdf (~150KB gzipped) lazy-loaded via dynamic import in route
- Index.tsx + pdf-document.tsx: minimal (~3KB together)
- Saves ~150KB bundle for non-PDF users
- Worker (pdf.js) fetched from unpkg CDN (matches workspace pattern)

**Localization Keys:**
```
draft.loadingPdf     → "Loading PDF..."
draft.viewerUnsupported  → "PDF Viewer Unavailable"
draft.viewerFallback → "Your browser cannot display PDFs directly..."
draft.openInNewTab   → "Open in New Tab"
draft.download       → "Download PDF"
```

**Browser Compatibility:**
- Modern browsers: Full react-pdf support with fit-to-width
- Mobile: Touch-friendly navigation, zoom support
- Fallback: Download/open buttons if library fails
- Workers: PDF.js from unpkg CDN (no build step needed)

**Future Enhancements:**
- Fullscreen mode toggle
- Keyboard shortcuts (+ - 0 for zoom/reset, arrow keys for navigation)
- PDF annotation/markup (draw on PDF in workspace)
- Side-by-side document viewer for comparison

## Phase 03: Portal PDF Viewer - Token-Based Draft Return Viewing

**Overview:**
Public-facing draft tax return viewer accessible via magic link tokens. No authentication required. Supports bilingual UI (EN/VI), view tracking, and error states for invalid/expired/revoked links.

**Route & Components:**
```
apps/portal/src/routes/draft/$token/index.tsx
  ├── Page load → GET /portal/draft/:token
  ├── Validate token (type, active, expiry)
  ├── Return draft data + signed PDF URL
  ├── Auto-sync client language preference
  ├── Track view on PDF load
  └── Lazy load PdfViewer via dynamic import (Phase 05)

apps/portal/src/components/pdf-viewer/ (modular structure)
  ├── index.tsx - Main viewer with gesture + auto-hide integration
  ├── pdf-document.tsx - Core react-pdf rendering
  ├── pdf-controls.tsx - Mobile-optimized touch controls
  ├── use-pdf-gestures.ts - Swipe/pinch/double-tap detection
  └── use-auto-hide.ts - Auto-hide controls on inactivity
```

**Data Flow:**
1. Client receives magic link email: `/draft/abc123token`
2. Client clicks link (no login required)
3. Frontend fetches `GET /portal/draft/abc123token`
4. Backend validates: token exists, type=DRAFT_RETURN, isActive=true, !expired, updates usageCount
5. Backend returns: clientName, taxYear, version, pdfUrl (signed R2 URL, 15min TTL)
6. Frontend syncs language from clientLanguage field
7. PdfViewer renders iFrame with pdfUrl
8. On successful load, frontend calls `POST /portal/draft/abc123token/viewed` (fire & forget)
9. Backend increments viewCount, updates lastViewedAt

**Error States:**
- `INVALID_TOKEN` - Token not found in database
- `LINK_REVOKED` - Staff revoked the draft access
- `LINK_EXPIRED` - Token expiresAt date passed
- `PDF_UNAVAILABLE` - R2 signed URL generation failed
- Browser unsupported - iFrame load error, fallback to download/open buttons

**API Endpoints:**
- `GET /portal/draft/:token` - Public, no auth, returns DraftReturnData
- `POST /portal/draft/:token/viewed` - Public, fire & forget, updates view tracking

**Portal API Client (apps/portal/src/lib/api-client.ts):**
```typescript
export interface DraftReturnData {
  clientName: string           // Display name
  clientLanguage: 'EN' | 'VI'  // Auto-sync language
  taxYear: number              // Tax year
  version: number              // Draft version
  filename: string             // Original filename
  uploadedAt: string           // ISO8601
  pdfUrl: string              // Signed R2 URL (15min expiry)
}

portalApi.getDraft(token: string) → Promise<DraftReturnData>
portalApi.trackDraftView(token: string) → Promise<void>
```

**Localization Keys:**
```
draft.title              → "Draft Tax Return for Review"
draft.loading            → "Loading your draft tax return..."
draft.taxYear            → "Tax Year"
draft.version            → "Version"
draft.contactCpa         → "Please contact your CPA if you have any questions."
draft.errorTitle         → "Unable to Load"
draft.errorLoading       → "Could not load the draft tax return. Please try again."
draft.errorInvalidLink   → "This link is not valid. Please contact your CPA for a new link."
draft.errorRevoked       → "This link has been revoked. Please contact your CPA."
draft.errorExpired       → "This link has expired. Please contact your CPA for a new link."
draft.linkInvalid        → "Link Invalid"
draft.viewerUnsupported  → "PDF Viewer Unavailable"
draft.viewerFallback     → "Your browser cannot display PDFs directly. Please use the buttons below."
draft.openInNewTab       → "Open in New Tab"
draft.download           → "Download PDF"
```

**Security:**
- Token validation: Checks type=DRAFT_RETURN, isActive=true, expiresAt > now
- Signed URL expiry: 15 minutes (prevents URL sharing beyond session)
- No sensitive data exposure: Error messages don't reveal internal details
- Magic link type safety: Only DRAFT_RETURN type can access this endpoint
- Cross-origin: iFrame sandbox="allow-same-origin allow-scripts" prevents XSS

**View Tracking:**
- Called on successful PDF load (fire & forget pattern)
- Updates `DraftReturn.viewCount` and `lastViewedAt`
- Staff can monitor engagement in workspace dashboard
- No sensitive data logged (token only)

**Browser Compatibility:**
- Modern browsers: iFrame native PDF viewer
- Fallback browsers (some mobile): Download PDF or open in new tab
- onError handler detects iFrame load failure

**Performance:**
- Single GET request to validate token + fetch metadata
- R2 signed URL good for 15 minutes (client-side PDF load)
- View tracking is async (doesn't block UI)
- No polling or refetching after load

**Accessibility:**
- ARIA roles: role="status" for loading, role="alert" for errors
- aria-label for loading state and error messages
- Keyboard navigation: Tab through action buttons in error state
- Retry button available for non-permanent errors

## Phase 04-05: Portal PDF Viewer - Gestures & Lazy Loading Integration

**Overview (Phase 04):**
Mobile gesture support for PDF viewer: swipe-to-navigate pages, pinch-to-zoom, and double-tap to reset zoom. Auto-hide controls bar after 3 seconds of inactivity with mobile-optimized touch targets (44px minimum).

**Overview (Phase 05):**
Lazy load PdfViewer component in route via dynamic import to split bundle (~155KB chunk). Removed old iframe-based pdf-viewer.tsx in favor of gesture-enabled modular components. Integrated auto-hide controls with Suspense fallback for smooth UX.

**Route Integration (`apps/portal/src/routes/draft/$token/index.tsx`):**
```typescript
// Lazy load PDF viewer to split bundle (~155KB)
const PdfViewer = lazy(() => import('../../../components/pdf-viewer'))

// In JSX: Wrap with Suspense for smooth loading
<Suspense fallback={<PdfLoadingSkeleton />}>
  <PdfViewer url={data.pdfUrl} filename={data.filename} />
</Suspense>
```

**Bundle Impact:**
- react-pdf (~155KB gzipped) lazy-loaded on-demand
- Dynamic import splits into separate chunk
- Non-PDF users: Zero impact on initial bundle
- PdfLoadingSkeleton: Lightweight fallback UI during chunk load

**Gesture Hook (`use-pdf-gestures.ts`):**
```typescript
const { scale, onTouchStart, onTouchMove, onTouchEnd, resetZoom } = usePdfGestures()

// Touch listeners track:
- Single-finger swipe: Left/right triggers page navigation
- Two-finger pinch: Scale multiplier (1.0 to 3.0)
- Double-tap: Reset scale to 1.0 (fit-width)
- Momentum-aware: Only trigger nav on sufficient swipe distance
```

**Auto-Hide Hook (`use-auto-hide.ts`):**
```typescript
const { visible, show } = useAutoHide({ delay: 3000, initialVisible: true })

// Triggers on:
- User interaction (touch, mouse move)
- Page navigation (next/prev buttons)
- Zoom changes (pinch)
// Hides after 3s inactivity
```

**Controls Component (`pdf-controls.tsx`):**
```
Mobile-optimized UI:
- Button size: 44px (touch target minimum)
- Fade animation: Opacity transition 200ms
- Position: Bottom bar with safe-area-inset-bottom
- Buttons: Previous, Page Indicator, Next
- Responsive: Adapts to viewport width
```

**Mobile-First Design:**
- Touch-friendly spacing (gap-2 between buttons)
- Full-width viewport usage (h-dvh = dynamic viewport height)
- Auto-hide improves immersion (controls fade after interaction)
- Swipe-to-navigate intuitive for mobile users
- Pinch-to-zoom native gesture (matches user expectations)

**Data Flow (Phase 05):**
1. Route fetches draft data via portalApi.getDraft()
2. On success, renders PdfViewer with Suspense fallback
3. Browser downloads react-pdf chunk (~155KB) via dynamic import
4. PdfViewer mounts: initializes gesture hooks + auto-hide
5. User touches PDF: show() resets auto-hide timer, controls visible
6. User swipes left: gesture handler calls goToNextPage()
7. User pinches: scale updates, gesture handler manages zoom
8. 3 seconds of inactivity: controls fade out automatically
9. User taps again: show() restores controls visibility

**Cleanup & Migration:**
- Deleted: Old `apps/portal/src/components/pdf-viewer.tsx` (iframe-based)
- Reason: Replaced by modular gesture-aware components
- Migration: Route now uses lazy-loaded PdfViewer directory

**Browser Support:**
- Touch events: Modern mobile browsers (iOS Safari 13+, Chrome Android)
- Pinch detection: Native touch events (no library needed)
- Swipe detection: Distance + velocity calculation
- Fallback: Native PDF controls still available if gestures fail

---

## Phase 05: Client Overview Tab - Integration & Cleanup (COMPLETE)

**Overview:**
Integration of Client Overview Tab as default tab on client detail page. Avatar upload with client-side Canvas compression, rich text notes with Tiptap editor, quick stats cards, activity timeline, and assigned staff badges.

**Phase 05 Completion:**
- `apps/workspace/src/routes/clients/$clientId.tsx` - Default tab set to `overview` (line 75)
- `apps/workspace/src/components/clients/index.ts` - Removed old ClientOverviewSections export (line 16, comment added)
- Old components fully replaced by ClientOverviewTab modular structure

**ClientOverviewTab Features:**
- **Avatar Section:** Client avatar display with hover state, fallback initials badge
- **Profile Card:** Client name, phone, email with quick-edit icons
- **Quick Stats:** totalFiles, taxYears (pills), verifiedPercent (progress), lastMessageAt
- **Activity Timeline:** Recent uploads, messages, case updates (10 items max, chronological)
- **Assigned Staff:** Staff badges with avatar/name, hover card for details
- **Rich Notes Editor:** Tiptap integration with HTML sanitization, auto-save (30s debounce)

**Image Compression Utility (`image-utils.ts`):**
```typescript
compressImage(file): Promise<{ blob, dataUrl, width, height }>
- Resizes to 400x400px max (maintains aspect ratio)
- Targets 200KB with adaptive quality reduction
- Quality loop: 0.85 → 0.5 in 0.1 increments (max 10 iterations)
- Returns compressed JPEG blob + preview dataUrl
- Memory management: revokes ObjectURL on load/error

isValidImageFile(file): boolean
- Accepts: image/jpeg, image/png, image/webp, image/gif
- Prevents unsupported formats pre-compression

formatFileSize(bytes): string
- Display helper: "123 KB", "1.5 MB"
```

**AvatarUploader Component (`client-avatar-uploader.tsx`):**
```typescript
Props:
- clientId: string
- currentAvatarUrl: string | null (existing avatar)
- clientName: string (for initials fallback)

States: idle | compressing | uploading | confirming | success | error

Upload Flow:
1. User clicks avatar
2. File input → validation (type + size ≤10MB)
3. Compress via Canvas (progress: "Compressing...")
4. GET presigned URL from backend
5. Fetch PUT to R2 with compressed blob (progress: "Uploading...")
6. PATCH /confirm with R2 key (progress: "Saving...")
7. Success → toast + cache invalidation

Accessibility:
- Enter/Space triggers upload (keyboard)
- aria-label: "Change client avatar" (EN/VI)
- Focus ring: focus:ring-2 focus:ring-primary

Visual Feedback:
- Idle: Camera icon on hover
- Uploading: Spinner overlay
- Success: Green check overlay (1.5s fade)
- Error: AlertCircle icon + error message + dismiss button
```

**API Integration:**
```typescript
POST /clients/:id/avatar/presigned-url
  Request: { contentType: 'image/jpeg', fileSize: number }
  Response: { uploadUrl, expiresIn, r2Key }
  Notes: Expires 15min, R2 PUT requires Content-Type header

PATCH /clients/:id/avatar
  Request: { r2Key: string }
  Response: { id, avatarUrl, updatedAt } (signed download URL, 7-day TTL)
  Notes: Validates avatars/ prefix, creates signed URL immediately

DELETE /clients/:id/avatar
  Response: { id, avatarUrl: null, updatedAt }

PATCH /clients/:id/notes
  Request: { notes: string } (HTML, max 50KB)
  Response: { id, notes, notesUpdatedAt, updatedAt }

GET /clients/:id/activity
  Response: ActivityItem[] (10 items max, desc by timestamp)
  Types: upload | message | case_updated

GET /clients/:id/stats
  Response: { totalFiles, taxYears[], verifiedPercent, lastMessageAt }
```

**Cache Invalidation:**
```typescript
confirmMutation.onSuccess:
  - queryClient.invalidateQueries(['client', clientId])
  - Success toast + preview reset (1.5s delay)
```

**Localization Keys:**
```
profile.clientAvatar - Section heading
profile.changeClientAvatar - Button aria-label
profile.compressing - Upload state text
profile.uploading - Upload state text
profile.saving - Confirmation state text
profile.avatarUpdated - Success toast
profile.avatarUploadFailed - Error toast
profile.invalidImageType - Validation error
profile.imageTooLarge - Validation error
overview.quickStats - Stats card heading
overview.totalFiles - File count label
overview.taxYears - Tax years label
overview.verified - Verification % label
overview.lastMessage - Last message label
overview.activity - Activity timeline heading
overview.assignedStaff - Staff badges heading
overview.notes - Rich notes editor label
overview.notesPlaceholder - Editor placeholder text
```

**Security:**
- Org-level access control: buildClientScopeFilter applied to all endpoints
- Presigned URLs expire: 15min (upload), 7 days (download)
- R2 key validation: client-avatars/{clientId}/{timestamp}-{random}.jpg (directory traversal safe)
- File size limits: 10MB pre-compression, 200KB post-compression target
- HTML sanitization: Notes stored as HTML, frontend auto-escapes React rendering (no XSS)
- HTTPS only: Presigned URLs include X-Amz-* signatures

---

## Phase 04: Navigation Integration - Staff Profile Routes

**Overview:**
User profile navigation system enabling staff to access member profiles from two entry points: sidebar user section and team member table rows.

**Route Structure:**
```
/team/profile/$staffId
├── $staffId = 'me'      → Current user profile
└── $staffId = '{uuid}'  → Specific team member profile
```

**Navigation Patterns:**

1. **Sidebar User Section** (desktop + mobile):
   - Component: `SidebarContent` (apps/workspace/src/components/layout/sidebar-content.tsx)
   - Link: `to="/team/profile/$staffId" params={{ staffId: 'me' }}`
   - Trigger: Click user section (name, avatar, org)
   - Avatar source: `useOrgRole()` → `api.staff.me()` → `avatarUrl` field
   - Avatar fallback: Initials badge if no avatarUrl
   - Hover feedback: `hover:bg-muted/50 cursor-pointer`
   - Responsive: Collapsed sidebar shows avatar only

2. **Team Member Table Rows** (team management page):
   - Component: `TeamMemberTable` (apps/workspace/src/components/team/team-member-table.tsx)
   - Link: `to="/team/profile/$staffId" params={{ staffId: member.id }}`
   - Trigger: Click row (excluding buttons, menus, expand toggle)
   - Interactive element detection:
     ```typescript
     if (target.closest('button') ||
         target.closest('[role="menu"]') ||
         target.closest('[aria-expanded]')) {
       return  // Don't navigate
     }
     ```
   - Hover feedback: Right arrow icon on member name
   - Row styling: `hover:bg-muted/50 transition-colors cursor-pointer`

**Data Flow:**
```
Frontend Hook (useOrgRole)
  ↓
  queryKey: ['staff-me']
  ↓
  Backend: GET /staff/me
    ↓
    Returns: { id, name, email, role, language, orgRole, avatarUrl }
    ↓
    avatarUrl: Signed download URL from R2 or null
  ↓
  Hook returns: { orgRole, isAdmin, isLoading, staffId, avatarUrl }
  ↓
  Sidebar renders: avatar (img or initials) + name + org
```

**Type Contracts:**

1. **Staff.me Response Type** (api-client.ts:773):
   ```typescript
   {
     id: string                    // Staff UUID
     name: string                  // Display name
     email: string                 // Clerk email
     role: string                  // 'ADMIN' | 'STAFF'
     language: Language            // 'EN' | 'VI'
     orgRole: string | null        // 'org:admin' | 'org:member' | null
     avatarUrl: string | null      // NEW: R2 signed URL or null
   }
   ```

2. **useOrgRole Hook Return** (use-org-role.ts:8-24):
   ```typescript
   {
     orgRole: OrgRole | null
     isAdmin: boolean
     isLoading: boolean
     staffId: string | null
     avatarUrl: string | null      // NEW
   }
   ```

3. **SidebarContent Props** (sidebar-content.tsx:25-43):
   ```typescript
   interface SidebarContentProps {
     isMobile: boolean
     showLabels: boolean
     isCollapsedDesktop: boolean
     navItems: NavItem[]
     currentPath: string
     unreadCount: number
     userInitials: string
     userName: string
     organizationName?: string
     avatarUrl?: string | null     // NEW
     voiceState: { ... }
     onClose: () => void
     onLogout: () => void
   }
   ```

**Localization Keys:**
- `profile.viewProfile` - Sidebar Link title tooltip
- English: "View profile"
- Vietnamese: "Xem hồ sơ"

**Access Control:**
- Current user (me): Always allowed via useOrgRole
- Team members: Accessible to org admins (Team page already restricted)
- Query scoping: `/staff/me` returns current user only

**Performance Considerations:**
- `useOrgRole` caches for 60 seconds (staleTime: 60000)
- Avatar URL from R2: 7-day TTL (set during avatar confirmation)
- Single API call per session for staff.me data
- No N+1 queries: sidebar uses cached hook result

**Backward Compatibility:**
- avatarUrl: optional field (null for existing accounts)
- No database schema changes
- Graceful fallback: initials badge if no avatar
- All changes additive (no breaking changes)

**Code Quality:** 9.5/10
- Type-safe navigation
- Proper accessibility (title, aria labels)
- Full i18n coverage
- Clean component composition
- Responsive design

## AI Document Processing

**Gemini Integration:**
- Image validation: JPEG, PNG, WebP, HEIC, PDF (10MB max)
- Retry logic: 3 attempts, exponential backoff
- Batch processing: 3 concurrent images
- Classification: Multi-class tax form detection (180+ types)
- OCR: W2, 1099-INT, 1099-NEC, K-1, 1098, 1095-A, Schedule 1/C/SE/D/E, Form 1040
- Confidence scoring for verification workflow
- **NEW (Phase 02):** Fallback smart rename for confidence < 60% (semantic filename generation via vision analysis)

**Services:**

Schedule E Services:
```typescript
apps/api/src/services/schedule-e/
├── expense-calculator.ts - Calculate totals, fair rental days
├── version-history.ts - Track version entries, detect changes
└── sms/templates/schedule-e.ts - VI/EN SMS templates
```

Gemini Service:
```typescript
apps/api/src/services/ai/
├── gemini-client.ts - API client with retry/validation
├── document-classifier.ts - Classification service (+ generateSmartFilename NEW)
├── blur-detector.ts - Quality detection
└── prompts/
    ├── classify.ts - Classification + SmartRename prompts
    ├── address-parser.ts - US address parsing (structured extraction for contractors)
    └── ocr/ - 22 OCR extraction prompts (forms 1040, schedules, income docs)
```

**Address Parsing Service (NEW - Excel Import Fallback):**
- Used in `excel-parser.ts` when regex fails to extract city from contractor addresses
- Batch API calls: up to 50 addresses per request, handles network fallback gracefully
- Input: raw address strings (e.g., "6424 NW 53 RD ST LAUDERHILL, FL 33319")
- Output: structured { address, city, state, zip } with index mapping for fast lookup
- Validation: response type checking + address field verification
- Graceful degradation: AI parsing optional (if no Gemini key, continues with regex results)

**Phase 02 Fallback Smart Rename:**
- Triggered when classification confidence < 60%
- Extracts semantic naming elements: documentTitle, source, recipientName
- Generates filename: `{TaxYear}_{DocumentTitle}_{Source}_{RecipientName}.pdf` (max 60 chars)
- Stores in RawImage.aiMetadata JSON field for audit trail
- Graceful degradation: failures don't block job or create false classifications
- Vietnamese name handling: diacritics removed (ă→a, đ→d), PascalCase formatting
- See: [`phase-02-fallback-smart-rename.md`](./phase-02-fallback-smart-rename.md) for details

Magic Link Service:
```typescript
apps/api/src/services/magic-link.ts
├── getMagicLinkUrl() - Maps link types to URLs
├── validateScheduleEToken() - Token validation
├── getScheduleEMagicLink() - Generate link
└── Support for PORTAL, SCHEDULE_C, SCHEDULE_E types
```

## Schedule E Workspace Tab (Phase 4 Frontend - 2026-02-06)

**Location:** `apps/workspace/src/components/cases/tabs/schedule-e-tab/`

**Data Hooks:**
```typescript
useScheduleE({ caseId, enabled }) - Fetches expense data via useQuery
├── Returns: expense, magicLink, totals, properties
├── Stale time: 30 seconds
└── Query key: ['schedule-e', caseId]

useScheduleEActions() - Mutations for send/resend/lock/unlock
├── Optimistic updates via React Query invalidation
└── Toast feedback on success/error
```

**Component Hierarchy:**
```
ScheduleETab (index.tsx) [4 states]
├── State: !expense → ScheduleEEmptyState
│   └── Actions: Send magic link, Show pending
├── State: status=DRAFT → ScheduleEWaiting
│   └── Shows: "Waiting for client to complete form on portal"
└── State: SUBMITTED|LOCKED → ScheduleESummary
    ├── PropertyCard [expandable]
    │   ├── Address, Type, Rental period (copyable)
    │   └── 7 Expenses table with formatUSD
    ├── TotalsCard
    │   └── Income + aggregate expenses
    ├── StatusBadge
    │   └── Visual status display
    └── ScheduleEActions
        └── Lock/unlock buttons (staff control)
```

**Sub-Components:**
- **property-card.tsx** - Expandable property details, XSS sanitization via sanitizeText()
- **totals-card.tsx** - Aggregate income/expense calculation
- **status-badge.tsx** - Status visual indicator
- **schedule-e-empty-state.tsx** - Initial state with send button
- **schedule-e-waiting.tsx** - In-progress state messaging
- **schedule-e-summary.tsx** - Read-only summary
- **schedule-e-actions.tsx** - Lock/unlock staff controls
- **copyable-value.tsx** - Reusable copy-to-clipboard component
- **format-utils.ts** - Utility functions: formatUSD(), getPropertyTypeLabel(), formatAddress()

**Internationalization:**
- 60+ keys in `apps/workspace/src/locales/{en,vi}.json`
- Keys: scheduleE.property, scheduleE.line9Insurance, scheduleE.status, etc.
- Full EN/VI support for all UI text

**API Integration:**
- Type: `ScheduleEResponse { expense, magicLink, totals }`
- Endpoint: `GET /schedule-e/:caseId` (via `api.scheduleE.get(caseId)`)
- Magic link operations reuse existing POST /send, POST /resend routes

## Phase 04: Frontend Profile Toggles - CPA Upload SMS Notifications

**Overview:**
Staff notification preferences UI enabling staff to control SMS alerts for document uploads via profile settings. Integrates with Phase 01 (schema) and Phase 02-03 (backend services).

**Features:**
- `notifyOnUpload` toggle: Receive SMS when clients upload documents (default: true)
- `notifyAllClients` toggle: Admin-only flag to receive notifications for all clients, not just assigned (default: false)

**UI Integration:**

**ProfileForm Component** (`apps/workspace/src/components/profile/profile-form.tsx`):
```typescript
// State management
const [editNotifyOnUpload, setEditNotifyOnUpload] = useState(staff.notifyOnUpload)
const [editNotifyAllClients, setEditNotifyAllClients] = useState(staff.notifyAllClients)

// Update mutation includes notification fields
api.team.updateProfile(staffId, {
  name, phoneNumber, notifyOnUpload, notifyAllClients
})

// Switch components for toggle UI
<Switch
  checked={editNotifyOnUpload}
  onCheckedChange={setEditNotifyOnUpload}
  disabled={!canEdit}
/>
```

**UI Package Switch Component** (`packages/ui/src/components/switch.tsx`, NEW):
- Accessible toggle switch (role="switch", aria-checked)
- Keyboard support: Enter/Space to toggle
- Controlled + uncontrolled modes
- Size variants: default (h-6 w-11) | sm (h-5 w-9)
- States: idle, hover, focused, disabled
- No external dependencies (pure CSS via CVA)

**API Integration:**

**Backend Schema** (`apps/api/src/routes/team/schemas.ts`):
```typescript
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/).optional().nullable(),
  notifyOnUpload: z.boolean().optional(),
  notifyAllClients: z.boolean().optional(),
})
```

**Backend Endpoints** (`apps/api/src/routes/team/index.ts`):
- `GET /team/members/:staffId/profile` - Returns Staff with notification fields
- `PATCH /team/members/:staffId/profile` - Updates notification fields (self-only)

**API Client** (`apps/workspace/src/lib/api-client.ts`):
```typescript
interface StaffProfile {
  id: string
  name: string
  email: string
  phoneNumber: string | null
  notifyOnUpload: boolean        // NEW
  notifyAllClients: boolean      // NEW (admin-only)
  // ... other fields
}

interface UpdateStaffProfileInput {
  name?: string
  phoneNumber?: string | null
  notifyOnUpload?: boolean       // NEW
  notifyAllClients?: boolean     // NEW
}
```

**Localization Keys** (5 new keys):
```json
{
  "profile.notifyOnUpload": "Document upload notifications",
  "profile.notifyOnUploadDesc": "Receive SMS when clients upload documents",
  "profile.notifyAllClients": "Notify for all clients",
  "profile.notifyAllClientsDesc": "Receive notifications for all clients, not just assigned ones"
}
```

**Vietnamese Translations** (vi.json):
```json
{
  "profile.notifyOnUpload": "Thông báo tải tài liệu",
  "profile.notifyOnUploadDesc": "Nhận tin nhắn SMS khi khách hàng tải tài liệu",
  "profile.notifyAllClients": "Thông báo cho tất cả khách hàng",
  "profile.notifyAllClientsDesc": "Nhận thông báo cho tất cả khách hàng, không chỉ những khách hàng được gán"
}
```

**Access Control:**
- Self-only editing via JWT context validation
- `notifyAllClients` admin-only (flag presence, not enforced in UI)
- Team page already restricts admin users

**Data Flow:**
```
ProfileForm renders
  ↓
User toggles Switch component
  ↓
State updates (editNotifyOnUpload/editNotifyAllClients)
  ↓
User clicks Save
  ↓
useMutation calls api.team.updateProfile(staffId, { notifyOnUpload, notifyAllClients })
  ↓
Backend PATCH /team/members/:staffId/profile validates + updates Staff
  ↓
onSuccess: invalidate ['team-member-profile', staffId]
  ↓
Profile refetches with new notification preferences
  ↓
Success toast: "Profile updated"
```

**Backward Compatibility:**
- New fields optional in schema (updateProfileSchema)
- Notification fields nullable in UpdateStaffProfileInput
- Database defaults: notifyOnUpload=true, notifyAllClients=false (set at schema)
- Graceful fallback for existing staff without preferences

**Code Quality:** 9.2/10
- Type-safe notification fields
- Accessible Switch component (WCAG 2.1 compliant)
- Full i18n coverage (EN/VI)
- Self-only enforcement via backend
- Clean component composition with ProfileForm

---

## Phase 02: Backend Client Overview - Avatar, Notes & Activity

**Overview:**
Client profile enhancement API enabling staff to manage client avatars, internal notes, and view activity timeline. Presigned R2 workflow for efficient avatar uploads, rich HTML notes support, and aggregated activity from documents/messages/case updates.

**New Client Fields:**
```typescript
Client {
  avatarUrl?: string | null         // Signed R2 URL (7-day TTL) or null
  notes?: string | null             // HTML content up to 50KB (Tiptap editor format)
  notesUpdatedAt?: Date | null      // Timestamp of last notes edit
}
```

**Avatar Upload Workflow (`POST` then `PATCH`):**
1. `POST /clients/:id/avatar/presigned-url` - Request presigned PUT URL
   - Input: `{ contentType, fileSize }` (JPEG/PNG/WebP/GIF, max 10MB)
   - Output: `{ uploadUrl, r2Key }` (15min expiry)
   - Security: Generates key as `client-avatars/{clientId}/{timestamp}-{random}.{ext}`
2. Browser PUT to presigned URL directly (bypasses server)
3. `PATCH /clients/:id/avatar` - Confirm upload
   - Input: `{ r2Key }` (from presigned response)
   - Validates key belongs to client (prevents path traversal)
   - Generates signed download URL (7-day TTL)
   - Output: `{ id, avatarUrl, updatedAt }`

**Avatar Security:**
- Presigned URLs expire 15 min (upload), 7 days (download)
- R2 key validation: Must start with `client-avatars/{clientId}/`
- Client-level access control via org-scoped queries
- File size limits: 10MB pre-upload validation

**Notes API (`PATCH /clients/:id/notes`):**
- Input: `{ notes }` (HTML string, max 50KB)
- Stores as-is from Tiptap editor (frontend responsible for sanitization on render)
- Truncates to 50KB if exceeded
- Updates notesUpdatedAt timestamp
- Output: `{ id, notes, notesUpdatedAt, updatedAt }`
- XSS prevention: Frontend auto-escapes React rendering (notes aren't treated as raw HTML)

**Activity Timeline (`GET /clients/:id/activity`):**
Aggregates recent events across client's tax cases in single endpoint:
```typescript
ActivityItem {
  type: 'upload' | 'message' | 'case_updated'
  id: string
  timestamp: string (ISO8601)
  description: string
}
```
- **uploads:** RawImage entries (displayName or filename)
- **messages:** SMS/PORTAL messages (direction + first 50 chars of content)
- **case_updated:** TaxCase status changes (year + current status)
- Returns top 10 most recent (sorted desc by timestamp)

**Quick Stats (`GET /clients/:id/stats`):**
Single query endpoint for client overview cards:
```typescript
{
  totalFiles: number          // Count of RawImage uploads
  taxYears: number[]          // Unique tax years (sorted desc)
  verifiedPercent: number     // % of DigitalDoc with status=VERIFIED (0-100)
  lastMessageAt: string | null // Most recent Message.createdAt (ISO8601)
}
```

**API Integration:**
```typescript
// In api-client.ts
api.clients.getActivity(clientId)       // GET /clients/:id/activity
api.clients.getStats(clientId)          // GET /clients/:id/stats
api.clients.avatarPresignedUrl(clientId, { contentType, fileSize })
api.clients.confirmAvatar(clientId, { r2Key })
api.clients.deleteAvatar(clientId)      // DELETE /clients/:id/avatar
api.clients.updateNotes(clientId, { notes })
```

**Validation Schemas (New):**
- `avatarPresignedUrlSchema` - contentType enum (JPEG/PNG/WebP/GIF), fileSize 100B-10MB
- `avatarConfirmSchema` - r2Key must start with `client-avatars/`
- `updateNotesSchema` - notes max 50KB

**Access Control:**
- All endpoints org-scoped via buildClientScopeFilter
- Admin: See all client avatars/notes
- Staff: See only assigned client avatars/notes
- Activity/stats: Scoped to client's own cases + messages

**Performance Notes:**
- Activity endpoint: Parallel queries (rawImages, messages, taxCases), returns top 10
- Stats endpoint: Single aggregation query with COUNT, no N+1
- Avatar presigned: Single R2 API call (cached 15min)
- Notes: Single update, no indexing overhead

**Localization:**
All avatar/notes UI will need i18n keys in workspace:
- `profile.changeClientAvatar` - Button label
- `profile.avatarUpdated` - Success toast
- `profile.notesPlaceholder` - Editor hint text
- Error keys for validation failures

---

## Voice & SMS

**Twilio Integration:**
- VoiceGrant tokens for browser calling
- TwiML webhooks: incoming call, dial complete, voicemail recording
- Phone presence tracking (staff online/offline)
- Automatic call recording + transcription
- SMS delivery for client onboarding

**Message Channels:**
- SMS: Twilio integration
- PORTAL: Magic link portal messages
- SYSTEM: Automated notifications
- CALL: Twilio call records with recordings

## Deployment Architecture

**Development:**
- Frontend: `pnpm -F @ella/workspace dev` (Vite, PORT 5174)
- Backend: `pnpm -F @ella/api dev` (Hono, PORT 3002)
- Database: Local PostgreSQL (docker-compose)

**Production:**
- Frontend: Vercel (React + TanStack Router)
- Backend: Railway or Fly.io (Hono + Node)
- Database: PostgreSQL (Supabase or cloud provider)
- File Storage: Cloudflare R2
- CI/CD: GitHub Actions

## Error Handling

**Backend:**
- Global error handler middleware
- Standardized error responses: HTTP status + message
- Localized error messages (Vietnamese)
- Detailed logging with request context
- Sensitive data redaction

**Frontend:**
- Error Boundary wrapper for crashes
- Toast notifications for user feedback
- Optimistic updates with rollback
- Network error retry logic

## Performance Considerations

**Database:**
- Connection pooling (Prisma)
- Composite indexes for org-scoped queries
- Query optimization for large datasets

**Frontend:**
- Code splitting via TanStack Router
- React Query caching + stale-while-revalidate
- Image lazy loading + CDN caching (R2)
- Pagination for large lists

**API:**
- Response time target: <200ms (95th percentile)
- Rate limiting per org
- Batch operations for bulk assignments
- Async job processing for heavy tasks

## Security

**Data Isolation:**
- Org-scoped queries at middleware & service layer
- Client.managedById FK enforces single-manager relationship
- Audit logging for all changes

**Authentication:**
- Clerk OAuth with org management
- JWT with org-aware tokens
- HTTPS only
- CORS scoped to frontend domains

**Validation:**
- Zod schemas for all inputs
- Type-safe database queries (Prisma)
- Signature validation for webhooks

---

**Version:** 2.7
**Last Updated:** 2026-03-24
**Status:** Multi-Tenant architecture with Clerk Webhook Sync Migration complete. Auth middleware is read-only (no request-time DB writes), all user/org/membership syncs via event-driven webhooks + Clerk Backend API for mutations. Includes Phase 02 Draft Return Sharing + Phase 04 Navigation + Phase 02 Profile API + Phase 2 Document Upload Notification.
