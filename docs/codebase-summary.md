# Ella - Codebase Summary

**Phase 1.3 Status:** Frontend foundation (workspace) - Tasks 1.3.1-1.3.5 completed (2026-01-13)
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
- `packages/ui/src/lib/utils.ts` - Utility functions (cn for Tailwind merging)
- `packages/ui/src/styles.css` - Global Tailwind styles
- `packages/ui/components.json` - shadcn/ui configuration

**Dependencies:**

- @radix-ui/react-primitive (accessible primitives)
- tailwindcss ^4.0.0
- class-variance-authority (component variants)
- clsx + tailwind-merge (class utilities)

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

**Purpose:** Primary user-facing frontend (React + Vite)

**Technology Stack:**

- React ^19.0.0 (UI framework)
- Vite ^6.0.7 (frontend bundler)
- TanStack Router ^1.94.0 (file-based routing)
- TanStack React Query ^5.64.1 (server state management)
- Tailwind CSS ^4.0.0 (styling)
- TypeScript

**Key Files:**

- `apps/portal/index.html` - HTML entry point
- `apps/portal/src/main.tsx` - React root mount
- `apps/portal/src/styles.css` - Global styles
- `apps/portal/src/routes/__root.tsx` - Root layout/router provider
- `apps/portal/src/routes/index.tsx` - Home page
- `apps/portal/src/routeTree.gen.ts` - Auto-generated route tree
- `apps/portal/vite.config.ts` - Vite + TanStack Router plugin config
- `apps/portal/postcss.config.js` - Tailwind PostCSS pipeline

**Scripts:**

- `pnpm -F @ella/portal dev` - Start dev server (port 5173)
- `pnpm -F @ella/portal build` - Production build
- `pnpm -F @ella/portal preview` - Preview built output
- `pnpm -F @ella/portal type-check` - Type validation

**Architecture:**

- File-based routing convention (src/routes/\*)
- Server state via React Query
- UI components from @ella/ui
- Type safety via @ella/shared

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

## Phase 1.3: Frontend Foundation - Workspace (COMPLETED)

**Date:** 2026-01-13

**Deliverable:** Core workspace UI components, API client, constants, and state management

**Tasks Completed (1.3.1-1.3.5):**

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
   - 180+ lines of TypeScript types covering all API models

3. **Task 1.3.3:** Vietnamese localization constants
   - File: `apps/workspace/src/lib/constants.ts`
   - DOC_TYPE_LABELS (21 document types in Vietnamese)
   - CASE_STATUS_LABELS with colors (7 statuses)
   - CHECKLIST_STATUS_LABELS (5 statuses)
   - ACTION_TYPE_LABELS & colors (6 types)
   - ACTION_PRIORITY_LABELS & colors (4 priorities)
   - TAX_TYPE_LABELS, FILING_STATUS_LABELS, LANGUAGE_LABELS
   - NAV_ITEMS for sidebar (4 main routes)
   - UI_TEXT object with common UI labels

4. **Task 1.3.4:** Zustand UI state management
   - File: `apps/workspace/src/stores/ui-store.ts`
   - Sidebar expanded/collapsed state
   - Client view mode (kanban/list)
   - Global search state
   - Mobile menu state
   - Persisted via Zustand middleware to localStorage

5. **Task 1.3.5:** Core layout components
   - Sidebar component: Logo, nav items, collapse animation, user menu placeholder
   - Header component: Page title, user greeting, action buttons
   - PageContainer component: Content wrapper with responsive padding
   - Error boundary: React error handling with Vietnamese UI

**Infrastructure:**

- Root layout with sidebar + header + outlet pattern
- Dashboard page with mock stats cards, quick actions, recent activity
- Error boundary for graceful error handling
- All Vietnamese labels for Vietnamese-speaking staff
- Responsive design (mobile/tablet/desktop breakpoints)

**Design System Alignment:**

- Mint green (#10B981) as primary color
- Coral orange (#F97316) for accents
- Pill-shaped buttons (rounded-full)
- Consistent spacing (4px base unit)
- Card-based layout with shadows
- Accessible focus states

**Files Added/Modified:**

- `packages/ui/src/styles.css` - Ella design tokens
- `packages/ui/src/components/button.tsx` - Updated button variants
- `apps/workspace/src/lib/api-client.ts` - Type-safe API client
- `apps/workspace/src/lib/constants.ts` - Vietnamese labels & colors
- `apps/workspace/src/stores/ui-store.ts` - Zustand UI store
- `apps/workspace/src/components/layout/sidebar.tsx` - Navigation sidebar
- `apps/workspace/src/components/layout/header.tsx` - Top header
- `apps/workspace/src/components/layout/page-container.tsx` - Content wrapper
- `apps/workspace/src/components/layout/index.ts` - Barrel export
- `apps/workspace/src/components/error-boundary.tsx` - Error handling
- `apps/workspace/src/routes/__root.tsx` - Root layout
- `apps/workspace/src/routes/index.tsx` - Dashboard page

**Pattern Notes:**

- **API Client:** Centralized, type-safe, auto-timeout, error handling
- **Constants:** Organized by domain (docs, cases, actions, etc.)
- **State Management:** Zustand with persistence for UI preferences
- **Components:** Sidebar-header-content layout pattern
- **Localization:** Vietnamese-first (VI/EN support via constants)

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

**Last Updated:** 2026-01-13
**Phase:** 1.3 - Frontend Foundation (Workspace) - Tasks 1.3.1-1.3.5
**Maintained By:** Documentation Manager
