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

See [phase-1.5-ui-components.md](./phase-1.5-ui-components.md) for detailed UI library docs.

**@ella/db** - Database layer with 13 models, 12 enums, singleton connection pooling.
**@ella/shared** - Validation schemas + TypeScript types via Zod.
**@ella/ui** - 11-component shared library + Phase 03 shared components.

## Core Applications

### @ella/api
**REST API (Hono framework, PORT 3001)** - 42+ endpoints across 8 modules with Zod validation, global error handling, OpenAPI docs.

### @ella/portal
**Client-facing upload portal (React, PORT 5174)** - Passwordless magic link auth, mobile-optimized (max 448px), file validation, real-time progress.

### @ella/workspace
**Staff management dashboard (React, PORT 5173)** - Vietnamese-first UI, Zustand state, 20+ components, real-time polling.

**Pages:**
- `/clients/$clientId` - Client detail (3 tabs: Overview, Documents, Messages)

**Features:**
- 10s polling: active conversation + client detail messages tab
- Copy-to-clipboard workflow (Phase 4.1)
- 3-tab document workflow (Phase 04 Tabs)
- 5s polling: classification updates on Documents tab (real-time status tracking)

See [detailed architecture guide](./system-architecture.md) for full API/data flow docs.

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

**Last Updated:** 2026-01-16
**Status:** Phase 04 Tabs + Phase 03 Shared + Phase 06 Testing + Client Messages Tab + Phase 02 AI Validation + **Document Workflow Bugs Fixed**
**Branch:** feature/enhancement
**Architecture Version:** 6.2.2

For detailed phase documentation, see [PHASE-04-INDEX.md](./PHASE-04-INDEX.md) or [PHASE-06-INDEX.md](./PHASE-06-INDEX.md).
