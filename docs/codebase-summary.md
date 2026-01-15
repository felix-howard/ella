# Ella - Codebase Summary (Quick Reference)

**Current Date:** 2026-01-15
**Current Branch:** feature/enhancement

## Project Status Overview

| Phase | Status | Completed |
|-------|--------|-----------|
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
│   ├── api/          # Hono backend (PORT 3001)
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

### @ella/db
**Database layer with Prisma ORM**

- 13 models: Staff, Client, ClientProfile, TaxCase, RawImage, ImageGroup, DigitalDoc, ChecklistTemplate, ChecklistItem, Conversation, Message, MagicLink, Action
- 12 enums for tax types, statuses, roles
- Singleton pattern for connection pooling
- Seed data: 25 checklist templates across 3 tax forms
- **Phase 03:** ImageGroup model for duplicate detection & grouping

**Quick Commands:**
```bash
pnpm -F @ella/db generate  # Generate Prisma client
pnpm -F @ella/db push      # Sync schema to DB
pnpm -F @ella/db seed      # Populate templates
pnpm -F @ella/db studio    # Prisma Studio UI
```

### @ella/shared
**Validation schemas & types**

- Zod validators: email, phone, UUID, pagination, API response
- TypeScript type exports
- Two import paths: `@ella/shared`, `@ella/shared/schemas`

### @ella/ui
**11-component shared library + Phase 03 Shared Components**

See detailed docs: [phase-1.5-ui-components.md](./phase-1.5-ui-components.md)

**Phase 1.5 Base Components:**
- Base: Button, Card, Input, Select, Badge, Modal, Tabs, Avatar, Progress, Tooltip
- Icon exports: 50+ Lucide icons
- Variants: 80+ total across all components

**Phase 03 Shared Components (Data Entry & Verification):**
Located in `apps/workspace/src/components/ui/` + hooks:

1. **ImageViewer** - Zoomable image/PDF viewer with lazy-loaded PDF rendering
   - Features: Zoom (0.5-3x), rotation (90° increments), PDF page navigation
   - Lazy loads `react-pdf` (~150KB savings) on demand
   - Controls: Toolbar + page navigation for multi-page PDFs
   - Error handling: XSS-safe URL validation, fallback messages

2. **PdfViewer** - Internal PDF rendering (lazy loaded)
   - Uses `react-pdf` + PDF.js worker from cdnjs
   - Renders single page with zoom/rotation transforms
   - Text/annotation layers disabled for performance
   - Skeleton loading state during page load

3. **FieldVerificationItem** - Field verification component with three actions
   - Actions: Verify (checkmark), Edit (inline editing), Mark Unreadable (alert)
   - Auto-save on blur with trimmed values
   - Status badges: "Đã xác minh", "Đã sửa", "Không đọc được"
   - Color-coded borders per status (verified/edited/unreadable)

4. **CopyableField** - Copy-to-clipboard tracking for data entry
   - Copy button with visual feedback (2s indicator)
   - Persisted copy status circle (filled = copied)
   - Used for OltPro external system data entry workflow
   - Clipboard API with toast error fallback

5. **ProgressIndicator** - Progress bar with current/total display
   - Format: "X/Y (Z%)" with ARIA live regions
   - Wrapper around ProgressBar component with count display
   - Variants: Standard + CompactProgressIndicator for tables

6. **CompactProgressIndicator** - Inline progress (table cells)
   - Mini progress bar + inline count/percentage
   - Single-line format: `─────●  5/10`

7. **useCopyTracking** - Hook for copy tracking state management
   - Separated from components for Fast Refresh
   - Methods: markCopied(), isCopied(), getCopyProgress()
   - Returns Set-based copiedFields + progress stats

**UI Component Index:** `apps/workspace/src/components/ui/index.ts`
- Exports all Phase 03 components + useCopyTracking hook
- Central export point for component usage

## Core Applications

### @ella/api
**REST API (Hono framework, PORT 3001)**

**Routes:** 42+ endpoints across 8 modules
- Clients (6 endpoints: CRUD + profile + resend SMS)
- Cases (7 endpoints: CRUD + checklist + images + transitions)
- Documents (12 endpoints: details + classify + OCR + verify + image groups [Phase 03] + verify-field + mark-copied + complete-entry)
- Images (3 endpoints: classification update + move + request-reupload [Phase 02])
- Actions (2 endpoints: list + get/complete)
- Messages (4 endpoints: conversations + history + send + remind)
- Portal (2 endpoints: validate magic link + upload)
- Webhooks (2 endpoints: Twilio SMS + status updates)
- Health (1 endpoint: server status)

**Features:**
- Zod validation on all inputs
- Global error handling
- OpenAPI docs at `/doc`
- Scalar UI at `/docs`
- CORS enabled for frontend

### @ella/portal
**Client-facing upload portal (React, PORT 5174)**

**Pages:**
- Home - Landing page
- `/u/$token` - Magic link entry
- `/u/$token/upload` - Document upload flow (EnhancedUploader component)
- `/u/$token/status` - Upload status tracking

**Features:**
- Passwordless token-based auth (magic link)
- Mobile-optimized (max-width 448px)
- Vietnamese/English i18n
- Enhanced uploader with:
  - Mobile: Camera + Gallery buttons
  - Desktop: Drag & drop + click to browse
  - Real-time progress tracking (XHR)
  - Automatic retry for network errors (2 retries)
  - File validation (JPEG, PNG, GIF, WebP, PDF; 10MB max per file, 20 files max)
  - Preview grid with upload overlays
  - Memory-safe (cleanup blob URLs on unmount)
  - Accessibility (ARIA labels, progress bar role, semantic HTML)

### @ella/workspace
**Staff management dashboard (React, PORT 5173)**

**Pages:**
- `/` - Dashboard with stats
- `/actions` - Priority-grouped action queue
- `/clients` - Kanban/table client view
- `/clients/$clientId` - Client detail (3 tabs)
- `/clients/new` - Multi-step client creation
- `/cases/$caseId/entry` - Data entry mode (Phase 4.2: side-by-side document viewer with pan/zoom/field highlighting; Phase 4.1: clipboard workflow)
- `/messages` - Unified inbox (split view: conversations left, thread right)
- `/messages/$caseId` - Conversation detail with message thread

**Features:**
- Vietnamese-first UI
- Zustand state management (UI store + toast store)
- 20+ reusable components + 7 messaging components + toast system
- Type-safe routing (TanStack Router)
- Real-time polling: 30s inbox, 10s active conversation
- Unified message management (SMS, portal, system)
- Unread count badges & filtering
- Copy-to-clipboard workflow with keyboard navigation (Phase 4.1)
- 3-tab document workflow: Uploads | Review Queue | Verified (Phase 04 Tabs)

## Database Schema Highlights

### Core Models
- **Staff** - Roles: admin, staff, CPA
- **Client** - Name, phone, email, language
- **TaxCase** - Per-client per-year, 7 status states
- **RawImage** - Upload documents with reupload tracking (Phase 01); AI classification + perceptual hash + group tracking
- **ImageGroup** - Duplicate grouping by pHash (Phase 03)
- **DigitalDoc** - Extracted & verified docs with field verification + copy tracking + entry completion (Phase 01)
- **ChecklistTemplate** - Requirements per tax form
- **Message** - SMS/portal/system conversations

### Key Enums
- TaxCaseStatus: 7 states (INTAKE → FILED)
- DocType: 21 document types
- MessageChannel: SMS, portal, system
- ActionType: 6 types + 4 priorities

## Development Workflow

### Install & Setup
```bash
pnpm install
pnpm -F @ella/db generate
pnpm -F @ella/db push        # Requires DATABASE_URL in .env
pnpm -F @ella/db seed
```

### Run Dev Servers
```bash
turbo run dev                 # All apps in parallel
# Or individual:
pnpm -F @ella/api dev        # API on :3001
pnpm -F @ella/portal dev     # Portal on :5174
pnpm -F @ella/workspace dev  # Workspace on :5173
```

### Code Quality
```bash
turbo lint                    # ESLint all packages
pnpm format                   # Prettier (2-space, no semicolons)
pnpm type-check              # TypeScript validation
```

## Documentation Structure

| File | Purpose |
|------|---------|
| [codebase-summary.md](./codebase-summary.md) | This file - quick reference |
| [phase-1.5-ui-components.md](./phase-1.5-ui-components.md) | UI library detailed reference |
| [project-overview-pdr.md](./project-overview-pdr.md) | Project vision & requirements |
| [code-standards.md](./code-standards.md) | Coding standards & patterns |
| [system-architecture.md](./system-architecture.md) | System design & data flow |

## Environment Variables

**Required:**
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ella
```

**Authentication (Phase 3):**
```bash
JWT_SECRET=<generated-secret>           # Required (prod): min 32 chars
JWT_EXPIRES_IN=15m                      # Optional: Access token expiry (default: 15m)
REFRESH_TOKEN_EXPIRES_DAYS=7            # Optional: Refresh token expiry (default: 7)
SCHEDULER_ENABLED=false                 # Optional: Enable scheduler (default: false)
REMINDER_CRON="0 2 * * *"               # Optional: Cron for reminders (default: 2 AM UTC)
```

**Generate JWT Secret:**
```bash
openssl rand -hex 32
```

**AI Services (Phase 2.1):**
```bash
GEMINI_API_KEY=                    # Required - Google Gemini API key
GEMINI_MODEL=gemini-2.0-flash      # Optional - Model (default: gemini-2.0-flash)
GEMINI_MAX_RETRIES=3               # Optional - Max retries (default: 3)
GEMINI_RETRY_DELAY_MS=1000         # Optional - Retry delay ms (default: 1000)
AI_BATCH_CONCURRENCY=3             # Optional - Batch concurrency (default: 3)
```

**SMS Integration (Phase 3.1):**
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

## Design System

**Colors:**
- Primary (Mint): #10b981
- Accent (Coral): #f97316
- Success (Green): #22c55e
- Error (Red): #ef4444
- Warning (Orange): #f59e0b

**Typography:**
- Font: System stack (ui-sans-serif)
- Sizes: text-xs (10px) to text-2xl (24px)
- Line heights: 1.4 to 1.75

**Spacing:**
- Scale: px-1 (4px) to px-8 (32px)
- Rounded: rounded-md (6px) to rounded-full

## Phase 2: Make It Usable (Core Workflow - 2026-01-14)

**Phase 2 focuses on making the platform functional for daily workflow with status transitions, document verification, and efficient data entry.**

### Phase 2 Core Features:

**1. Tax Case Status Transitions**
- 7-state workflow: INTAKE → WAITING_DOCS → IN_PROGRESS → READY_FOR_ENTRY → ENTRY_COMPLETE → REVIEW → FILED
- Validation engine prevents invalid transitions
- Timestamps track key milestones (entryCompletedAt, filedAt)
- API enforces transitions, frontend reflects valid options

**2. Document Verification Workflow**
- Quick verify/reject actions on pending documents
- `POST /docs/:id/verify-action` endpoint with action + notes
- Staff can reject documents to trigger resend requests
- Rejected docs marked as BLURRY, create BLURRY_DETECTED actions

**3. Status Selector Component**
- Frontend component: `apps/workspace/src/components/cases/status-selector.tsx`
- Dropdown shows only valid transitions for current status
- Toast notifications on update success/failure
- Disabled state during API calls
- Accessibility: aria labels, semantic HTML

**4. Verification Panel Component**
- Frontend: `apps/workspace/src/components/documents/verification-panel.tsx`
- Lists pending/extracted/partial documents needing verification
- Quick verify button or reject with notes
- Shows document confidence % and type
- Empty state when all verified

**5. Server-Side Client Search**
- `GET /clients` endpoint improved with real API calls
- Supports search parameter (name/phone/email)
- Pagination: page, limit (default 20)
- Returns client data with profile & case counts

**6. Pagination System**
- Standardized pagination: page, limit, skip calculation
- Helper functions: `getPaginationParams()`, `buildPaginationResponse()`
- Applied to: cases, images, documents endpoints
- Prevents memory issues with large datasets

**7. Shared Constants & Types**
- `packages/shared/src/constants/case-status.ts` - Status transitions + helpers
- Functions: `isValidStatusTransition()`, `getValidNextStatuses()`
- Exported from `@ella/shared` (single source of truth)
- Used by both API and frontend

**8. Enhanced API Client**
- `apps/workspace/src/lib/api-client.ts` additions:
  - New methods: `docs.verifyAction()`, `cases.update()`, `cases.getValidTransitions()`
  - Type exports: `TaxCaseStatus`, `DigitalDoc`
  - Error handling with typed responses

**9. Debounced Search Hook**
- `apps/workspace/src/hooks/use-debounced-value.ts`
- Prevents excessive API calls during typing
- Returns debounced value + pending state
- Configurable delay (500ms for search)

### Phase 2 API Endpoints:

**Cases Management:**
- `GET /cases/:id/valid-transitions` - Get valid status transitions for case
- `PATCH /cases/:id` - Update case status with validation

**Documents (New/Enhanced):**
- `POST /docs/:id/verify-action` - Quick verify or reject (NEW)
- `PATCH /docs/:id/verify` - Verify/edit extracted data with notes

**Clients:**
- `GET /clients` - Enhanced with real search/filter (Previously Phase 1)

### Phase 2 Database Updates:

**TaxCase Model:**
- Added: `entryCompletedAt`, `filedAt` timestamps
- Status field enforces VALID_STATUS_TRANSITIONS

**DigitalDoc Model:**
- `status` field: PENDING → EXTRACTED → PARTIAL → VERIFIED → FAILED/REJECTED
- `verifiedAt` timestamp for audit trail
- Supports confidence scoring for validation workflow

**Action Model:**
- New type: BLURRY_DETECTED (from document rejection)
- Enhanced metadata structure for docId, rawImageId tracking

### Phase 2 Frontend Pages Updated:

**Clients Page:**
- Real API calls replacing mock data
- Server-side search with debounce
- Pagination for client lists
- Loading states during fetch

**Client Detail Page:**
- Status selector for case management
- Verification panel showing pending docs
- Real-time checklist status
- Document rejection with notes

**Actions Page:**
- BLURRY_DETECTED actions from doc rejections
- Priority queue: URGENT, HIGH, NORMAL, LOW
- Action completion workflow

### Phase 2 Key Decisions:

1. **Status Transitions** - Enforce valid states to prevent invalid workflows
2. **Verification-First** - Document verification required before case progression
3. **Debounced Search** - Reduce API load on client search
4. **Atomic Transactions** - All-or-nothing document state changes
5. **Toast Notifications** - Clear feedback on all actions

### Phase 2 Next Steps:

1. Action assignment workflow (assign to staff member)
2. Batch document processing (multiple docs at once)
3. Search filters on documents (status, type, confidence)
4. Export case data (PDF, Excel)

---

## Phase 3: Production Ready (Authentication System - 2026-01-14)

**Phase 3 focuses on production-ready authentication with JWT+refresh tokens, RBAC, and secure token management.**

### Phase 3 Core Features:

**1. Database Models**
- `User` - Staff authentication (email, bcrypt password, roles: ADMIN/STAFF/CPA)
- `RefreshToken` - Token management (hashed storage, expiry, revocation, cleanup)

**2. Auth Service (`src/services/auth/index.ts`)**
- `hashPassword()` - bcrypt 12 rounds (industry standard)
- `generateAccessToken()` - JWT with 15m default expiry (configurable)
- `generateRefreshToken()` - Opaque token with 7-day default expiry (configurable)
- `verifyAccessToken()` - JWT signature & expiry validation
- `verifyRefreshToken()` - Refresh token validation (hash, expiry, revocation)
- `rotateRefreshToken()` - Ownership validation before rotation
- `revokeAllTokens()` - Logout everywhere functionality
- `cleanupExpiredTokens()` - Maintenance job for expired/revoked tokens

**3. Auth Middleware (`src/middleware/auth.ts`)**
- `authMiddleware` - Requires Bearer token, returns 401 if missing/invalid
- `optionalAuthMiddleware` - Sets user if valid token, continues without if not
- `requireRole()` - Factory for role-based access control
- Convenience: `adminOnly`, `staffOrAdmin`, `cpaOrAdmin`

**4. Configuration (`src/lib/config.ts`)**
- `auth.jwtSecret` - Validated (min 32 chars), throws in production if missing
- `auth.jwtExpiresIn` - Configurable expiry format (15m, 1h, 7d, etc.)
- `auth.refreshTokenExpiresDays` - Configurable expiry in days
- `scheduler.enabled` - Scheduler on/off switch
- `scheduler.reminderCron` - Cron schedule for batch reminders (9 PM EST default)

**5. Security Features**
- Password hashing: bcrypt 12 rounds (~250ms)
- Token hashing: SHA-256 for refresh tokens in storage
- Token ownership validation: Prevents reuse attacks
- Expiry validation: Checked on every request
- Revocation support: Per-token and global
- Token cleanup: Automatic maintenance job
- RBAC: Three roles (ADMIN, STAFF, CPA) enforced at route level

### Phase 3 Environment Variables:

| Variable | Type | Required | Default | Notes |
|----------|------|----------|---------|-------|
| JWT_SECRET | string | YES (prod) | dev-only | Min 32 chars, generate via openssl rand -hex 32 |
| JWT_EXPIRES_IN | string | NO | 15m | Formats: 15m, 1h, 7d, etc. |
| REFRESH_TOKEN_EXPIRES_DAYS | number | NO | 7 | Days until refresh token expires |
| SCHEDULER_ENABLED | boolean | NO | false | Enable scheduled jobs |
| REMINDER_CRON | string | NO | 0 2 * * * | Cron schedule (2 AM UTC = 9 PM EST) |

### Phase 3 Database Schema:

**User Model:**
```
- id (cuid) - Primary key
- email (unique) - Staff email
- password - bcrypt hashed (12 rounds)
- name - Full name
- role - ADMIN | STAFF | CPA (default: STAFF)
- avatarUrl (optional) - Profile photo
- isActive - Deactivation flag
- lastLoginAt (optional) - Audit trail
- refreshTokens (1:many) - Active refresh tokens
- actions (1:many) - Assigned tasks
- createdAt, updatedAt - Timestamps
```

**RefreshToken Model:**
```
- id (cuid) - Primary key
- userId - User reference (cascade delete)
- token (unique) - SHA-256 hashed opaque token
- expiresAt - Token expiry timestamp
- revokedAt (optional) - Revocation timestamp
- createdAt - Issue timestamp
- Indexes: userId, token, expiresAt (for cleanup queries)
```

---

---

## Phase 05: Real-time Updates (Polling & Notifications - 2026-01-14)

**Phase 05 adds real-time UI updates when AI classification completes, with polling, toast notifications, and floating status panel.**

### Phase 05 Core Features:

**1. Classification Updates Hook** (`apps/workspace/src/hooks/use-classification-updates.ts`)
- Polls `/cases/:id/images` endpoint every 5s (when documents tab active)
- Tracks image status changes (UPLOADED → PROCESSING → CLASSIFIED/UNCLASSIFIED/BLURRY)
- Shows contextual toast notifications based on confidence levels
- Invalidates checklist query when images linked
- Memory leak prevention (cleanup on unmount)

**2. Processing Status Display**
- `apps/workspace/src/components/documents/upload-progress.tsx` - Floating panel
- Shows "AI đang phân loại N ảnh..." with pulsing spinner
- Auto-hides when processingCount = 0
- Fixed position bottom-right (z-50)

**3. RawImage Gallery PROCESSING State**
- `apps/workspace/src/components/cases/raw-image-gallery.tsx` - Enhanced
- New PROCESSING status badge (Loader2 icon, animated)
- Shows "Đang phân loại" label during AI processing
- Integrates with polling hook via `processingCount` tracking

**4. Client Detail Integration**
- `apps/workspace/src/routes/clients/$clientId.tsx` - Updated
- `useClassificationUpdates()` hook enables real-time feedback
- UploadProgress component shown when processing images
- Toast notifications for HIGH/MEDIUM/LOW confidence levels
- Automatic checklist refresh on image linking

### Polling Architecture:
```
Documents tab active
        ↓
useClassificationUpdates({ enabled: true, refetchInterval: 5000 })
        ↓
React Query: GET /cases/:id/images (every 5s)
        ↓
Compare previous vs current image states
        ↓
Detect transitions (UPLOADED → PROCESSING, etc.)
        ↓
handleStatusChange() → Toast notification
        ↓
invalidateQueries(['checklist', caseId]) → Auto-refresh
```

### Toast Notifications:
- **HIGH confidence (85%+):** `toast.success("W2 (95%)")`
- **MEDIUM confidence (60-85%):** `toast.info("Cần xác minh: 1099-NEC (72%)")`
- **LOW confidence (<60%):** `toast.info("Độ tin cậy thấp: Invoice")`
- **Linked:** `toast.success("Đã liên kết: W2")`
- **Blurry:** `toast.error("Ảnh mờ: filename.jpg")`

### Performance Optimizations:
- `refetchIntervalInBackground: false` - Only polls when tab active
- Skip initial load notifications (prevents noise on mount)
- Memory cleanup: `previousImagesRef.clear()` on unmount
- Debounced notifications (no duplicate messages for same image)

### Files Modified:
- `apps/workspace/src/hooks/use-classification-updates.ts` - NEW
- `apps/workspace/src/components/documents/upload-progress.tsx` - NEW
- `apps/workspace/src/components/cases/raw-image-gallery.tsx` - MODIFIED (PROCESSING status)
- `apps/workspace/src/routes/clients/$clientId.tsx` - MODIFIED (hook integration)

---

## Recent Changes (Phase 04 Tabs, 04, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2 - Tab Refactor, Review UX, AI, Communication & Data Entry)

### Phase 04 Tabs (Complete - 2026-01-15)
**Tab Layout Refactor - 3-Tab Workflow for Document Management**

**Overview:**
Refactored document management from confusing 4-card layout into intuitive 3-tab workflow:
- **Uploads Tab** - Raw images awaiting processing/classification
- **Review Queue Tab** - AI-extracted docs needing verification
- **Verified Tab** - Completed docs ready for data entry to OltPro

**Core Components (NEW):**
- `apps/workspace/src/components/documents/document-workflow-tabs.tsx` - Main 3-tab container
- `apps/workspace/src/components/documents/uploads-tab.tsx` - Upload queue with filter pills
- `apps/workspace/src/components/documents/review-queue-tab.tsx` - Doc verification cards
- `apps/workspace/src/components/documents/verified-tab.tsx` - Completed docs gallery
- `apps/workspace/src/components/documents/pdf-thumbnail.tsx` - Lazy-loaded PDF preview (~150KB code split)

**Files Modified:**
- `apps/workspace/src/components/documents/index.ts` - Updated barrel exports (legacy components marked deprecated)
- `apps/workspace/src/routes/clients/$clientId.tsx` - Integrated DocumentWorkflowTabs component
- `apps/workspace/src/lib/api-client.ts` - Enhanced RawImage/DigitalDoc interfaces
- `apps/workspace/src/lib/constants.ts` - AI_CONFIDENCE_THRESHOLDS config

**DocumentWorkflowTabs Props:**
```typescript
interface DocumentWorkflowTabsProps {
  caseId: string
  rawImages: RawImage[]
  digitalDocs: DigitalDoc[]
  onClassifyImage?: (image: RawImage) => void
  onReviewClassification?: (image: RawImage) => void
  onVerifyDoc?: (doc: DigitalDoc) => void
  onDataEntry?: (doc: DigitalDoc) => void
}
```

**Uploads Tab Features:**
- Status-based filtering: All, Processing, Needs Classification, Blurry
- Confidence badges: HIGH (85%+), MEDIUM (60-85%), LOW (<60%)
- Image preview with PDF lazy-loading
- Review button for low/medium confidence images
- File info: name, size, status
- Empty state handling

**Review Queue Tab Features:**
- Doc status filtering: PENDING, EXTRACTED, PARTIAL
- AI confidence display
- Field verification progress indicator
- Compact cards layout
- Thumbnail preview with signed URLs
- Verify/Review action buttons

**Verified Tab Features:**
- Completed documents ready for data entry
- VERIFIED/ENTRY_COMPLETE status display
- Multi-document gallery
- Link to data entry workflow
- Document type labels (Vietnamese)

**Performance Optimizations:**
- Memoized counts: useMemo for badge calculations
- Lazy PDF component: ~150KB code split savings
- Error boundary wrapper for tab stability
- Skeleton loaders for async data

**Status Arrays:**
```typescript
// Upload statuses
UPLOAD_STATUSES = ['UPLOADED', 'PROCESSING', 'CLASSIFIED', 'UNCLASSIFIED', 'BLURRY']
// Review statuses
REVIEW_STATUSES = ['PENDING', 'EXTRACTED', 'PARTIAL']
```

**Integration Points:**
- Replaces confusing RawImageGallery 4-card layout
- Backwards compatible: legacy components still exported (marked deprecated)
- Hooks into existing api-client for mutations
- Uses Zustand toast store for notifications
- Supports error boundaries for reliability

**Next Steps:**
- Monitor tab performance with large image counts
- Consider virtual scrolling if document counts exceed 100+
- Add bulk actions in Review Queue tab

See detailed docs: [phase-04-frontend-review-ux.md](./phase-04-frontend-review-ux.md)

### Phase 04 (Complete - 2026-01-14)
**Frontend Review UX - Confidence Badges & Classification Modal**

**Core Additions:**
- `apps/workspace/src/lib/constants.ts` - CONFIDENCE_LEVELS config + getConfidenceLevel() helper
- `apps/workspace/src/lib/api-client.ts` - RawImage type enhanced (classifiedType, aiConfidence), ImageGroup interface, api.images.updateClassification()
- `apps/workspace/src/components/cases/raw-image-gallery.tsx` - Confidence badges, review button for MEDIUM/LOW confidence
- `apps/workspace/src/components/documents/classification-review-modal.tsx` - Modal for CPA review + approval/rejection
- `apps/api/src/routes/images/index.ts` - PATCH /images/:id/classification endpoint with atomic transactions

**Confidence Levels:**
- HIGH (85%+): Auto-linked "Cao" badge, no review needed
- MEDIUM (60-85%): "Trung bình" badge, Review button visible, modal opens
- LOW (<60%): "Thấp" badge, Review button visible, modal opens

**Classification Review Modal:**
- Image preview with XSS-safe signed URL validation
- Current classification + confidence display
- DocType selector dropdown (21 supported types)
- Approve/Reject buttons
- Keyboard shortcuts: Enter=Approve, Esc=Close
- Optimistic React Query updates
- Toast notifications

**Approve Workflow:**
1. PATCH /images/:id/classification { docType, action: 'approve' }
2. Backend: RawImage.status = LINKED, aiConfidence = 1.0 (manual)
3. Link to ChecklistItem + increment receivedCount
4. Create/update DigitalDoc (PENDING status for OCR)
5. Toast: "Đã xác nhận phân loại"

**Reject Workflow:**
1. PATCH /images/:id/classification { docType, action: 'reject' }
2. Backend: RawImage.status = BLURRY, clear classification
3. Create BLURRY_DETECTED action (HIGH priority)
4. Toast: "Đã từ chối - yêu cầu gửi lại"

**Security:**
- XSS prevention: Signed URL validation against trusted cloud hosts
- Only HTTPS URLs from .r2.cloudflarestorage.com, .amazonaws.com, .storage.googleapis.com, .blob.core.windows.net

See detailed docs: [phase-04-frontend-review-ux.md](./phase-04-frontend-review-ux.md)

### Phase 4.2 (Complete - 2026-01-14)
**Side-by-Side Document Viewer with Pan/Zoom & Field Highlighting**

**Core Enhancement:**
- `apps/workspace/src/components/data-entry/original-image-viewer.tsx` - Advanced viewer component (NEW)
- `apps/workspace/src/routes/cases/$caseId/entry.tsx` - Integrated field hover state (UPDATED)

**Features:**
- Pan support: Left-click drag to move zoomed images within viewport
- Zoom control: Ctrl+Scroll (0.5x–4x range), keyboard (+/-), UI buttons
- Rotate: 90° increments with keyboard (R) and buttons
- View reset: Double-click, reset button, keyboard (0)
- Field highlighting badge: Shows active field name in header during hover
- Expanded/fullscreen mode: Modal overlay with F key toggle
- Keyboard shortcuts: 10 accessible shortcuts for efficient data entry

**Keyboard Shortcuts:**
- `Ctrl+Scroll` - Zoom in/out
- `+/-` - Zoom increment
- `R` - Rotate right 90°
- `0` - Reset all transforms
- `F` - Toggle fullscreen mode
- Drag - Pan image
- Double-click - Reset zoom + pan

**Field Highlighting Workflow:**
- Hover field in data entry form → Badge displays field name
- Visual correlation between extracted data and document regions
- Helps staff locate fields quickly in original images
- Improves data accuracy and reduces lookup time

**Component Details:**
- Props: `image`, `expanded`, `onExpandToggle`, `highlightedField`, `className`
- State: `zoom`, `rotation`, `pan`, `isPanning`, `panStart`
- Auto-resets view when image changes (via ref tracking)
- Ref-based pan state prevents unnecessary re-renders
- Pointer management: Stops panning on mouse leave/up

**Browser Support:**
- All modern browsers (Chrome 88+, Firefox 85+, Safari 14+, Edge 88+)
- Mac: Uses `ctrlKey || metaKey` for Cmd+Scroll zoom

**Accessibility:**
- Full keyboard navigation support
- aria-labels on all buttons
- Focus rings: `focus:ring-2 focus:ring-primary`
- Container focusable: `tabIndex={0}`

**UI/UX:**
- Header: Filename + zoom % + field badge + controls
- Footer: Vietnamese keyboard hints
- Expanded mode: Fixed overlay `inset-4` with `z-50`
- Cursor feedback: `cursor-grab/grabbing` during pan

**Next Steps:**
- Phase 4.3: Auto-detect document type on image view
- Phase 4.4: Multi-page PDF support with page navigation
- Storage: Replace placeholder SVG with signed R2 URLs

See detailed docs: [phase-4.2-side-by-side-document-viewer.md](./phase-4.2-side-by-side-document-viewer.md)

### Phase 4.1 (Complete - 2026-01-14)
**Copy-to-Clipboard Workflow (Data Entry Optimization)**

**Core Additions:**
- `apps/workspace/src/stores/toast-store.ts` - Zustand toast notification store with auto-dismiss & cleanup
- `apps/workspace/src/components/ui/toast-container.tsx` - Toast UI component (bottom-center stack)
- `apps/workspace/src/hooks/use-clipboard.ts` - Clipboard hook with modern API + fallback support
- `apps/workspace/src/hooks/index.ts` - Hooks barrel export

**Features:**
- Toast system: success/error/info types, auto-dismiss (2s default), manual dismiss, memory leak prevention
- useClipboard hook: copy text, copyFormatted for label:value pairs, browser fallback
- Data entry page enhancements:
  - Field configuration per document type (W2, 1099s, SSN, DL, Bank Statement)
  - Keyboard navigation: Tab/Shift+Tab, Up/Down arrows, Enter to copy, Ctrl+Shift+C for copy-all
  - Copy tracking visual feedback
  - Formatted copy-all output with document type header
  - Mark entry complete workflow

**Keyboard Shortcuts:**
- `Tab` - Next field
- `Shift+Tab` - Previous field
- `↑/↓` - Navigate field items
- `Enter` - Copy focused field
- `←/→` - Switch documents
- `Ctrl+Shift+C` - Copy all fields

**Memory Safety:**
- Timeout cleanup tracking prevents memory leaks on manual toast dismiss
- DOM cleanup in clipboard fallback
- useCallback dependency optimization

**Browser Compatibility:**
- Modern: Clipboard API (Chrome 63+, Firefox 53+, Safari 13.1+, Edge 79+)
- Fallback: execCommand for older browsers & IE 11

**Files Modified:**
- `apps/workspace/src/routes/__root.tsx` - Added ToastContainer
- `apps/workspace/src/routes/cases/$caseId/entry.tsx` - Enhanced with clipboard, keyboard nav, copy tracking

See detailed docs: [phase-4.1-copy-clipboard-workflow.md](./phase-4.1-copy-clipboard-workflow.md)

### Phase 3.2 (Complete - 2026-01-14)
**Unified Inbox & Conversation Management**

**API Enhancements:**
- `GET /messages/conversations` - List all conversations with unread counts, pagination, last message preview
- Auto-fetches conversation with unread count reset on first message load
- Upsert pattern prevents race conditions on concurrent conversation access

**Frontend Pages & Components:**
- `/messages` - Unified inbox with split view layout
  - Left panel: Conversation list with unread badges, unread-only filter toggle, refresh button
  - Right panel: Message thread or empty state selection UI
  - Auto-navigation to first conversation if none selected

- `/messages/$caseId` - Conversation detail view
  - Message thread (chronological, with channel/direction indicators)
  - Client header with name, phone, case status, language, tax year
  - Quick actions bar: message send button, link to client profile
  - Refresh capability for manual updates

**Messaging Components (7 total):**
1. `ConversationList` - Scrollable list with loading state & empty state
2. `ConversationListItem` - Individual conversation with unread badge, preview, timestamps
3. `MessageThread` - Chronological message display with channel chips
4. `MessageBubble` - Individual message rendering (INBOUND/OUTBOUND styling)
5. `QuickActionsBar` - Message input with SMS/PORTAL channel picker
6. `TemplatePicker` - Pre-defined message templates selector (future)
7. Export helpers in `index.ts`

**Real-Time Features:**
- Inbox polling: 30-second interval for background updates
- Active conversation polling: 10-second interval while viewing
- Optimistic message updates on send
- Silent refresh (non-blocking) with visual feedback

**Accessibility:**
- aria-label on filter/refresh buttons
- aria-pressed state for toggle buttons
- aria-hidden for decorative icons
- Semantic HTML with proper heading hierarchy

**UI/UX Details:**
- Vietnamese labels: "Tin nhắn" (Messages), "Chọn cuộc hội thoại" (Select conversation)
- Empty state icon + helpful text for no selection
- Loading skeleton for case header data
- Unread count badge on messages list header
- Client avatar with initials
- Status color coding per case status

### Phase 3.1 (Complete - 2026-01-13)
**Twilio SMS Integration (First Half + Second Half)**

**First Half (Core SMS Infrastructure):**
- `apps/api/src/services/sms/twilio-client.ts` - SMS sending with retry logic & E.164 formatting
- `apps/api/src/services/sms/message-sender.ts` - High-level templated SMS service
- `apps/api/src/services/sms/webhook-handler.ts` - Incoming SMS processing with signature validation
- `apps/api/src/services/sms/templates/` - 4 Vietnamese message templates
- `apps/api/src/routes/webhooks/twilio.ts` - Webhook route handlers

**Second Half (Automated Notifications & Batch Reminders):**
- `apps/api/src/services/sms/notification-service.ts` - Auto-notify orchestration (NEW)
- `apps/api/src/routes/clients/index.ts` - Auto welcome SMS on client creation (UPDATED)
- `apps/api/src/routes/messages/index.ts` - New reminder endpoints (UPDATED)
- `apps/api/src/services/ai/document-pipeline.ts` - Auto blurry SMS trigger (UPDATED)

**Endpoints:**
**Core:**
- `POST /webhooks/twilio/sms` - Receive incoming SMS (signature validated, rate limited)
- `POST /webhooks/twilio/status` - Receive delivery status updates

**New (Second Half):**
- `POST /messages/remind/:caseId` - Send missing docs reminder to specific case
- `POST /messages/remind-batch` - Batch send reminders to all eligible cases (for cron)

**Automation Triggers:**
- Welcome SMS auto-sent when creating new client
- Blurry document SMS auto-sent from AI pipeline (non-blocking)
- Missing docs reminder via API endpoints or batch job

**SMS Templates:**
- `welcome.ts` - New client onboarding with magic link
- `missing-docs.ts` - Reminder for missing required documents
- `blurry-resend.ts` - Request to resend blurry/unclear images
- `complete.ts` - Notification that all documents received

**Database Integration:**
- All messages recorded in Message table (SMS channel)
- Conversation tracking with unread count
- TaxCase.lastContactAt updated for compliance
- CLIENT_REPLIED action created for incoming SMS

**Features:**
- E.164 phone number formatting (handles US numbers)
- Exponential backoff retry (2 retries, 500ms base)
- Timing-safe signature validation (prevents replay attacks)
- Input sanitization & XSS protection
- Rate limiting: 60 requests/minute/IP
- Duplicate message prevention via MessageSid
- Vietnamese-first messaging with EN fallback
- Smart throttling: 1h blurry notifications, 24h missing docs
- 3-day grace period for new clients before first reminder
- Batch processing with 5 concurrent SMS limit
- Fire-and-forget notifications (non-blocking)

**New Environment Variables:**
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_PHONE_NUMBER` - Twilio SMS-enabled phone number

### Phase 2.2 (Complete - 2026-01-13)
**Dynamic Checklist System with Atomic Transactions**

**Key Addition:**
- `apps/api/src/services/ai/pipeline-helpers.ts` - Enhanced with `processOcrResultAtomic()`
- Auto-linking raw images to checklist items on successful classification
- Atomic transaction wrapper: upsert DigitalDoc + update ChecklistItem + mark RawImage linked
- Checklist status transitions: MISSING → HAS_RAW → HAS_DIGITAL → VERIFIED

**New Functions:**
- `processOcrResultAtomic()` - Wraps 3 DB operations in single transaction
- `updateChecklistItemToHasDigital()` - Status transition on successful OCR
- Enhanced `linkToChecklistItem()` - Auto-links classified documents to checklist

**Benefits:**
- Zero race conditions on concurrent uploads
- No partial states (all-or-nothing consistency)
- Real-time checklist progress tracking
- Automatic document-to-requirement matching

### Phase 2.1 First Half (Complete)
**Core AI Services:**
- `apps/api/src/services/ai/gemini-client.ts` - Gemini API wrapper with retry logic & image validation
- `apps/api/src/services/ai/document-classifier.ts` - Multi-document classification (W2, 1099-INT, 1099-NEC, SSN_CARD, DRIVER_LICENSE)
- `apps/api/src/services/ai/blur-detector.ts` - Image quality/blur detection for document validation
- `apps/api/src/services/ai/index.ts` - AI services exports

**AI Prompts:**
- `apps/api/src/services/ai/prompts/classify.ts` - Document type classification
- `apps/api/src/services/ai/prompts/blur-check.ts` - Image quality assessment
- `apps/api/src/services/ai/prompts/ocr/w2.ts` - W2 form OCR extraction
- `apps/api/src/services/ai/prompts/ocr/1099-int.ts` - 1099-INT form OCR extraction
- `apps/api/src/services/ai/prompts/ocr/index.ts` - OCR routing logic

### Phase 2.1 Second Half (Complete)
**OCR Extraction Services:**
- `apps/api/src/services/ai/prompts/ocr/1099-nec.ts` - 1099-NEC form OCR with Vietnamese field labels
- `apps/api/src/services/ai/prompts/ocr/ssn-dl.ts` - SSN Card & Driver's License OCR extraction
- `apps/api/src/services/ai/ocr-extractor.ts` - Service routing OCR extraction by document type
- `apps/api/src/services/ai/pipeline-types.ts` - Shared pipeline interface definitions
- `apps/api/src/services/ai/pipeline-helpers.ts` - Database operations for AI pipeline
- `apps/api/src/services/ai/document-pipeline.ts` - End-to-end processing: classify → blur detect → OCR extract

**Pipeline Features:**
- Single image processing: `processImage(rawImageId, buffer, mimeType)`
- Batch processing: `processImageBatch(images[], concurrency=3)`
- Automatic Action creation on AI events (BLURRY_DETECTED, VERIFY_DOCS, AI_FAILED)
- Confidence scoring & validation for extracted data
- Vietnamese field labels for all form types
- Retry logic with exponential backoff (2 retries, 1s delay)
- Concurrency-controlled batch processing

**Portal Integration:**
- POST `/portal/:token/upload` auto-triggers AI pipeline on file upload
- Real-time document classification & validation
- Automatic checklist linking when document recognized
- Blur detection feedback in portal status UI

**Files Modified:**
- `apps/api/src/routes/portal/index.ts` - Integrated `processImage()` on file upload
- `apps/api/package.json` - Added @google/generative-ai ^0.21.0
- `apps/api/src/lib/config.ts` - Added AI configuration section with Gemini settings
- `apps/workspace/routeTree.gen.ts` - Auto-generated (no manual edits)
- `apps/portal/routeTree.gen.ts` - Auto-generated (no manual edits)

## AI Services Architecture (Phase 2.1)

### Processing Pipeline Flow
```
Upload → Classification → Blur Detection → OCR Extraction → Database + Actions
```

### Core AI Components

**GeminiClient** (`gemini-client.ts`)
- Wraps @google/generative-ai SDK with `analyzeImage<T>()` method
- Validates image formats (JPEG, PNG, WebP, HEIC, HEIF) & sizes (≤10MB)
- Exponential backoff retry (default: 3 retries, 1s base delay)
- Detects & handles rate limiting/transient errors (500, 502, 503)
- Returns typed `{ success, data, error }` results

**DocumentClassifier** (`document-classifier.ts`)
- Vision-based classification: W2, 1099-INT, 1099-NEC, 1099-DIV, 1099-K, 1099-R, SSN_CARD, DRIVER_LICENSE
- Determines if document requires OCR extraction
- Returns `{ docType, confidence, error }`
- Confidence: 0-1 (1 = highest)

**BlurDetector** (`blur-detector.ts`)
- Analyzes sharpness & quality on 0-100 scale
- Flags blurry (>70), partially blurry (50-70), sharp (<50)
- Determines if client should resend image
- Returns `{ isBlurry, blurScore, needsResend }`

**OcrExtractor** (`ocr-extractor.ts`)
- Routes to document-specific OCR prompts
- Validates extracted data structure
- Calculates confidence from key field completeness (0.5-0.99)
- Determines if manual verification needed
- Returns `{ success, extractedData, confidence, isValid }`

**DocumentPipeline** (`document-pipeline.ts`)
- Orchestrates: classify → blur detect → ocr extract
- Single: `processImage(rawImageId, buffer, mimeType)` → `PipelineResult`
- Batch: `processImageBatch(images[], concurrency)` → `PipelineResult[]`
- Creates Action records for: BLURRY_DETECTED, VERIFY_DOCS, AI_FAILED
- Retry wrapper with exponential backoff for transient failures
- Links to ChecklistItem when document recognized

### AI Prompts & OCR Support

| Form Type | File | Fields | Vietnamese Labels |
|-----------|------|--------|------------------|
| W2 | `ocr/w2.ts` | Employer, Employee, Wages, Tax | ✓ |
| 1099-INT | `ocr/1099-int.ts` | Payer, Interest Income, Tax | ✓ |
| 1099-NEC | `ocr/1099-nec.ts` | Payer, Recipient, Compensation, State Tax | ✓ |
| SSN Card | `ocr/ssn-dl.ts` | Name, SSN, Card Type | ✓ |
| Driver's License | `ocr/ssn-dl.ts` | Name, DOB, Address, License#, Exp Date | ✓ |

**Classification Prompt** (`prompts/classify.ts`)
- Multi-class detection with confidence scoring
- Handles unclear/mixed documents

**Blur Check Prompt** (`prompts/blur-check.ts`)
- Evaluates readability & sharpness
- Detects common issues: glare, shadows, angle

**OCR Router** (`prompts/ocr/index.ts`)
- `getOcrPromptForDocType(docType)` - Gets form-specific prompt
- `supportsOcrExtraction(docType)` - Checks if type has OCR
- `validateExtractedData(docType, data)` - Type-specific validation
- `getFieldLabels(docType)` - Returns Vietnamese field labels

## Phase 03: Shared Components for Data Entry & Verification (2026-01-15)

**Focus:** Reusable workspace components for field verification, copy tracking, and document viewing.

### Phase 03 Components Overview

**6 new shared components + 1 hook enable efficient data entry workflows:**

| Component | Purpose | Key Features |
|-----------|---------|-------------|
| **ImageViewer** | Multi-format document viewer | Zoom/rotate/navigate pages, lazy-loaded PDF |
| **PdfViewer** | Internal PDF rendering | Multi-page support, cdnjs PDF.js worker |
| **FieldVerificationItem** | Field-level verification UI | Verify/edit/mark unreadable, auto-save |
| **CopyableField** | Copy tracking for data entry | Toast feedback, persisted status circle |
| **ProgressIndicator** | Progress display with count | ARIA-compliant, live regions |
| **CompactProgressIndicator** | Inline progress for tables | Minimal layout, percentage/count modes |
| **useCopyTracking** | Copy state management | Set-based tracking, progress stats |

### Component Details

**ImageViewer:**
```typescript
interface ImageViewerProps {
  imageUrl: string | null
  isPdf?: boolean
  className?: string
  showControls?: boolean
}
```
- Zoom range: 0.5x–3x (0.25 step)
- Rotation: 90° increments
- PDF page navigation with min/max bounds
- XSS-safe URL validation
- Empty state: Gray placeholder with text

**FieldVerificationItem:**
```typescript
interface FieldVerificationItemProps {
  fieldKey: string
  label: string
  value: string
  status?: 'verified' | 'edited' | 'unreadable' | null
  onVerify: (status, newValue?) => void
  disabled?: boolean
}
```
- Edit mode: Input + cancel button, focus selection
- Auto-save on blur or Enter key
- Escape cancels edit
- Status styling: Green/Blue/Red borders
- Buttons hidden when verified

**CopyableField:**
```typescript
interface CopyableFieldProps {
  fieldKey: string
  label: string
  value: string
  isCopied?: boolean
  onCopy: (fieldKey) => void
  disabled?: boolean
}
```
- Clipboard API with fallback
- Visual feedback: Check icon (2s) + persist circle
- Toast error on clipboard failure
- Disabled state on empty value
- Timeout cleanup prevents memory leaks

**useCopyTracking:**
```typescript
useCopyTracking(initialCopied: string[] = [])
// Returns:
{
  copiedFields: Set<string>
  markCopied: (key) => void
  isCopied: (key) => boolean
  getCopyProgress: (total) => { copied, total, percentage }
}
```
- Set-based tracking for O(1) lookups
- Progress calculation: rounded percentage
- Separate hook prevents Fast Refresh warnings

**ProgressIndicator:**
- Displays: "Label [count/total (percentage)]"
- ARIA: role="group", aria-live="polite"
- CompactProgressIndicator: Mini bar + inline count
- Percentage optional via showPercentage prop

### File Locations

```
apps/workspace/src/
├── components/ui/
│   ├── image-viewer.tsx          # Zoomable image/PDF viewer
│   ├── pdf-viewer.tsx            # Lazy-loaded PDF component
│   ├── field-verification-item.tsx # Field verification UI
│   ├── copyable-field.tsx        # Copy tracking field
│   ├── progress-indicator.tsx    # Progress display components
│   ├── toast-container.tsx       # Existing toast UI
│   └── index.ts                  # Component exports
└── hooks/
    └── use-copy-tracking.ts      # Copy tracking state hook
```

### Usage Examples

**ImageViewer with PDF:**
```typescript
<ImageViewer
  imageUrl="https://example.com/doc.pdf"
  isPdf={true}
  showControls={true}
  className="h-96"
/>
```

**FieldVerificationItem:**
```typescript
<FieldVerificationItem
  fieldKey="wages"
  label="Wages, tips, other compensation"
  value="$45,000"
  status={verificationStatus}
  onVerify={(status, newValue) => handleVerify(status, newValue)}
/>
```

**CopyableField:**
```typescript
<CopyableField
  fieldKey="ssn"
  label="Social Security Number"
  value="123-45-6789"
  isCopied={copiedFields.has('ssn')}
  onCopy={(key) => markCopied(key)}
/>
```

**useCopyTracking:**
```typescript
const { copiedFields, markCopied, getCopyProgress } = useCopyTracking()

const handleCopy = (fieldKey) => {
  markCopied(fieldKey)
  api.markCopied({ fieldKey, docId })
}

const progress = getCopyProgress(fieldCount)
// → { copied: 3, total: 8, percentage: 37 }
```

### Design Patterns

**Lazy Loading:** ImageViewer imports PdfViewer only when isPdf=true
- Saves ~150KB bundle size for non-PDF users
- Suspense fallback with spinner

**Auto-Save:** FieldVerificationItem saves on blur/Enter
- Trim whitespace, detect changes
- onBlur + onKeyDown handlers

**Memory Safety:** CopyableField + useCopyTracking
- Timeout cleanup on unmount
- No dangling setTimeout calls

**ARIA Compliance:** All components include:
- aria-label / aria-labelledby
- aria-live for updates
- role attributes
- Semantic HTML

### Performance Notes

- ImageViewer: SVG icons, css transforms (GPU accelerated)
- PDF.js worker: Loaded from cdnjs (cached, reliable)
- CopyableField: Clipboard API (modern), fallback for older browsers
- useCopyTracking: Set-based O(1) operations vs O(n) arrays

---

## Phase 01: Document Tab UX Redesign & Entry Workflow Setup (2026-01-15)

**Phase 01 focuses on establishing backend infrastructure for data entry workflows with field-level verification, copy tracking, and document reupload request handling.**

### Phase 01 Infrastructure (Complete - Phase 01-B: Document Tab UX)

**Schema Changes (Phase 01-B):**

**DigitalDoc Model Additions:**
- `fieldVerifications Json?` - Field-level verification status tracking (verified, edited, unreadable)
- `copiedFields Json?` - Copy tracking for OltPro data entry workflow
- `entryCompleted Boolean @default(false)` - Mark document entry as completed
- `entryCompletedAt DateTime?` - Entry completion timestamp
- **New Indexes:** `@@index([entryCompleted])`, `@@index([caseId, entryCompleted])`

**RawImage Model Additions:**
- `reuploadRequested Boolean @default(false)` - Flag reupload request status
- `reuploadRequestedAt DateTime?` - Reupload request timestamp
- `reuploadReason String?` - Human-readable reupload reason
- `reuploadFields Json?` - Array of unreadable field names (e.g., ["ssn", "wages"])
- **New Indexes:** `@@index([reuploadRequested])`, `@@index([caseId, reuploadRequested])`

**Core Files:**
- `apps/api/src/lib/inngest.ts` - Inngest client singleton + event type definitions
- `apps/api/src/routes/inngest.ts` - Inngest serve endpoint (handles function discovery, invocation, dev UI)
- `apps/api/src/jobs/index.ts` - Jobs barrel export
- `apps/api/src/jobs/classify-document.ts` - Document classification job (placeholder for Phase 02)
- `apps/api/src/routes/docs/schemas.ts` - Zod validation schemas (7 new schemas for Phase 01 features)

**Zod Validation Schemas (Phase 01-B):**
- `verifyFieldSchema` - Verify single field with status (verified/edited/unreadable) + optional value
- `markCopiedSchema` - Mark field as copied for clipboard tracking
- `completeEntrySchema` - Mark document entry complete
- `requestReuploadSchema` - Request document reupload with reason + affected fields
- `fieldVerificationsSchema` - JSON field validation for fieldVerifications
- `copiedFieldsSchema` - JSON field validation for copiedFields
- `reuploadFieldsSchema` - JSON array validation for reuploadFields

**Configuration:**
- `apps/api/src/lib/config.ts` - Inngest configuration section with eventKey + signingKey
- `.env.example` - Inngest environment variables documented

**Architecture Overview:**
```
Inngest Cloud Platform
        ↓
POST /api/inngest (serve endpoint)
        ↓
inngest.createFunction() tasks
        ↓
document/uploaded event → classifyDocumentJob
        ↓
Background Processing (Retry logic, rate limiting, monitoring)
```

### Event Definitions

**Type-safe events defined in `inngest.ts`:**

1. `document/uploaded` - Triggered when client uploads document to portal
   ```typescript
   {
     rawImageId: string
     caseId: string
     r2Key: string
     mimeType: string
     uploadedAt: string
   }
   ```

2. `document/classification.complete` - Fired when classification finishes (Phase 05)
   ```typescript
   {
     rawImageId: string
     caseId: string
     docType: string | null
     confidence: number
     status: 'success' | 'failed' | 'needs_review'
     errorMessage?: string
   }
   ```

### Background Jobs (Placeholder - Implements Phase 02)

**classifyDocumentJob** - Document Classification Pipeline
- **ID:** `classify-document`
- **Trigger:** `document/uploaded` event
- **Retries:** 3 (configurable)
- **Steps:** Fetch R2 → Classify → Detect duplicates → Update DB → OCR extract → Notify
- **Status:** Placeholder steps documented (implementation Phase 02)
- **Future integrations:** Gemini classification, blur detection, OCR extraction

### Configuration (Inngest)

**Environment Variables:**
```bash
# Event key for sending events (optional for local dev)
INNGEST_EVENT_KEY=""

# Signing key - REQUIRED in production!
# Validates requests from Inngest cloud, prevents unauthorized job triggers
INNGEST_SIGNING_KEY=""
```

**Config Structure:**
```typescript
inngest: {
  eventKey: string              // Optional: cloud event API key
  signingKey: string           // Required in production for security
  isConfigured: boolean        // true if eventKey set
  isProductionReady: boolean   // true if production + signingKey, else true for dev
}
```

**Security Notes:**
- Signing key validates all requests from Inngest cloud
- Production deployments must have INNGEST_SIGNING_KEY set
- Local dev can run without signing key for testing
- Route serves at `/api/inngest` with automatic signature validation

### API Route

**Endpoint:** `POST/GET/PUT /api/inngest`
- **Purpose:** Serves Inngest background job functions
- **Functionality:**
  - Function discovery (registers all Inngest functions)
  - Job invocation (executes background tasks)
  - Development UI (introspection + testing)
- **Middleware:** Signature key validation (if configured)
- **Registration:** All jobs in `jobs/index.ts` exported + registered

### Router Integration

**In `apps/api/src/app.ts`:**
```typescript
import { inngestRoute } from './routes/inngest'
app.route('/api/inngest', inngestRoute)  // Public route (no auth required)
```

**Public Route Note:** `/api/inngest` is intentionally public + outside auth middleware to allow Inngest cloud to invoke jobs reliably.

## Next Steps

1. **Phase 02 Inngest Implementation** - Document Classification Job
   - Implement `classifyDocumentJob` with Gemini integration
   - Add AI classification step + blur detection
   - Create Inngest event triggers on file upload
   - Build job monitoring + error handling

2. **Phase 03 Advanced** - Multi-stage Processing Pipeline
   - Parallel OCR extraction for multiple documents
   - Batch job scheduling with concurrency control
   - Dead letter queue for failed jobs

3. **Phase 4.3** - Document type auto-detection on entry
   - Auto-detect and pre-fill document type when image viewed
   - Pre-populate field extraction based on classification

4. **Phase 4.4** - Multi-page document support
   - PDF page navigation in viewer
   - Thumbnail strip for quick navigation
   - Page-specific field highlighting

5. **Phase 5.0** - Advanced search & tax case analytics
6. **Phase 6.0** - Full authentication integration (Clerk setup)
7. **Phase 7.0** - Signed R2 URL integration & image caching

## Key Decisions

1. **Monorepo Structure** - Code sharing via workspace packages
2. **Prisma + PostgreSQL** - Type-safe database with migrations
3. **Tailwind + shadcn** - Fast, consistent UI development
4. **TypeScript Everywhere** - Full type safety across stack
5. **Passwordless Auth** - Magic links for client simplicity
6. **Vietnamese-First** - All UI text Vietnamese with EN fallback

## Performance Notes

- Prisma singleton prevents connection leaks
- Turbo caches build/lint across packages
- React.memo optimizations in list components
- ObjectURL cleanup in file uploads
- SVG-based icons (no rasterization)

## File Statistics

- **Total Packages:** 6 (3 apps + 3 packages)
- **Total Components:** 60+ (workspace + portal)
- **API Endpoints:** 18
- **Database Models:** 12
- **TypeScript Files:** 150+

---

## Phase 06: Testing Infrastructure & Edge Case Handling (2026-01-15)

**Focus:** Production-ready testing suite and robust error handling for background job processing.

### Testing Infrastructure

**Vitest Setup:**
- Configuration: `apps/api/vitest.config.ts`
- Pattern: `src/**/__tests__/**/*.test.ts`
- Coverage: AI services + background jobs
- Timeout: 30s (for API simulations)

**Test Files Added:**
- `apps/api/src/services/ai/__tests__/document-classifier.test.ts` (8 unit tests)
- `apps/api/src/jobs/__tests__/classify-document.test.ts` (11 integration tests)

**Test Categories:**
- Classification accuracy (W2, 1099 variants, ID documents)
- Error recovery (API failures, rate limiting, network errors)
- Batch processing with concurrency limits
- Image validation and preprocessing
- Idempotency and duplicate prevention
- Atomic database transactions

### Edge Case Handling (Phase 06)

**1. Idempotency Check**
- Skip processing if rawImage.status ≠ UPLOADED
- Prevents duplicate Inngest event processing during retries
- Early exit with skip reason logged

**2. Image Resizing (Sharp)**
- Files > 4MB automatically downsampled to 2048x2048 (inside, no enlarge)
- Converts to JPEG quality 85 to prevent Gemini timeout
- Hard limit: 20MB buffer (DoS prevention)

**3. Gemini Service Unavailability Detection**
- Pattern match: "503", "overloaded", "resource exhausted"
- Triggers retry with exponential backoff
- Creates HIGH priority AI_FAILED action for manual review
- Throws to trigger Inngest retry mechanism

**4. Error Message Sanitization**
- Remove API keys (AIza..., sk-...)
- Remove email addresses
- Remove file paths
- Truncate to 500 chars max
- Prevents info disclosure in audit logs

**5. AI_FAILED Action Creation**
- Triggered for classifications < 60% confidence
- Also triggered on Gemini unavailability
- Priority: NORMAL (standard workflow) or HIGH (service down)
- Metadata includes sanitized error message, confidence, timestamp

### Test Execution

```bash
# Run all tests
pnpm -F @ella/api test

# Watch mode during development
pnpm -F @ella/api test:watch

# Coverage report
pnpm -F @ella/api test:coverage
```

### Mocking Strategy

**Mocked Dependencies:**
- Inngest client + event triggers
- Prisma queries (rawImage, digitalDoc updates)
- R2 storage (fetchImageBuffer)
- Gemini API (classification responses)
- Sharp image processing
- Duplicate detector (pHash + grouping)

**Type-Safe Mocks:**
- Using `vi.mocked()` for full TypeScript support
- Mock setup/teardown in beforeEach/afterEach
- Return realistic test data structures

---

**Last Updated:** 2026-01-15
**Status:** Phase 03 Shared Complete (Data Entry Components) + Phase 06 Complete (Testing + Edge Cases) + Phase 05 Complete (Real-time) + Phase 04 Complete (Review UX)
**Branch:** feature/enhancement
**Architecture Version:** 6.1 (Shared Components + Testing)
**Next Phase:** Phase 07 - Production Hardening & Monitoring
