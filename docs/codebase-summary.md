# Ella - Codebase Summary

**Phase 1.5 Status:** Shared UI Components (First Half) - COMPLETED (2026-01-13 19:26)
**Phase 1.4 Status:** Frontend Client Portal (complete) - COMPLETED (2026-01-13)
**Phase 1.3 Status:** Frontend foundation (workspace) - ALL TASKS 1.3.1-1.3.32 COMPLETED (2026-01-13 13:09)
**Phase 1.2 Status:** Backend API endpoints implemented (2026-01-13)
**Phase 1.1 Status:** Database schema design completed (2026-01-12)
**Phase 5 Status:** Verification completed (2026-01-12)
**Phase 4 Status:** Tooling setup completed (2026-01-11)
**Phase 3 Status:** Apps setup completed
**Phase 2 Status:** Packages setup completed

## Project Overview

Ella is a monorepo-based TypeScript/Node.js application using pnpm workspaces and Turbo for task orchestration. It follows modern development practices with type safety, database management via Prisma, and UI components via shadcn/ui.

## Architecture

**Monorepo Structure:**

```
ella/
├── apps/              # Application layer (frontend/backend)
├── packages/          # Shared utilities
│   ├── db/           # Database & Prisma client
│   ├── shared/       # Shared types & schemas
│   └── ui/           # UI components library
└── .claude/          # Claude Code workflows
```

## Phase 2: Packages Setup (COMPLETED)

### Package: @ella/db

**Purpose:** Database layer with Prisma ORM singleton pattern

**Key Files:**

- `packages/db/src/client.ts` - Prisma singleton preventing connection leaks
- `packages/db/src/index.ts` - Exports generated Prisma client
- `packages/db/prisma/schema.prisma` - Complete data model (12 models, 12 enums)
- `packages/db/prisma/seed.ts` - Checklist template seeds (25 records across 3 tax forms)
- `packages/db/package.json` - Exports: prisma client + generated types

**Complete Schema (Phase 1.1):**

**Models (12):**
- Staff (admin/staff/CPA roles)
- Client (name, phone, email, language preference)
- ClientProfile (tax situation questionnaire data)
- TaxCase (per client per tax year, status tracking)
- RawImage (document uploads with AI classification)
- DigitalDoc (extracted/verified documents)
- ChecklistTemplate (tax form requirements)
- ChecklistItem (per-case checklist status)
- Conversation (per-case message threads)
- Message (SMS/portal/system messages)
- MagicLink (passwordless access tokens)
- Action (staff tasks, reminders, verifications)

**Enums (12):**
- TaxCaseStatus, TaxType, DocType, RawImageStatus, DigitalDocStatus, ChecklistItemStatus, ActionType, ActionPriority, MessageChannel, MessageDirection, StaffRole, Language

**Seed Data:**
- FORM_1040: 12 checklist templates (personal tax return)
- FORM_1120S: 7 checklist templates (S-Corp tax return)
- FORM_1065: 6 checklist templates (Partnership tax return)

**Scripts:**

- `pnpm -F @ella/db generate` - Generate Prisma client
- `pnpm -F @ella/db migrate` - Run migrations
- `pnpm -F @ella/db push` - Sync schema with DB
- `pnpm -F @ella/db seed` - Run seed.ts (populate checklist templates)
- `pnpm -F @ella/db studio` - Prisma Studio UI

### Package: @ella/shared

**Purpose:** Shared validation schemas and TypeScript types

**Key Files:**

- `packages/shared/src/schemas/index.ts` - Zod validation schemas
- `packages/shared/src/types/index.ts` - Inferred TypeScript types

**Exports:**

- `@ella/shared` - All types & schemas
- `@ella/shared/schemas` - Zod validators only
- `@ella/shared/types` - TypeScript types only

**Validation Schemas:**

- emailSchema, phoneSchema, uuidSchema (primitives)
- paginationSchema (page, limit with defaults)
- apiResponseSchema (generic success/error wrapper)

**Types:**

- Pagination, ApiResponse<T>, UserId, ClientId, DocumentId

### Package: @ella/ui

**Purpose:** Reusable UI components (shadcn/ui based)

**Key Files:**

- `packages/ui/src/components/button.tsx` - Button component
- `packages/ui/src/components/card.tsx` - Card container components (NEW Phase 1.5)
- `packages/ui/src/components/input.tsx` - Input field with error/hint support (NEW Phase 1.5)
- `packages/ui/src/components/select.tsx` - Select dropdown with field wrapper (NEW Phase 1.5)
- `packages/ui/src/components/badge.tsx` - Badge & StatusBadge for status display (NEW Phase 1.5)
- `packages/ui/src/lib/utils.ts` - Utility functions (cn for Tailwind merging)
- `packages/ui/src/styles.css` - Global Tailwind styles
- `packages/ui/components.json` - shadcn/ui configuration

**Components (Phase 1.5 First Half):**

- **Card Family (card.tsx)**
  - `Card` - Base container with variants (default, elevated, flat, feature) and padding options
  - `CardHeader` - Top section for titles/descriptions
  - `CardTitle` - Semantic heading component
  - `CardDescription` - Secondary text/subtitle
  - `CardContent` - Main content area
  - `CardFooter` - Bottom section for actions

- **Input Family (input.tsx)**
  - `Input` - Base input with variants (default, error, ghost) and sizes (sm, default, lg)
  - `InputField` - Wrapper with label, error, hint support for complete form control
  - Supports all HTML input attributes (type, disabled, placeholder, etc.)

- **Select Family (select.tsx)**
  - `Select` - Native select element with variants (default, error) and sizes
  - `SelectField` - Wrapper with label, error, hint support
  - ChevronDown icon indicator
  - Options prop for array-based option rendering

- **Badge Family (badge.tsx)**
  - `Badge` - Base badge with variants (default, secondary, outline, success, error, warning, accent)
  - Size variants (sm, default, lg)
  - Shape variants (rounded-full, rounded-md)
  - `StatusBadge` - Specialized for document/case status with semantic mapping
  - StatusType enum: missing, has_raw, has_digital, verified, uploaded, classified, linked, blurry, extracted, partial, failed, pending, in_progress, complete

**Dependencies:**

- @radix-ui/react-primitive (accessible primitives)
- tailwindcss ^4.0.0
- class-variance-authority (component variants)
- clsx + tailwind-merge (class utilities)
- lucide-react (icons for Select/Badge)

**Setup:**

- Tailwind v4 configured with neutral baseColor
- Paths alias configured for imports

## Phase 3: Apps Setup (COMPLETED)

### App: @ella/api

**Purpose:** Backend API server (Hono framework)

**Technology Stack:**

- Hono ^4.6.15 (lightweight web framework)
- @hono/node-server (Node.js runtime adapter)
- @hono/zod-openapi (OpenAPI v3 + Zod validation integration)
- @hono/zod-validator (request validation)
- TypeScript, tsx (development)
- tsup (build bundler)

**Key Files:**

- `apps/api/src/index.ts` - Server entry point (PORT 3001)
- `apps/api/src/app.ts` - Main app instance & route wiring
- `apps/api/src/middleware/error-handler.ts` - Global error handling
- `apps/api/src/lib/db.ts` - Prisma client re-export
- `apps/api/src/lib/constants.ts` - Vietnamese labels, pagination helpers
- `apps/api/src/routes/*` - Modular endpoint definitions
- `apps/api/src/services/` - Business logic services
- `apps/api/package.json` - Dependencies & scripts
- `apps/api/tsconfig.json` - TypeScript config extending root

**Scripts:**

- `pnpm -F @ella/api dev` - Start dev server with tsx watch
- `pnpm -F @ella/api build` - Build to dist/ (ESM + types)
- `pnpm -F @ella/api start` - Run built server
- `pnpm -F @ella/api type-check` - Type validation

**API Routes (Phase 1.2):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Server health check |
| `/clients` | GET/POST | List/Create clients |
| `/clients/:id` | GET/PATCH/DELETE | Client CRUD & profile |
| `/cases` | GET/POST | List/Create tax cases |
| `/cases/:id` | GET/PATCH | Case details & update |
| `/cases/:id/checklist` | GET | Dynamic case checklist |
| `/cases/:id/images` | GET | Raw images for case |
| `/cases/:id/docs` | GET | Digital documents |
| `/actions` | GET | Action queue (grouped by priority) |
| `/actions/:id` | GET/PATCH | Action details & update |
| `/docs/:id` | GET | Digital doc details |
| `/docs/:id/classify` | POST | Classify raw image |
| `/docs/:id/ocr` | POST | Trigger OCR extraction |
| `/docs/:id/verify` | PATCH | Verify extracted data |
| `/messages/:caseId` | GET | Case conversation history |
| `/messages/send` | POST | Send message (SMS/portal/system) |
| `/portal/:token` | GET | Magic link portal data |
| `/portal/:token/upload` | POST | Portal document upload |

**Services:**

- `checklist-generator.ts` - Dynamic checklist from templates
- `magic-link.ts` - Passwordless token management
- `storage.ts` - R2 storage service placeholder

**Architecture:**

- Global error handler catches all exceptions
- Zod validation on all requests via @hono/zod-validator
- Pagination helpers for list endpoints (page, limit, maxLimit)
- Vietnamese label constants for enums
- Prisma transactions for multi-step operations
- OpenAPI schema generation at `/doc` endpoint
- CORS enabled for localhost:5173, :5174 (frontend ports)
- Scalar API UI at `/docs` endpoint

### App: @ella/portal

**Purpose:** Passwordless client portal for document upload via magic links (Phase 1.4+)

**Technology Stack:**

- React ^19.0.0 (UI framework)
- Vite ^6.0.7 (frontend bundler)
- TanStack Router ^1.94.0 (file-based routing)
- Tailwind CSS ^4.0.0 (styling)
- TypeScript
- lucide-react (icons)

**Key Features (Phase 1.4 - First Half):**

- Magic link authentication (stateless token-based)
- Mobile-optimized layout (max-width 448px)
- Document upload with camera + gallery support
- Vietnamese/English language toggle
- File validation (JPEG, PNG, PDF, 10MB max)
- Rate limit handling with bilingual messages
- Image preview grid with memory cleanup
- Multipart form upload with progress states

**Directory Structure:**

```
apps/portal/src/
├── lib/
│   ├── api-client.ts      # HTTP client + error handling
│   └── i18n.ts            # VI/EN translations
├── routes/
│   ├── __root.tsx         # Root layout
│   ├── index.tsx          # Home (landing)
│   └── u/
│       ├── $token.tsx     # Magic link landing
│       └── $token/
│           └── upload.tsx # Upload flow
└── components/
    ├── landing/
    │   ├── welcome-header.tsx
    │   └── upload-buttons.tsx
    └── upload/
        └── image-picker.tsx
```

**Key Files:**

- `apps/portal/src/lib/api-client.ts` - Simplified HTTP client (no auth)
- `apps/portal/src/lib/i18n.ts` - 45+ UI text translations
- `apps/portal/src/routes/__root.tsx` - Mobile-first root layout
- `apps/portal/src/routes/u/$token.tsx` - Magic link landing page
- `apps/portal/src/routes/u/$token/upload.tsx` - Upload page with states
- `apps/portal/src/components/upload/image-picker.tsx` - File picker + preview

**Scripts:**

- `pnpm -F @ella/portal dev` - Start dev server (port 5174)
- `pnpm -F @ella/portal build` - Production build
- `pnpm -F @ella/portal preview` - Preview built output
- `pnpm -F @ella/portal type-check` - Type validation

**API Integration:**

- `GET /portal/:token` - Fetch portal data (client, case, checklist, stats)
- `POST /portal/:token/upload` - Upload documents (multipart/form-data)

**Architecture:**

- Stateless (no session storage needed)
- TanStack Router for file-based routing + typed params
- useState for local state (page state, files, errors)
- Memory-safe ObjectURL management in ImagePicker
- Function-based i18n (lighter than Context)
- Bilingual error messages (VI priority)

### App: @ella/workspace

**Purpose:** Secondary frontend workspace (same structure as portal)

**Technology Stack:** Identical to portal (React 19, Vite 6, TanStack Router, React Query)

**Key Difference:** Separate app instance for multi-tenant/workspace-specific UI

### Dir: trigger/

**Purpose:** Job/task orchestration placeholder

**Technology Stack:**

- TypeScript
- tsx (development)

**Key Files:**

- `trigger/src/index.ts` - Placeholder entry point
- `trigger/package.json` - Dependencies & scripts

**Status:** Placeholder for future queue/job system integration

## Dependencies Overview

**Core:**

- TypeScript ^5.7.3
- @prisma/client ^6.7.0
- zod ^3.24.1

**Build & Type Checking:**

- tsx (TypeScript executor)
- Turbo (monorepo orchestration)
- pnpm (package manager)

**UI:**

- shadcn/ui (Radix UI + Tailwind)
- tailwindcss ^4.0.0

## Configuration Files

**Root Level:**

- `tsconfig.json` - Shared TypeScript config
- `turbo.json` - Turbo pipeline & caching
- `pnpm-workspace.yaml` - Workspace definition
- `.npmrc` - pnpm registry & authentication
- `.env.example` - Environment variable template

**Package Level:**

- Each package has own `tsconfig.json` extending root

## Environment Variables

See `.env.example`:

- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` - Authentication
- `API_URL`, `PORTAL_URL`, `WORKSPACE_URL` - Service URLs
- Optional: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `GEMINI_API_KEY`, `UPLOADTHING_TOKEN`, `TRIGGER_SECRET_KEY`

## Development Workflow

**Install Dependencies:**

```bash
pnpm install
```

**Type Check All Packages:**

```bash
pnpm type-check
```

**Database Operations:**

```bash
pnpm -F @ella/db generate  # Generate Prisma client
pnpm -F @ella/db push      # Sync schema to DB
```

**Run Turbo Tasks:**

```bash
turbo run build
turbo run type-check
```

## Phase 4: Tooling (COMPLETED)

### ESLint Setup

**Configuration:**

- **Flat Config:** `eslint.config.js` (root level)
- **Rules:**
  - TypeScript + JS recommended rules via `typescript-eslint`
  - React Hooks linting (react-hooks plugin)
  - React Refresh optimization (react-refresh plugin)
  - Enforce type-only imports
  - Ban unused variables (unless `_` prefixed)
- **Ignored:** dist/, node_modules/, \*.gen.ts, .claude/skills/, generated/

**Scripts:**

- `pnpm lint:root` - Lint root directory
- `turbo lint` - Parallel lint across all packages
- Each package: `npm run lint` → `eslint src/`

### Prettier Setup

**Configuration:**

- **File:** `.prettierrc`
- **Format Style:**
  - No semicolons
  - Single quotes (not double)
  - 2-space indents
  - 100-char line width
  - ES5 trailing commas
- **Ignores:** `.prettierignore` (node_modules, dist, .turbo, .claude, input-docs, \*.gen.ts, generated/)

**Scripts:**

- `pnpm format` - Format all files in place
- `pnpm format:check` - Verify formatting (CI-safe)

### VS Code Configuration

**File:** `.vscode/settings.json`

- Prettier as default formatter
- Format on save enabled
- Auto-fix ESLint issues on save
- TypeScript workspace tsdk configuration

**Recommended Extensions:** `.vscode/extensions.json`

- Prettier (esbenp.prettier-vscode)
- ESLint (dbaeumer.vscode-eslint)
- Tailwind CSS IntelliSense
- Prisma

### Turbo Pipeline Updates

**Changes to turbo.json:**

- Added `lint` task with caching
- Global dependencies: `tsconfig.json`, `eslint.config.js`
- Lint runs in parallel (no dependsOn)
- Output: empty (linting doesn't produce artifacts)

## Phase 1.1: Database Schema Design (COMPLETED)

**Date:** 2026-01-12

**Deliverable:** Complete Prisma schema with tax case management data models

**Key Additions:**

1. **12 Core Models:** Staff, Client, ClientProfile, TaxCase, RawImage, DigitalDoc, ChecklistTemplate, ChecklistItem, Conversation, Message, MagicLink, Action

2. **12 Enums:** Complete enumeration for tax forms, document types, statuses, and roles

3. **Seed Script:** Checklist templates for FORM_1040 (12), FORM_1120S (7), FORM_1065 (6)

4. **Schema Features:**
   - Proper indexing for common queries (status, case ID, type)
   - Unique constraints (client-phone, case-year combination)
   - Cascading deletes for data integrity
   - JSON fields for flexible metadata

5. **Scripts Added:** `seed` script added to package.json for populating initial checklist data

**Files Modified:**
- `packages/db/prisma/schema.prisma` - 402 lines, complete schema
- `packages/db/prisma/seed.ts` - 89 lines, checklist template seeder
- `packages/db/package.json` - Added seed script
- `packages/db/tsconfig.json` - Fixed exclude config
- `packages/db/src/index.ts` - Updated export path

**Next Steps:**
1. Run `pnpm -F @ella/db push` to sync schema with PostgreSQL
2. Run `pnpm -F @ella/db seed` to populate checklist templates
3. Verify schema in `pnpm -F @ella/db studio`
4. Begin Phase 3 API route implementation

## Phase 1.4: Frontend Client Portal (COMPLETED - First Half)

**Date:** 2026-01-13

**Deliverable:** Passwordless client portal with mobile-optimized document upload flow

**Key Features Implemented:**

1. **Magic Link Authentication**
   - Stateless token-based access via `/u/$token` route
   - Token validation on portal data fetch
   - Automatic error handling for invalid/expired tokens
   - No user authentication required

2. **Internationalization (i18n)**
   - File: `apps/portal/src/lib/i18n.ts` (86 LOC)
   - Vietnamese-first (VI) with English (EN) fallback
   - 45+ UI text keys covering complete flow
   - Language detection from client profile
   - `getText(language)` helper for dynamic translations

3. **API Client**
   - File: `apps/portal/src/lib/api-client.ts` (156 LOC)
   - Simplified HTTP client (no authentication headers)
   - `portalApi.getData(token)` - Fetch client/case/checklist data
   - `portalApi.upload(token, files)` - Multipart file upload
   - Rate limit handling (429 status with bilingual messages)
   - Custom `ApiError` class with error codes (RATE_LIMITED, SERVER_ERROR, NETWORK_ERROR)
   - Error messages in Vietnamese by default

4. **Portal Data Types**
   - `PortalClient` - name, language (VI/EN)
   - `PortalTaxCase` - id, taxYear, status
   - `ChecklistDoc` - id, docType, labelVi, status, reason
   - `PortalStats` - uploaded, verified, missing counts
   - `PortalData` - Complete case context (client, case, checklist, stats)

5. **Root Layout**
   - File: `apps/portal/src/routes/__root.tsx` (21 LOC)
   - Mobile-first layout (max-w-lg: 448px)
   - Safe area padding with min-h-dvh
   - Minimal chrome (no header/footer in layout)

6. **Landing Pages**

   - **Home Page** (`apps/portal/src/routes/index.tsx`)
     - Direct access error handling
     - Bilingual instructions (VI/EN)
     - Ella branding with logo

   - **Magic Link Landing** (`apps/portal/src/routes/u/$token.tsx`)
     - Loads and displays client/case context
     - 3 states: loading, success, error
     - Success state shows:
       - WelcomeHeader with client name + tax year
       - Stats badges (verified/missing counts)
       - UploadButtons for upload/status actions
     - Error view with retry button for recoverable errors
     - Invalid link message for expired/bad tokens (no retry)
     - Token passed via TanStack Router params

7. **UI Components**

   - **WelcomeHeader** (`apps/portal/src/components/landing/welcome-header.tsx` - 39 LOC)
     - Ella logo with primary mint color
     - Client greeting (accented name in coral)
     - Tax year badge with primary background
     - Responsive header layout

   - **UploadButtons** (`apps/portal/src/components/landing/upload-buttons.tsx` - 93 LOC)
     - Large primary button: "Gửi tài liệu" (Upload Documents)
     - Outline secondary button: "Xem trạng thái" (View Status)
     - File format/size hints (JPEG, PNG, PDF, 10MB max)
     - 44px min touch targets (mobile-friendly)
     - Divider with "hoặc" (or) separator

   - **ImagePicker** (`apps/portal/src/components/upload/image-picker.tsx` - 271 LOC)
     - Camera capture and gallery file selection
     - Validates file type (image/*, PDF only)
     - Enforces max 10MB per file, 20 files total
     - Grid preview (3 columns) with file thumbnails
     - PDF shown as text badge (not rendered)
     - Memory-safe: useMemo + useEffect for ObjectURL cleanup
     - Remove button per file with hover reveal
     - "Add more" button (dashed border) if under limit
     - Bilingual validation error messages
     - Auto-dismiss errors after 3 seconds

8. **Upload Page** (`apps/portal/src/routes/u/$token/upload.tsx` - 235 LOC)
   - Multi-state flow: loading → select → uploading → success/error
   - Token validation on mount
   - ImagePicker integration for file selection
   - Handles multipart upload via API
   - Success state shows uploaded count + filename count
   - Options: upload more or return to home
   - Error state with retry + back buttons
   - Loading spinners (Loader2 icon)
   - Back button with navigation

**Architecture Patterns:**

- **TanStack Router:** File-based routing with type-safe params (`$token` dynamic segment)
- **React Hooks:** useRef (file inputs), useCallback (memoized handlers), useMemo (URL cleanup)
- **i18n:** Function-based getText() instead of Context (simpler, lighter)
- **Error Handling:** ApiError class with codes + bilingual messages
- **Mobile-first:** Max-width 448px, large touch targets, vertical layouts
- **Memory Management:** ObjectURL cleanup via useEffect return function
- **State Management:** useState for page state + data/files (no external store needed)

**Files Added:**
- `apps/portal/src/lib/api-client.ts` (156 LOC)
- `apps/portal/src/lib/i18n.ts` (90 LOC)
- `apps/portal/src/routes/__root.tsx` (21 LOC)
- `apps/portal/src/routes/index.tsx` (45 LOC)
- `apps/portal/src/routes/u/$token.tsx` (208 LOC)
- `apps/portal/src/routes/u/$token/upload.tsx` (235 LOC)
- `apps/portal/src/components/landing/welcome-header.tsx` (39 LOC)
- `apps/portal/src/components/landing/upload-buttons.tsx` (93 LOC)
- `apps/portal/src/components/upload/image-picker.tsx` (271 LOC)

**Files Modified:**
- None (phase-1.4-frontend-client-portal is new branch)

**Phase 1.4 Second Half (COMPLETED):**

9. **Upload Progress Indicator** (`apps/portal/src/components/upload/upload-progress.tsx` - 98 LOC)
   - Multi-state spinner: uploading, processing, complete
   - Animated circular progress ring with centered upload icon
   - File count display ("X selected files")
   - Pulse animation for progress dots
   - Bilingual status messages
   - Smooth state transitions

10. **Image Preview Grid** (`apps/portal/src/components/upload/image-preview-grid.tsx` - 155 LOC)
    - 3-column responsive grid display
    - Memory-safe ObjectURL management (useMemo + cleanup)
    - Sanitized file names to prevent XSS in display
    - PDF shown as badge (FileText icon + "PDF")
    - Images with lazy loading and object-cover
    - File size display (KB/MB)
    - Remove button per item (-top-1.5, -right-1.5 positioning)
    - Overflow indicator: "+N more" when exceeding maxDisplay (9 default)
    - File info overlay (name) on hover/touch with gradient background
    - Full accessibility: aria-labels, role="list", role="listitem"

11. **Success Screen** (`apps/portal/src/components/upload/success-screen.tsx` - 76 LOC)
    - Animated success icon (zoom-in with CheckCircle2)
    - Bilingual confirmation message + file count
    - Success note box: "Documents being processed..."
    - Two action buttons:
      - Outline: "Upload More" (Upload icon)
      - Primary: "Done" (Home icon)
    - Staggered fade-in animations for each element
    - Mobile-friendly large touch targets (h-14)

12. **Status View Page** (`apps/portal/src/routes/u/$token/status.tsx` - 240 LOC)
    - Document status tracking (received/blurry/missing breakdown)
    - Header: Back button, page title, tax year subtitle, refresh button
    - Summary stat pills: received (primary), needResend (warning), missing (error)
    - Collapsible doc sections:
      - Blurry/Need Resend (priority - always first if any)
      - Missing Docs (prominent with dashed error border)
      - Received Docs (collapsed by default unless all clear)
    - Fixed bottom action button (sticky) when blurry/missing exist
    - Empty state: "No documents yet"
    - Refresh functionality with loading state
    - Bilingual error handling + retry buttons
    - Error state with back navigation

13. **Doc Status Section** (`apps/portal/src/components/status/doc-status-section.tsx` - 141 LOC)
    - Collapsible section header with icon, title, count
    - 4 variants: success (mint), warning (orange), error (red), muted (gray)
    - Expand/collapse animation (ChevronDown rotation)
    - Border + background colors per variant
    - List role with accessibility support
    - Upload CTA button in warning/error sections
    - defaultExpanded prop for conditional expansion

14. **Doc Thumbnail** (`apps/portal/src/components/status/doc-thumbnail.tsx` - 151 LOC)
    - Icon mapping for 20 doc types (W2, 1099s, SSN_CARD, DRIVER_LICENSE, etc.)
    - Status icon indicator (CheckCircle2, AlertTriangle, Clock)
    - Vietnamese labels from ChecklistDoc (fallback to docType)
    - Optional reason display (BLURRY, INCOMPLETE, WRONG_DOC, EXPIRED)
    - Reason translation: VI/EN support with fallback
    - Variant styling: background + icon background colors
    - Compact mobile layout with truncation

15. **Missing Docs List** (`apps/portal/src/components/status/missing-docs-list.tsx` - 99 LOC)
    - Prominent alert styling: dashed border + error/5 background
    - Alert header with AlertCircle icon + document count
    - Missing doc items with FileQuestion icon
    - Upload CTA button with Upload icon
    - Early return if docs.length === 0

16. **Error Boundary** (`apps/portal/src/components/error-boundary.tsx` - 95 LOC)
    - Class component with getDerivedStateFromError lifecycle
    - Fallback UI with error icon, message, and action buttons
    - Reset handler + onReset callback prop
    - Retry and "Reload Page" buttons
    - Vietnamese error messages
    - Alert role with aria-live="assertive" for accessibility
    - Console logging for debugging (in production use error tracking)

**Files Added (Phase 1.4 Second Half):**
- `apps/portal/src/components/upload/upload-progress.tsx` (98 LOC)
- `apps/portal/src/components/upload/image-preview-grid.tsx` (155 LOC)
- `apps/portal/src/components/upload/success-screen.tsx` (76 LOC)
- `apps/portal/src/routes/u/$token/status.tsx` (240 LOC)
- `apps/portal/src/components/status/doc-status-section.tsx` (141 LOC)
- `apps/portal/src/components/status/doc-thumbnail.tsx` (151 LOC)
- `apps/portal/src/components/status/missing-docs-list.tsx` (99 LOC)
- `apps/portal/src/components/error-boundary.tsx` (95 LOC)

**Files Modified (Phase 1.4 Second Half):**
- `apps/portal/src/routes/u/$token.tsx` - Added status navigation handler

**Complete Portal Component Architecture:**

```
apps/portal/src/components/
├── upload/
│   ├── image-picker.tsx (upload file selection)
│   ├── image-preview-grid.tsx (grid display with memory cleanup)
│   ├── upload-progress.tsx (progress states)
│   └── success-screen.tsx (post-upload confirmation)
└── status/
    ├── doc-status-section.tsx (collapsible document groups)
    ├── doc-thumbnail.tsx (individual doc display)
    └── missing-docs-list.tsx (prominent missing section)
```

**Portal Features Summary:**
- Upload flow: file picker → preview → upload progress → success
- Status tracking: categorized sections (received/blurry/missing)
- Mobile-optimized: max-width 448px, large touch targets, vertical layouts
- Internationalization: VI-first with EN fallback
- Accessibility: ARIA labels, roles, error alerts
- Security: XSS sanitization (file names), type validation
- Performance: React.memo optimization, ObjectURL cleanup
- Error handling: API errors, network errors, invalid tokens

---

## Phase 1.3: Frontend Foundation - Workspace (COMPLETED)

**Date:** 2026-01-13

**Deliverable:** Complete workspace UI with dashboard, actions page, client management, and core components

**Tasks Completed (1.3.1-1.3.15):**

1. **Task 1.3.1:** Update @ella/ui design tokens & Button component
   - Added mint green design system via `packages/ui/src/styles.css`
   - Tailwind v4 theme configuration with semantic colors
   - Dark mode support
   - Updated Button component with pill-shaped variants (default, destructive, outline, secondary, ghost, link)
   - Button sizes: sm, default, lg, icon

2. **Task 1.3.2:** Create type-safe API client
   - File: `apps/workspace/src/lib/api-client.ts`
   - Centralized HTTP client with auto-timeout handling (30s default)
   - ApiError class for consistent error handling
   - Generic request wrapper with abort controller
   - Organized endpoints: clients, cases, actions, messages
   - Type-safe request/response handling
   - Paginated response types built-in

3. **Task 1.3.3:** Vietnamese localization constants
   - File: `apps/workspace/src/lib/constants.ts`
   - DOC_TYPE_LABELS (21 document types), CASE_STATUS_LABELS (7), CHECKLIST_STATUS_LABELS (5)
   - ACTION_TYPE_LABELS (6 types), ACTION_PRIORITY_LABELS (4 priorities) with colors
   - TAX_TYPE_LABELS, FILING_STATUS_LABELS, LANGUAGE_LABELS
   - NAV_ITEMS sidebar navigation (4 routes)
   - UI_TEXT object with dashboard, quick actions, clients, actions, form, kanban, and error labels

4. **Task 1.3.4:** Zustand UI state management
   - File: `apps/workspace/src/stores/ui-store.ts`
   - Sidebar expanded/collapsed state, client view mode (kanban/list)
   - Global search state, mobile menu state
   - Persisted to localStorage via Zustand middleware

5. **Task 1.3.5:** Core layout components
   - Sidebar: Logo, nav items, collapse animation, user menu
   - Header: Page title, user greeting, action buttons
   - PageContainer: Content wrapper with responsive padding
   - Error boundary: React error handling with Vietnamese UI

6. **Task 1.3.6-1.3.10:** Dashboard and Actions Page Components
   - **TodaySummary Component** (`apps/workspace/src/components/dashboard/today-summary.tsx`)
     - Personalized greeting with staff name
     - Current date in Vietnamese format
     - Responsive header with calendar icon

   - **StatsOverview Component** (`apps/workspace/src/components/dashboard/stats-overview.tsx`)
     - 4 stat cards: Pending Actions, New Clients, Docs Received, Blurry Docs
     - Color-coded icons (primary, accent, success, warning)
     - Optional navigation links (to /actions, /clients, etc.)
     - Loading skeleton support
     - Responsive grid (1→2→4 columns)

   - **QuickActions Component** (`apps/workspace/src/components/dashboard/quick-actions.tsx`)
     - 4 action shortcuts: Add Client, View Actions, Verify Docs, Handle Blurry
     - Card-based layout with icon & hover effects
     - Quick navigation to common staff tasks

   - **ActionCard Component** (`apps/workspace/src/components/actions/action-card.tsx`)
     - Full & compact variants for different contexts
     - Displays action type, priority, title, client name, description
     - Relative time formatting in Vietnamese
     - Priority-based border styling (URGENT=red, HIGH=orange)
     - Type-based icon color mapping (6 action types)
     - Complete & view detail action buttons
     - Links to case detail page (`/cases/:caseId/verify`)

   - **Actions Page** (`apps/workspace/src/routes/actions/index.tsx`)
     - Filter by type & priority with chip interface
     - Grouped by priority (URGENT→HIGH→NORMAL→LOW)
     - Empty state with icon when no actions
     - Mock data (6 sample actions in Vietnamese)
     - Header with refresh button & action count
     - TODO: Replace with API call using useSuspenseQuery

**Refactored Dashboard Page** (`apps/workspace/src/routes/index.tsx`)
   - Now uses new components: TodaySummary, StatsOverview, QuickActions
   - Mock stats (12 pending, 3 new clients, 28 docs, 2 blurry)
   - Recent Activity section placeholder
   - Ready for API integration

7. **Task 1.3.11-1.3.15:** Client Management Components

   - **Formatter Utilities** (`apps/workspace/src/lib/formatters.ts`)
     - `formatPhone(phone)` - Format to US format: (xxx) xxx-xxxx
     - `getInitials(name)` - Extract first + last name initials
     - `getRelativeTimeVi(date)` - Vietnamese relative time (e.g., "5 phút trước")
     - `copyToClipboard(text)` - Safe clipboard write with fallback
     - `formatCurrency(amount)` - Vietnamese VND formatting
     - `formatDateVi(date, options)` - Vietnamese date locale

   - **Client Card Component** (`apps/workspace/src/components/clients/client-card.tsx`)
     - Main variant: Shows name, phone, tax year, latest case status
     - Status badge with dynamic color styling via `CASE_STATUS_COLORS`
     - Compact variant: Avatar with initials, minimal layout for lists
     - Skeleton loader for loading states
     - Auto-links to `/clients/$clientId` detail page

   - **Kanban Board Component** (`apps/workspace/src/components/clients/kanban-board.tsx`)
     - Visual status-based client management (7 columns)
     - Column order: INTAKE → WAITING_DOCS → IN_PROGRESS → READY_FOR_ENTRY → ENTRY_COMPLETE → REVIEW → FILED
     - O(n) grouping performance via `useMemo`
     - Dynamic column headers with client count badges
     - Empty state per column with icon
     - Responsive horizontal scroll on mobile
     - Skeleton loader with varied column fills

   - **Client List Table Component** (`apps/workspace/src/components/clients/client-list-table.tsx`)
     - Sortable table view with 7 columns
     - Responsive: hidden columns on smaller screens (Language hidden <md, TaxTypes hidden <lg)
     - Client avatar + name, phone, language, tax year, tax types, status
     - Color-coded status badges
     - Row click navigation to detail page
     - Empty state when no clients
     - Skeleton loader support

   - **Client List Page** (`apps/workspace/src/routes/clients/index.tsx`)
     - View mode toggle: Kanban ↔ Table (via `useClientViewState`)
     - Search by client name or phone
     - Status filter with CASE_STATUS_LABELS
     - Refresh button
     - Real-time filter/search updates
     - Mock data: 6 Vietnamese clients across all statuses
     - TODO: Replace with `useSuspenseQuery` API call

   - **Client Detail Page** (`apps/workspace/src/routes/clients/$clientId.tsx`)
     - TanStack Router typed params with `parseParams`
     - 3-tab interface: Overview, Documents, Messages
     - Overview tab shows:
       - Client header with avatar, name, phone, email, created date
       - Filing status, dependents, employment/business info
       - Tax case details with checklist status
     - Copy-to-clipboard for phone/email
     - Mock data structure ready for API integration
     - Responsive layout

**Component Architecture:**
   - Barrel exports organize components (`dashboard/index.ts`, `actions/index.ts`, `clients/index.ts`)
   - Consistent color system: primary (mint), accent (coral), success, warning, error
   - Type-safe props using TypeScript interfaces
   - Responsive grid layouts (mobile-first design)
   - Accessible icon labeling with aria-hidden
   - DRY principle: Shared formatters in `lib/formatters.ts`
   - Vietnamese-first: All UI text via `UI_TEXT` constants
   - TanStack Router: Type-safe route params with `parseParams`
   - Zustand: Client view state persisted to localStorage
   - Performance: O(n) Kanban grouping, proper `useMemo` usage

**Files Added:**
- `apps/workspace/src/components/dashboard/today-summary.tsx`
- `apps/workspace/src/components/dashboard/stats-overview.tsx`
- `apps/workspace/src/components/dashboard/quick-actions.tsx`
- `apps/workspace/src/components/dashboard/index.ts`
- `apps/workspace/src/components/actions/action-card.tsx`
- `apps/workspace/src/components/actions/index.ts`
- `apps/workspace/src/components/clients/client-card.tsx`
- `apps/workspace/src/components/clients/kanban-board.tsx`
- `apps/workspace/src/components/clients/client-list-table.tsx`
- `apps/workspace/src/components/clients/index.ts`
- `apps/workspace/src/routes/actions/index.tsx`
- `apps/workspace/src/routes/clients/index.tsx`
- `apps/workspace/src/routes/clients/$clientId.tsx`
- `apps/workspace/src/lib/formatters.ts`

**Files Modified:**
- `apps/workspace/src/routes/index.tsx` - Refactored to use new dashboard components
- `apps/workspace/src/lib/constants.ts` - Added ACTION_TYPE_COLORS, ACTION_PRIORITY_COLORS, kanban labels

**Pattern Notes:**

- **Dashboard:** Composition pattern with reusable stat/action cards
- **Client Management:** Dual-view pattern (Kanban + Table) with shared data
- **Localization:** Vietnamese-first with all UI text in constants
- **Components:** Self-contained, type-safe, accessible with proper ARIA labels
- **Responsive:** Mobile-first approach with responsive grids and hidden elements
- **State:** Ready for API integration via React Query (TODO comments in place)
- **Type Safety:** Full TypeScript types for Client, ClientDetail, TaxCaseStatus, etc.

**Task 1.3.16-1.3.20: Case Management Components & Create Client Page**

   - **Checklist Grid Component** (`apps/workspace/src/components/cases/checklist-grid.tsx`)
     - Visual card-based checklist display for case document requirements
     - Status icons: VERIFIED (check), HAS_DIGITAL (file), HAS_RAW (image), MISSING (alert)
     - Progress circle with completion % and real-time stats (verified/extracted/received/missing)
     - Hover-triggered verify button for actionable items
     - Responsive grid (1→2→3→4 columns)
     - ChecklistGridSkeleton for loading states
     - Type-safe ChecklistItem[] with optional callbacks

   - **Raw Image Gallery Component** (`apps/workspace/src/components/cases/raw-image-gallery.tsx`)
     - Thumbnail gallery with status badges (UPLOADED, CLASSIFIED, LINKED, BLURRY, UNCLASSIFIED)
     - Status filter pills showing count per status
     - Modal viewer with zoom (0.5-3x), rotate 90°, keyboard shortcuts (ESC, +/-, R, 0)
     - Image info display and classify action for unclassified items
     - Keyboard focus trap and body scroll prevention
     - R2 placeholder URLs (TODO: signed URLs in Phase INF.4)
     - Responsive grid (2→3→4→5 columns)
     - RawImageGallerySkeleton with loading state

   - **Digital Doc Table Component** (`apps/workspace/src/components/cases/digital-doc-table.tsx`)
     - Table view of extracted OCR documents (Type, Status, Updated Date, Actions)
     - Expandable rows showing extracted data with copy-to-clipboard
     - Status badges (EXTRACTED, VERIFIED, PARTIAL, FAILED) with icons
     - Field mappings: W2, SSN_CARD, DRIVER_LICENSE, 1099_INT, 1099_NEC, 1099_DIV, BANK_STATEMENT
     - XSS sanitization of OCR data (blocks tags, handlers, protocols)
     - Currency formatting ($X,XXX) for numeric fields
     - Copy feedback (Check icon, 2s timeout)
     - Responsive: full on md+, compact mobile
     - DigitalDocTableSkeleton for loading

   - **Cases Components Export** (`apps/workspace/src/components/cases/index.ts`)
     - Barrel exports: ChecklistGrid, RawImageGallery, DigitalDocTable + skeletons

   - **Intake Questions Form** (`apps/workspace/src/components/clients/intake-questions-form.tsx`)
     - Dynamic conditional questionnaire for tax profile
     - Sections: Tax Info → Income Sources → Dependents → Business (if applicable)
     - Tax year selector (2025, 2024, 2023), tax type multi-select, filing status dropdown
     - Income toggles: W2, Bank Account, Investments, Self-Employment, Rental
     - Dependent section with conditional nested questions (kids <17 count/daycare, kids 17-24)
     - Business section (conditional): name, EIN, employees, contractors, 1099-K processing
     - Hint text with HelpCircle icons for credit/benefit explanations
     - IntakeFormData interface with validation, getDefaultIntakeFormData() helper

   - **Create Client Page** (`apps/workspace/src/routes/clients/new.tsx`)
     - Multi-step form: Step 1 (Basic Info) → Step 2 (Tax Profile)
     - Step indicator with progress (pending/active/✓ completed)
     - BasicInfoForm: name (min 2 chars), phone (US 10-digit validation), email (optional), language
     - Phone validation: no leading 0/1 in area code, formatted display
     - IntakeQuestionsForm for tax profile details
     - Submit via `api.clients.create()` with profile data
     - Redirect to `/clients/$clientId` on success
     - Error messaging and loading state (Loader2 spinner)
     - Validation gates per step with back/continue navigation

   - **Client Detail Integration** (`apps/workspace/src/routes/clients/$clientId.tsx`)
     - Integrated case components in Documents tab
     - Imports from @ella/workspace/components/cases barrel
     - Mock data with full checklist/raw image/digital doc structure

**Files Added (Tasks 1.3.16-1.3.20):**
- `apps/workspace/src/components/cases/checklist-grid.tsx` (292 LOC)
- `apps/workspace/src/components/cases/raw-image-gallery.tsx` (435 LOC)
- `apps/workspace/src/components/cases/digital-doc-table.tsx` (402 LOC)
- `apps/workspace/src/components/cases/index.ts` (8 LOC)
- `apps/workspace/src/components/clients/intake-questions-form.tsx` (413 LOC)
- `apps/workspace/src/routes/clients/new.tsx` (434 LOC)

**Files Modified (Tasks 1.3.16-1.3.20):**
- `apps/workspace/src/routes/clients/$clientId.tsx` - Integrated case components
- `apps/workspace/src/components/clients/index.ts` - Added intake form exports

## Phase 1.2: Backend API Endpoints (COMPLETED)

**Date:** 2026-01-13

**Deliverable:** Complete REST API with 7 route modules, services, and error handling

**API Endpoints Implemented:**

1. **Clients Management** (5 endpoints)
   - `GET /clients` - List clients with search/status filters
   - `POST /clients` - Create client + profile + tax case + magic link + checklist
   - `GET /clients/:id` - Get client with profile & tax cases
   - `PATCH /clients/:id` - Update client details
   - `DELETE /clients/:id` - Delete client

2. **Tax Cases** (6 endpoints)
   - `GET /cases` - List cases with status/year/client filters
   - `POST /cases` - Create new tax case
   - `GET /cases/:id` - Get case details with document counts
   - `PATCH /cases/:id` - Update case status/metadata
   - `GET /cases/:id/checklist` - Dynamic checklist based on profile
   - `GET /cases/:id/images` - Raw images for case

3. **Digital Documents** (6 endpoints)
   - `GET /cases/:id/docs` - Case digital documents
   - `GET /docs/:id` - Document details with extraction
   - `POST /docs/:id/classify` - AI classify raw image
   - `POST /docs/:id/ocr` - Trigger OCR extraction
   - `PATCH /docs/:id/verify` - Verify & approve extracted data

4. **Actions/Queue** (2 endpoints)
   - `GET /actions` - Action queue grouped by priority (URGENT/HIGH/NORMAL/LOW)
   - `GET/PATCH /actions/:id` - Action details & completion

5. **Messages/Conversations** (2 endpoints)
   - `GET /messages/:caseId` - Case conversation history
   - `POST /messages/send` - Send SMS/portal/system message

6. **Magic Link Portal** (2 endpoints)
   - `GET /portal/:token` - Verify token, return case data for client
   - `POST /portal/:token/upload` - Client document upload to case

7. **Health Check** (1 endpoint)
   - `GET /health` - Server status

**Services Implemented:**

- `checklist-generator.ts` - Generate checklist from profile & templates
- `magic-link.ts` - Create/validate passwordless tokens
- `storage.ts` - R2 storage service placeholder

**Infrastructure:**

- Global error handler middleware
- Zod validation on all inputs
- Pagination helpers (page, limit, maxLimit=100)
- Vietnamese label constants
- Prisma transactions for data consistency
- OpenAPI documentation at `/doc`
- Scalar API UI at `/docs`
- CORS configured for frontend (localhost:5173, :5174)

**Files Added:**
- `apps/api/src/middleware/error-handler.ts`
- `apps/api/src/lib/db.ts`, `lib/constants.ts`
- `apps/api/src/routes/clients/index.ts`, `schemas.ts`
- `apps/api/src/routes/cases/index.ts`, `schemas.ts`
- `apps/api/src/routes/actions/index.ts`, `schemas.ts`
- `apps/api/src/routes/docs/index.ts`, `schemas.ts`
- `apps/api/src/routes/messages/index.ts`, `schemas.ts`
- `apps/api/src/routes/portal/index.ts`, `schemas.ts`
- `apps/api/src/services/checklist-generator.ts`
- `apps/api/src/services/magic-link.ts`
- `apps/api/src/services/storage.ts`

**Files Modified:**
- `apps/api/src/app.ts` - Wired all routes, added OpenAPI/Scalar docs
- `apps/api/src/index.ts` - Main server entry

## Phase 5: Verification (COMPLETED)

**Date:** 2026-01-12

**Verification Completed:**

1. **Development Servers:** All apps (portal, workspace, api) verified working
2. **ESLint:** Added `**/generated/**` to ignore patterns (auto-generated Prisma files)
3. **Prettier:** Updated `.prettierignore` to exclude `.claude` and `input-docs` directories
4. **Environment Variables:** Updated `.env.example` with complete variable set including Clerk auth, service URLs, and optional integrations
5. **CI/CD Verification:** All linting and formatting pipelines pass

**Next Phase Planning:**

- Frontend component development & API integration
- Authentication & authorization system (Clerk integration)
- Testing infrastructure setup
- Advanced features (AI classification, notifications)

## File Statistics

**Total Files:** 36
**Total Tokens:** 108,034
**Total Characters:** 308,359

**Top Content Files:**

1. release-manifest.json (79,953 tokens - auto-generated)
2. System architecture docs (11,929 tokens)
3. UI wireframe specs (2,627 tokens)
4. Product requirements (2,055 tokens)

## Key Decisions

1. **Prisma Singleton Pattern** - Prevents connection pool exhaustion in development
2. **Zod Validation** - Runtime type safety for APIs
3. **shadcn/ui Components** - Copy-paste component library with Tailwind
4. **Monorepo Structure** - Shared code via workspace packages
5. **PostgreSQL** - Production-grade relational database

## Next Steps for Users

1. Configure `.env` file with `DATABASE_URL`
2. Run `pnpm -F @ella/db generate` to create Prisma client
3. Create initial migrations via `pnpm -F @ella/db migrate`
4. Begin apps layer development (frontend/backend)

---

**Task 1.3.21-1.3.25: Document Verification & Data Entry (COMPLETED)**

   - **DocVerificationModal Component** (`apps/workspace/src/components/verification/doc-verification-modal.tsx`)
     - Modal for verifying/reclassifying raw document images
     - Keyboard shortcuts: ESC (close), +/- (zoom 0.5-3x), R (rotate 90°), ← → (navigate), 0 (reset)
     - Image viewer with zoom/rotate controls and navigation arrows
     - Common doc types selection (11 types: W2, SSN_CARD, DRIVER_LICENSE, 1099_*, BANK_STATEMENT, BIRTH_CERTIFICATE, DAYCARE_RECEIPT, OTHER)
     - Blurry image detection with "Request Resend" action
     - OCR data preview (first 5 fields) from linked DigitalDoc
     - Reject reason textarea for non-blurry docs
     - Status tracking: pending → verified/rejected → auto-navigate on success
     - Images navigation via prev/next buttons or arrow keys

   - **OCRVerificationPanel Component** (`apps/workspace/src/components/verification/ocr-verification-panel.tsx`)
     - Right-slide panel for OCR field editing & verification
     - Displays extracted data with field configs per doc type (W2, SSN_CARD, DRIVER_LICENSE, 1099_*, BANK_STATEMENT)
     - Inline field editing with FieldEditForm component
     - Copy-to-clipboard for each field with feedback (2s timeout)
     - Show more/less toggle for fields (first 8 visible by default)
     - Display value formatter: dates (vi-VN locale), numbers ($X,XXX if ≥100)
     - Save/verify buttons; unsaved changes detection
     - Linked rawImage preview with "View Image" button
     - Status display: EXTRACTED (pending), VERIFIED, PARTIAL (missing data), FAILED (OCR error)

   - **FieldEditForm & FieldCopyRow** (`apps/workspace/src/components/verification/field-edit-form.tsx`)
     - FieldEditForm: Inline editing for text/number/date types
     - Type icons (DollarSign for numbers, Calendar for dates), input type validation
     - Enter to save, ESC to cancel; saves converted values (numbers as floats, dates as ISO strings)
     - FieldCopyRow: Compact single-row display with hover copy button (shows "Đã copy" on success)
     - Data entry optimized: quick copy for OltPro workflow

   - **DocTabs & DocTabsSidebar Components** (`apps/workspace/src/components/data-entry/doc-tabs.tsx`)
     - DocTabs: Horizontal tab navigation showing doc type, status (icon badge), field count, copy progress
     - DocTabsSidebar: Vertical sidebar tabs with numbered badges, status icons, copy progress indicator
     - Progress bar: fills as fields are copied (0-100%)
     - Complete badge (green checkmark) when all fields copied
     - Status colors: EXTRACTED (primary/clock), VERIFIED (success/check), PARTIAL (warning), FAILED (error)

   - **OriginalImageViewer Component** (`apps/workspace/src/components/data-entry/original-image-viewer.tsx`)
     - Expandable image viewer for data entry mode
     - Fixed size (h-64) or expanded (inset-4 z-50 fixed)
     - Keyboard controls: +/- (zoom), R (rotate), 0 (reset), F (toggle expand)
     - Image display with placeholder for missing images
     - Zoom range: 0.5-3x with display percentage
     - Rotation: 0/90/180/270 degrees
     - ImagePreview: Compact 4:3 aspect preview button for tight layouts

   - **Data Entry Page** (`apps/workspace/src/routes/cases/$caseId/entry.tsx`)
     - Split-pane layout: left sidebar (docs), center (image viewer), right (data fields)
     - Header shows client name, tax year, case status badge
     - Copy progress: "Đã copy: X/Y tài liệu" with progress bar
     - Keyboard hints toggle (Keyboard icon)
     - Complete button appears when all docs fully copied → redirects to client detail
     - Left panel: DocTabsSidebar with copy progress tracking per doc
     - Center: OriginalImageViewer with F key for fullscreen toggle
     - Right panel: FieldCopyRow list for active doc (fields ordered for OltPro entry)
     - Navigation: Prev/Next buttons between docs or arrow keys
     - Field config per doc type optimizes copy order (EIN first for W2, SSN first for SSN_CARD)

   - **Verification Components Export** (`apps/workspace/src/components/verification/index.ts`)
     - Barrel exports: DocVerificationModal, OCRVerificationPanel, FieldEditForm, FieldCopyRow

   - **Data Entry Components Export** (`apps/workspace/src/components/data-entry/index.ts`)
     - Barrel exports: DocTabs, DocTabsSidebar, OriginalImageViewer, ImagePreview

**Files Added (Tasks 1.3.21-1.3.25):**
- `apps/workspace/src/components/verification/doc-verification-modal.tsx` (459 LOC)
- `apps/workspace/src/components/verification/ocr-verification-panel.tsx` (392 LOC)
- `apps/workspace/src/components/verification/field-edit-form.tsx` (310 LOC)
- `apps/workspace/src/components/verification/index.ts` (14 LOC)
- `apps/workspace/src/components/data-entry/doc-tabs.tsx` (208 LOC)
- `apps/workspace/src/components/data-entry/original-image-viewer.tsx` (259 LOC)
- `apps/workspace/src/components/data-entry/index.ts` (11 LOC)
- `apps/workspace/src/routes/cases/$caseId/entry.tsx` (423 LOC)

**Verification System Features:**
- Two-stage verification: image classification → OCR field editing
- Keyboard-first design for fast staff workflows
- Vietnamese-language all UI text
- Copy-to-clipboard workflow for OltPro integration
- Image zoom/rotate for quality verification
- Blurry document detection with manual resend request
- Field-level inline editing with type validation
- Progress tracking: copy completion per document

**Task 1.3.26-1.3.32: Messaging Components (COMPLETED)**

   - **Message Thread Component** (`apps/workspace/src/components/messaging/message-thread.tsx`)
     - Displays conversation thread for case messaging
     - Supports SMS, portal, and system messages
     - Message grouping by date with Vietnamese locale
     - Auto-scroll to latest message on mount
     - Loading skeleton for message fetching
     - Responsive layout with message attribution

   - **Message Bubble Component** (`apps/workspace/src/components/messaging/message-bubble.tsx`)
     - Renders individual messages with direction (sent/received)
     - Message types: SMS, portal, system
     - Timestamp display in Vietnamese relative format
     - User avatar with initials for received messages
     - Responsive text wrapping with max-width handling
     - Status indicators (pending, sent, failed)

   - **Quick Actions Bar Component** (`apps/workspace/src/components/messaging/quick-actions-bar.tsx`)
     - Template-based quick response buttons
     - Categories: Greeting, Status Update, Missing Docs, Reminder, Complete
     - One-click send with template picker modal trigger
     - Button styling with icons and Vietnamese labels
     - Integrates with Template Picker for selection

   - **Template Picker Modal** (`apps/workspace/src/components/messaging/template-picker.tsx`)
     - Modal for selecting/customizing message templates
     - Organized by category with description preview
     - Template list with copy-to-clipboard functionality
     - Custom message textarea for manual composition
     - Send button with loading state
     - Vietnamese template content (greeting, status, reminder types)

   - **Messaging Page** (`apps/workspace/src/routes/cases/$caseId/messages.tsx`)
     - Full messaging interface for case communication
     - Message thread display with case context
     - Header with client name, case year, phone number
     - Message input field with template support
     - Quick Actions Bar for fast responses
     - Type-safe route parameters via TanStack Router

   - **Messaging Export** (`apps/workspace/src/components/messaging/index.ts`)
     - Barrel export for all messaging components

   - **Sanitization Utilities** (`apps/workspace/src/lib/formatters.ts`)
     - `sanitizeHtml()` function for XSS protection in messages
     - Blocks script tags, event handlers, and dangerous protocols
     - Safe rendering of user-submitted message content

**Files Added (Tasks 1.3.26-1.3.32):**
- `apps/workspace/src/components/messaging/message-thread.tsx` (185 LOC)
- `apps/workspace/src/components/messaging/message-bubble.tsx` (142 LOC)
- `apps/workspace/src/components/messaging/quick-actions-bar.tsx` (120 LOC)
- `apps/workspace/src/components/messaging/template-picker.tsx` (195 LOC)
- `apps/workspace/src/routes/cases/$caseId/messages.tsx` (178 LOC)
- `apps/workspace/src/components/messaging/index.ts` (8 LOC)

**Files Modified (Tasks 1.3.26-1.3.32):**
- `apps/workspace/src/lib/formatters.ts` - Added sanitizeHtml utility

## Phase 1.5: Shared UI Components (COMPLETED - First Half)

**Date:** 2026-01-13

**Deliverable:** Foundational shared UI component library for forms, containers, and status displays

**Components Implemented (Phase 1.5 First Half):**

1. **Card Component** (`packages/ui/src/components/card.tsx` - 80 LOC)
   - Base `Card` component with CVA variants (default, elevated, flat, feature)
   - Padding variants (none, sm, default, lg)
   - Semantic sub-components: CardHeader, CardTitle, CardDescription, CardContent, CardFooter
   - Default: rounded-xl border shadow-sm
   - All components are forwardRefs for proper DOM access
   - Used as container for content sections across workspace & portal

2. **Input Component** (`packages/ui/src/components/input.tsx` - 75 LOC)
   - Base `Input` with CVA variants (default, error, ghost)
   - Size variants (sm: h-8, default: h-10, lg: h-12)
   - Focus states with ring-2 for accessibility
   - Error variant for validation display (red border/ring)
   - Ghost variant for borderless inputs
   - `InputField` wrapper component with:
     - Label support with htmlFor linking
     - Error message display (red text)
     - Hint text for guidance (muted foreground)
     - Auto-variant switching (error state when error provided)
   - Supports all standard HTML input attributes

3. **Select Component** (`packages/ui/src/components/select.tsx` - 92 LOC)
   - Base `Select` with CVA variants (default, error)
   - Size variants (sm: h-8, default: h-10, lg: h-12)
   - ChevronDown icon indicator (positioned absolutely, pointer-events-none)
   - Option mapping via array or children
   - Placeholder support (disabled first option)
   - `SelectField` wrapper with:
     - Label support with htmlFor linking
     - Error message display
     - Hint text support
     - Auto-variant switching on error
   - Native select element (no complex dropdown library)

4. **Badge Component** (`packages/ui/src/components/badge.tsx` - 97 LOC)
   - Base `Badge` with 7 variants (default, secondary, outline, success, error, warning, accent)
   - Size variants (sm: text-[10px], default: text-xs, lg: text-sm)
   - Shape variants (rounded-full default, rounded-md square)
   - Inline-flex for semantic spacing
   - `StatusBadge` specialized component with automatic variant mapping
   - StatusType enum (13 types):
     - missing, has_raw, has_digital, verified (data states)
     - uploaded, classified, linked, extracted (process states)
     - blurry, partial, failed (error/quality states)
     - pending, in_progress, complete (progress states)
   - Status mapping:
     - verified/complete → success (green)
     - missing/blurry/failed → error (red)
     - partial/has_raw/in_progress → warning (orange)
     - has_digital/uploaded/classified/extracted/linked/pending → secondary (gray)

**Architecture Notes:**

- **Component Pattern:** Each component family (Card, Input, Select, Badge) has:
  - Base component with CVA variants for customization
  - Optional wrapper component (InputField, SelectField, StatusBadge) for complete form control
  - ForwardRef for proper DOM element access
  - TypeScript interfaces extending HTML attributes
  - displayName for debugging in React DevTools

- **Variants via CVA:** All sizing/styling via class-variance-authority for:
  - Type safety
  - Clean component props
  - Easy variant extension
  - Zero runtime overhead

- **Accessibility:**
  - Label components with htmlFor linking
  - Semantic HTML (Input, Select use native elements)
  - Focus states with visible rings (focus:ring-2)
  - Error states clearly marked (red border + text)

- **Design System:**
  - Colors from Tailwind theme: primary (mint), error (red), warning (orange), muted-foreground (gray)
  - Consistent padding/sizing across components
  - Smooth transitions (duration-200)
  - Touch-friendly sizes (min h-8, typically h-10)

**Files Added (Phase 1.5 First Half):**
- `packages/ui/src/components/card.tsx` (80 LOC)
- `packages/ui/src/components/input.tsx` (75 LOC)
- `packages/ui/src/components/select.tsx` (92 LOC)
- `packages/ui/src/components/badge.tsx` (97 LOC)

**Files Modified (Phase 1.5 First Half):**
- `packages/ui/src/index.ts` - Added exports for new components

**Component Export Structure:**

```
packages/ui/src/index.ts exports:

// Card
export { Card, cardVariants, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }

// Input
export { Input, inputVariants, InputField, type InputProps, type InputFieldProps }

// Select
export { Select, selectVariants, SelectField, type SelectProps, type SelectFieldProps }

// Badge
export { Badge, badgeVariants, StatusBadge, type BadgeProps, type StatusBadgeProps, type StatusType }
```

**Usage Patterns:**

All components follow consistent patterns:
1. Base component for flexibility: `<Input />`, `<Select />`, `<Card />`
2. Field wrapper for forms: `<InputField label="Name" error={error} hint="First and last" />`
3. CVA variants for styling: `<Badge variant="success" size="lg" />`
4. StatusBadge for automatic status styling: `<StatusBadge status="verified" />`

**Integration Notes:**

These components serve as foundation for:
- Workspace forms (client creation, case management)
- Portal document upload flow
- All data entry interfaces requiring user input
- Status displays and progress indicators

---

**Last Updated:** 2026-01-13 19:26
**Phase:** 1.5 - Shared UI Components (First Half) - COMPLETED
**Maintained By:** Documentation Manager
