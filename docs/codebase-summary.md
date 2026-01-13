# Ella - Codebase Summary (Quick Reference)

**Current Date:** 2026-01-13
**Current Branch:** feature/phase-1.5-shared-ui-components

## Project Status Overview

| Phase | Status | Completed |
|-------|--------|-----------|
| Phase 5 | Verification | 2026-01-12 |
| Phase 4 | Tooling (ESLint, Prettier) | 2026-01-11 |
| Phase 3 | Apps Setup (API, Portal, Workspace) | Complete |
| Phase 2 | Packages Setup (DB, Shared, UI) | Complete |
| Phase 1.5 | Shared UI Components | **2026-01-13** |
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

- 12 models: Staff, Client, ClientProfile, TaxCase, RawImage, DigitalDoc, ChecklistTemplate, ChecklistItem, Conversation, Message, MagicLink, Action
- 12 enums for tax types, statuses, roles
- Singleton pattern for connection pooling
- Seed data: 25 checklist templates across 3 tax forms

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
**11-component shared library**

See detailed docs: [phase-1.5-ui-components.md](./phase-1.5-ui-components.md)

**Components:**
- Base: Button, Card, Input, Select, Badge, Modal, Tabs, Avatar, Progress, Tooltip
- Icon exports: 50+ Lucide icons
- Variants: 80+ total across all components

## Core Applications

### @ella/api
**REST API (Hono framework, PORT 3001)**

**Routes:** 18 endpoints across 7 modules
- Clients (CRUD + profile)
- Cases (tax case management)
- Documents (digital doc handling)
- Actions (task queue)
- Messages (conversations)
- Portal (magic link access)
- Health check

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
- `/u/$token/upload` - Document upload flow
- `/u/$token/status` - Upload status tracking

**Features:**
- Passwordless token-based auth
- Mobile-optimized (max-width 448px)
- Vietnamese/English i18n
- File validation (JPEG, PNG, PDF, 10MB max)
- Upload progress & status tracking

### @ella/workspace
**Staff management dashboard (React, PORT 5173)**

**Pages:**
- `/` - Dashboard with stats
- `/actions` - Priority-grouped action queue
- `/clients` - Kanban/table client view
- `/clients/$clientId` - Client detail (3 tabs)
- `/clients/new` - Multi-step client creation
- `/cases/$caseId/entry` - Data entry mode
- `/cases/$caseId/messages` - Case messaging

**Features:**
- Vietnamese-first UI
- Zustand state management
- 20+ reusable components
- Type-safe routing (TanStack Router)
- Mock API integration (ready for real API)

## Database Schema Highlights

### Core Models
- **Staff** - Roles: admin, staff, CPA
- **Client** - Name, phone, email, language
- **TaxCase** - Per-client per-year, 7 status states
- **RawImage** - Upload documents with AI classification
- **DigitalDoc** - Extracted & verified documents
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

Required in `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/ella
```

Optional (integrations):
```
CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
GEMINI_API_KEY=...
TWILIO_ACCOUNT_SID=...
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

## Recent Changes (Phase 1.5 Second Half)

**New Components Added:**
- Modal - Dialog with backdrop blur
- Tabs - Tabbed content with keyboard nav
- Avatar - User images with initials fallback
- Progress - Linear & circular progress indicators
- Tooltip - Floating help tooltips
- Icons - 50+ Lucide icon exports

**Files Modified:**
- `packages/ui/src/index.ts` - Added 6 new component exports
- `apps/workspace/routeTree.gen.ts` - Auto-generated (no manual edits)
- `apps/portal/routeTree.gen.ts` - Auto-generated (no manual edits)

## Next Steps

1. **Phase 2.0** - Authentication integration (Clerk setup)
2. **Phase 2.1** - API client integration (React Query)
3. **Phase 2.2** - Data entry workflows (OltPro integration)
4. **Phase 3.0** - AI document classification
5. **Phase 3.1** - Advanced search & analytics

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

**Last Updated:** 2026-01-13 20:00
**Status:** Phase 1.5 Complete - Ready for Phase 2 (Auth Integration)
**Branch:** feature/phase-1.5-shared-ui-components
