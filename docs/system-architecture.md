# System Architecture

Ella employs a layered, monorepo-based architecture prioritizing modularity, type safety, and scalability.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Frontend Layer (React)                 │
│    apps/web - User-facing web application       │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓ HTTP/REST API calls
┌──────────────────────────────────────────────────┐
│         Backend Layer (API Server)                │
│  apps/api - Express/Fastify API endpoints        │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓ Prisma ORM queries
┌──────────────────────────────────────────────────┐
│      Shared Packages (Monorepo Utilities)        │
│  ├─ @ella/db - Database & Prisma client         │
│  ├─ @ella/shared - Types & validation schemas   │
│  └─ @ella/ui - Component library                │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓ Database queries
┌──────────────────────────────────────────────────┐
│     Data Layer (PostgreSQL)                      │
│     - User accounts & documents                  │
│     - Audit logs                                │
│     - Compliance data                           │
└──────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Frontend Layer (apps/portal & apps/workspace)
**Technology:** React 19, Vite 6, TanStack Router 1.94+, React Query 5.64+, @ella/ui, Tailwind CSS v4

**Structure:**
- `apps/portal/` - Primary user-facing frontend
- `apps/workspace/` - Secondary workspace-specific frontend
- File-based routing via TanStack Router (`src/routes/*`)
- Auto-generated route tree (`routeTree.gen.ts`)

**Responsibilities:**
- User interface rendering
- Client-side routing & navigation
- Form handling & validation
- Server state management (React Query)
- API request orchestration
- Authentication flow (login, logout, signup)

**Key Features:**
- Document upload interface
- Dashboard with compliance status
- Document search & filtering
- User settings & profile

**API Communication:**
- HTTP REST calls to backend (via React Query)
- Request validation via @ella/shared schemas
- Response type safety via TypeScript

### Backend API Layer (apps/api)
**Technology:** Hono 4.6+, Node.js server, @hono/zod-openapi, TypeScript

**Structure:**
- Entry: `src/index.ts` (serves on PORT 3001, fallback default)
- App config: `src/app.ts` (main Hono app instance & routes)
- Routes: `src/routes/*` (modular endpoint definitions)
- Example: `src/routes/health.ts` (health check endpoint)

**Build & Deployment:**
- Dev: `pnpm -F @ella/api dev` (tsx watch for hot reload)
- Build: `pnpm -F @ella/api build` (tsup → ESM + type defs)
- Start: `pnpm -F @ella/api start` (runs dist/index.js)

**Responsibilities:**
- HTTP request handling
- Request validation (Zod schemas from @ella/shared)
- Business logic execution
- Database transaction management
- Error handling & standardized responses
- Authentication & authorization
- OpenAPI schema generation
- Logging & monitoring

**Core Services (to implement):**
- User authentication (JWT-based)
- Document CRUD operations
- Compliance rule engine
- Notification system (future)
- File storage service (future)

**Response Format:**
All API responses follow `apiResponseSchema`:
```json
{
  "success": true,
  "data": { /* payload */ },
  "error": null
}
```

**Error Format:**
```json
{
  "success": false,
  "data": null,
  "error": "Descriptive error message"
}
```

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
  select: { id: true, email: true, createdAt: true }
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
const getUsers = async (
  pagination: Pagination
): Promise<ApiResponse<User[]>> => {
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

## Data Flow

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

### Document Upload Flow
```
Upload Form (Frontend)
        ↓
Select file + metadata (validated locally)
        ↓
POST /api/documents (with auth header)
        ↓
Validate request (Zod from @ella/shared)
        ↓
Check authorization
        ↓
Store file (to storage service - future)
        ↓
Create Document record (Prisma)
        ↓
Return document data (apiResponseSchema)
        ↓
Update frontend state (show in list)
```

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

## Database Schema (Phase 2)

**Current Models:**
```
User
├── id (String, @id, @default(cuid()))
├── email (String, @unique)
├── createdAt (DateTime, @default(now()))
└── updatedAt (DateTime, @updatedAt)
```

**Phase 3+ Models (Planned):**
```
- Document (belongs to User)
- ComplianceRule (one to many Documents)
- Notification (belongs to User)
- AuditLog (tracks all changes)
- Role (Admin, User, Client)
- Permission (RBAC)
```

## Monorepo Configuration

### pnpm Workspaces
```yaml
packages:
  - "packages/*"
  - "apps/*"
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
  data: userData
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

## Security Architecture

**Authentication:**
- JWT tokens for stateless auth
- Secure refresh token rotation
- Password hashing (via @prisma/client lifecycle hooks - future)

**Authorization:**
- Role-based access control (RBAC)
- Middleware checks permissions
- Resource-level authorization

**Data Protection:**
- HTTPS enforced
- SQL injection prevention (Prisma parameterized queries)
- CSRF protection (SameSite cookies)
- Input validation (Zod schemas)
- Audit logging for compliance

**Sensitive Data:**
- Database encryption (future)
- PII masked in logs
- Secrets in environment variables only

## Testing Architecture

**Unit Testing:**
- Test individual functions/components
- Mock Prisma queries
- Schema validation tests

**Integration Testing:**
- Test API endpoints
- Real database (test database)
- Authentication flow
- Error scenarios

**E2E Testing:**
- Test complete user workflows
- Frontend + Backend + Database
- Real browser (Playwright/Cypress - future)

**Test Data:**
- Seed scripts for consistent data
- Transaction rollback per test
- Isolated test database

---

**Last Updated:** 2026-01-11
**Phase:** 3 - Apps Setup
**Architecture Version:** 1.1
