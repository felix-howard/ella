# Ella - Codebase Summary

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
- `packages/db/prisma/schema.prisma` - Data model (PostgreSQL)
- `packages/db/package.json` - Exports: prisma client + generated types

**Current Schema:**

- User model (id, email, timestamps)
- PostgreSQL datasource via DATABASE_URL env var

**Scripts:**

- `pnpm -F @ella/db generate` - Generate Prisma client
- `pnpm -F @ella/db migrate` - Run migrations
- `pnpm -F @ella/db push` - Sync schema with DB
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
- TypeScript, tsx (development)
- tsup (build bundler)

**Key Files:**

- `apps/api/src/index.ts` - Server entry point (serves on PORT 3001)
- `apps/api/src/app.ts` - Main app instance & routes
- `apps/api/src/routes/health.ts` - Health check endpoint
- `apps/api/package.json` - Dependencies & scripts
- `apps/api/tsconfig.json` - TypeScript config extending root

**Scripts:**

- `pnpm -F @ella/api dev` - Start dev server with tsx watch
- `pnpm -F @ella/api build` - Build to dist/ (ESM + types)
- `pnpm -F @ella/api start` - Run built server
- `pnpm -F @ella/api type-check` - Type validation

**Architecture:**

- Imports from @ella/db, @ella/shared for type safety
- OpenAPI schema generation via zod-openapi
- RESTful endpoint design

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
- (More to be added as features develop)

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
- **Ignored:** dist/, node_modules/, *.gen.ts, .claude/skills/

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
- **Ignores:** `.prettierignore` (node_modules, dist, .turbo, .claude/skills)

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

## Phase 5 Planning

Anticipated next steps:

- API route implementation & database integration
- Authentication & authorization system
- Frontend component development & API integration
- Database schema expansion for documents, compliance rules
- Testing infrastructure setup

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

**Last Updated:** 2026-01-11
**Phase:** 4 - Tooling
**Maintained By:** Documentation Manager
