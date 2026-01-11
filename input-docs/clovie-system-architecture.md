# Clovie System Architecture

**Last Updated:** January 7, 2026
**Status:** Phase 20 - Client Management (Addresses, Contacts, Social Subresources COMPLETE)
**Version:** 3.4 - Client Subresources (Phase 20.06-3)

## Architecture Overview

Clovie follows a monorepo architecture with clear separation of concerns: frontend, backend, shared libraries, and database layer. The system uses TypeScript across all packages for type safety and consistency. Frontend runs on Vite + React 19 with TanStack Router for optimal performance.

```
┌──────────────────────────────────────────────────────────────┐
│                       Frontend Layer                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  apps/web (Vite + React 19)                                  │
│  port 5173                                                   │
│                                                              │
│  ├─ TanStack Router                                          │
│  ├─ Client-side render                                       │
│  ├─ API via Hono backend                                     │
│  • Clerk Authentication                                      │
│  • Zustand State Mgmt                                        │
│  • TanStack React Query                                      │
│  • Tailwind CSS                                              │
│  • @repo/shared types                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                               │ HTTPS
                               │ (API_URL env)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Layer (Hono REST)                      │
│                   apps/api (port 3001)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  OpenAPI 3.1.0 + Zod Schemas                        │  │
│  │  ├─ GET /health (no auth)                           │  │
│  │  ├─ GET /docs (Scalar UI)                           │  │
│  │  ├─ GET /openapi.json (spec)                        │  │
│  │  ├─ POST /upload/presigned-url (auth, R2 avatars)  │  │
│  │  └─ Feature routes (authenticated via Clerk JWT)    │  │
│  │                                                      │  │
│  │  Middleware Stack:                                  │  │
│  │  ├─ CORS (env-configurable origins)                │  │
│  │  ├─ Auth (Clerk JWT verification, optional/route)  │  │
│  │  └─ Error handling (HTTPException)                 │  │
│  └──────────────────┬───────────────────────────────────┘  │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Layer (@repo/db)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Prisma ORM v6                                      │  │
│  │  ├─ Database-agnostic schema (prisma/schema.prisma) │  │
│  │  ├─ Database client (@prisma/client)                │  │
│  │  └─ Migrations via Prisma Migrate                   │  │
│  │                                                      │  │
│  │  Database (PostgreSQL / MongoDB)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│         Shared Packages (monorepo dependencies)              │
│  ┌──────────────────┬─────────────────────────────────────┐  │
│  │ @repo/shared     │ Utilities & validation schemas      │  │
│  │ @repo/db         │ Database client & migrations        │  │
│  │ @repo/typescript │ TS config (base, react, node)       │  │
│  │ @repo/eslint     │ ESLint rules (base, react, node)    │  │
│  └──────────────────┴─────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend Layer

#### apps/web (Vite + React 19)

**Technology:** Vite 6.0.5 + React 19 + TanStack Router v1.93.0 + TypeScript 5.7
**Port:** 5173 (dev), production via Vercel/Cloudflare Pages

**Key Services:**
- **Clerk Auth**: User authentication (Clerk React)
- **Zustand**: Client-side state management
- **TanStack Query**: Data fetching & caching
- **TanStack Router**: Client-side routing
- **Tailwind CSS**: Styling & utility classes

**Structure:**
```
apps/web/src/
├── routes/
│   ├── __root.tsx           # Root layout
│   ├── index.tsx            # Home page
│   └── ...                  # Feature routes
├── components/
│   └── providers/           # Clerk, Query providers
├── lib/                     # Utilities
└── styles/
    └── globals.css          # Tailwind styles
```

**Architecture:**
- Client-side rendering (React 19 + Vite)
- TanStack Router for file-based routing
- API via Hono backend
- Vite dev server with HMR

**Authentication Flow (Both):**
1. User visits app → Clerk SDK checks session
2. No session → redirected to login
3. Valid session → access protected routes
4. API calls include Clerk JWT in Authorization header

### API Layer (apps/api)

**Technology:** Hono 4.6.15 + @hono/zod-openapi + TypeScript 5.7

**Core Concepts:**

1. **OpenAPI-First Design**
   - Every route defined with OpenAPI metadata via `createRoute()`
   - Zod schemas for request/response validation
   - Auto-generated `/docs` (Scalar UI) and `/openapi.json`
   - Type-safe from schema to response

2. **Route Pattern (example from health.ts)**
   ```typescript
   const healthRoute = createRoute({
     method: 'get',
     path: '/health',
     tags: ['System'],
     responses: { 200: { ... } }
   });

   app.openapi(healthRoute, (c) => {
     // Handler logic
     return c.json({ ... });
   });
   ```

3. **Middleware System**
   - CORS: Configurable origins (env-driven)
   - Auth: Optional Clerk JWT verification per-route
   - Can compose multiple middleware on routes

4. **Error Handling**
   - HTTPException for standardized errors
   - Automatic error serialization to JSON
   - 401 for auth failures, 400 for validation, 500 for server errors

**Environment Variables:**
- `PORT` - API server port (default 3001)
- `NODE_ENV` - development | production
- `API_BASE_URL` - Public API URL (for OpenAPI docs)
- `CLERK_SECRET_KEY` - Clerk backend secret (required for auth middleware)
- `FRONTEND_URL` - Frontend origin for CORS
- `ALLOWED_ORIGINS` - Additional CORS origins (comma-separated)
- `R2_ACCOUNT_ID` - Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID` - R2 API access key
- `R2_SECRET_ACCESS_KEY` - R2 API secret key
- `R2_BUCKET_NAME` - R2 bucket name for uploads
- `R2_PUBLIC_URL` - Public R2 URL for uploaded files

### Database Layer (@repo/db)

**Technology:** Prisma ORM v6 + Prisma Client v6

**Structure:**
```
packages/db/
├── prisma/
│   ├── schema.prisma         # Data model definition
│   └── migrations/           # Migration history
├── src/
│   └── client.ts             # Prisma client export
└── package.json
```

**Key Features:**
- Database-agnostic schema (supports PostgreSQL, MongoDB, etc.)
- Type-safe database queries (auto-generated types)
- Migrations via `pnpm db:migrate`
- Prisma Studio for visual data exploration

**Core Models (30 total):**
- **Foundation (12):** Organization, Staff, Service, ServiceCategory, Client, Appointment, Sale, Location, Phone, Compensation, StaffPermissions, StaffNotificationSettings
- **Phase 15 (2):** OrganizationSettings, LocationBusinessHours + Overrides
- **Phase 19 (3):** ServiceOptionGroup, ServiceOptionGroupOption, ServiceOptionGroupLink
- **Phase 20.01 (3):** Client (core profile), Tag, ClientTagAssignment
- **Phase 20.02 (3):** ClientAddress, ClientContactNumber, ClientSocialProfile
- **Phase 20.03 (2):** ClientTimeline, ClientTimelineFile
- **Enums (20):** StaffRole, ServiceStatus, AppointmentStatus, PhoneLineType, LocationType, TimeOffReason, InviteStatus, DeductionType, PaymentRequirement, UpchargeType, DisplayType, ClientGender, UserType, Gender, AddressType, PhoneType, SocialPlatform, ChangeType, CommissionType, TimelineEntryType

### Shared Packages

**@repo/shared**: Utilities, types, schemas, constants
- Used by frontend & backend for common validation
- Zod schemas for API contracts
- Type definitions for domain models

**@repo/db**: Database client & configuration
- Prisma client instance
- Migration utilities
- Shared by all applications

**@repo/typescript-config**: TypeScript preset configurations
- base.json - Node.js projects
- react.json - React projects
- node.json - Pure Node.js services

**@repo/eslint-config**: ESLint rule presets
- Base config (TypeScript)
- React config (hooks, jsx rules)
- Node config (commonjs patterns)

## Data Flow

### Typical Request Flow

1. **Client (Frontend)**
   - User interaction → Zustand dispatch
   - TanStack Query calls `fetch('/api/endpoint', { headers: { Authorization: 'Bearer <token>' } })`

2. **CORS Check**
   - Hono CORS middleware validates origin
   - If allowed, continues; otherwise rejects

3. **Route Handler**
   - Clerk auth middleware (if applied) verifies JWT
   - Extracts userId, orgId from token claims
   - Routes to handler logic

4. **Business Logic**
   - Query @repo/db (Prisma) for data
   - Validate response against Zod schema
   - Return JSON response

5. **Response**
   - HTTP 200 + JSON body
   - TanStack Query caches response
   - Zustand updates if needed
   - UI re-renders

### Error Cases

- **Missing CORS origin** → 403 Forbidden
- **Missing/invalid auth token** → 401 Unauthorized
- **Invalid request payload** → 400 Bad Request (Zod validation)
- **Database error** → 500 Internal Server Error
- **Route not found** → 404 Not Found

## Technology Decisions

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Frontend** | Vite 6 + React 19 | CSR with TanStack Router, fast dev server, optimized builds |
| **Frontend Auth** | Clerk | Managed auth service, SDK for both frontend & backend |
| **Frontend State** | Zustand + React Query | Lightweight, composable, excellent data sync |
| **API Framework** | Hono | Lightweight, edge-ready, excellent TypeScript support |
| **API Validation** | Zod + OpenAPI | Runtime validation, auto-docs, type safety |
| **API Auth** | Clerk JWT | Consistent with frontend, backend verification |
| **Database ORM** | Prisma | Type-safe, migrations, auto-generated client |
| **Build Tool** | Turborepo | Monorepo orchestration, task caching |
| **Package Manager** | pnpm | Fast, disk-efficient, monorepo support |

## Environment Configuration (Phase 6)

### File Structure
- `.env.example` (root) - Master template for all environments
- `apps/web/.env.local.example` - Frontend dev keys & client config
- `packages/db/.env` - Prisma CLI connections (git-ignored)

### Connection Strategy
- **Database Pool (DATABASE_URL):** For application connections (pgbouncer for serverless)
- **Direct Connection (DIRECT_URL):** For Prisma CLI migrations (direct link to primary)
- Separate URLs prevent connection pool exhaustion during migrations

### Key Variables by Service

**Clerk (Multi-tenant auth)**
- VITE_CLERK_PUBLISHABLE_KEY - Client-side initialization
- CLERK_SECRET_KEY - Server-side JWT verification

**Supabase (PostgreSQL + realtime)**
- DATABASE_URL - App pool connections
- DIRECT_URL - Prisma migrations
- VITE_SUPABASE_URL - Client realtime
- VITE_SUPABASE_ANON_KEY - Client API access

**API/Frontend**
- VITE_API_URL - Frontend → API communication
- PORT - API server port (default 3001)
- FRONTEND_URL - CORS origin for API
- NODE_ENV - development | production

## Deployment Topology

```
Production Environment (main branch)
├─ Frontend
│  ├─ Vercel Production
│  └─ Clerk Prod instance (live keys)
├─ API
│  ├─ Railway Production service
│  └─ Clerk Prod + Supabase Prod credentials
└─ Database
   └─ Supabase Prod Project (PostgreSQL)

Staging Environment (dev branch)
├─ Frontend
│  ├─ Vercel Preview
│  └─ Clerk Dev instance
├─ API
│  ├─ Railway Dev service
│  └─ Clerk Dev + Supabase Dev credentials
└─ Database
   └─ Supabase Dev Project (PostgreSQL)

Local Development (feature/* branches)
├─ Frontend: localhost:3000 (pnpm dev)
├─ API: localhost:3001 (pnpm dev)
├─ Auth: Clerk Dev instance
└─ Database: Supabase Dev Project (via DATABASE_URL)
```

## Security Considerations

1. **Authentication**
   - Clerk handles user identity
   - API verifies Clerk JWT tokens
   - Tokens include userId, orgId claims

2. **Authorization**
   - Frontend middleware checks auth before route access
   - API routes can apply auth middleware
   - Database queries filtered by userId/orgId

3. **CORS**
   - Whitelist specific origins in production
   - Credentials required for cross-origin requests
   - Dev allows localhost:3000 by default

4. **Secrets Management**
   - CLERK_SECRET_KEY in .env (never in code)
   - DATABASE_URL in .env
   - DIRECT_URL for migrations (separate from pool URL)

5. **Type Safety**
   - TypeScript strict mode enabled
   - Zod validation at API boundaries
   - Database types auto-generated from schema

## Performance Optimizations

1. **Frontend**
   - Vite fast HMR with instant updates
   - TanStack Query caching & deduplication
   - Code splitting & lazy loading ready
   - Modern JavaScript with no polyfills

2. **API**
   - Hono lightweight routing
   - No heavy middleware by default
   - Ready for edge deployment

3. **Database**
   - Prisma lazy loading
   - Index strategy (defined in schema.prisma)
   - Connection pooling via Prisma (DATABASE_URL vs DIRECT_URL)

## Development Workflow

### Local Setup
```bash
# Install dependencies
pnpm install

# Run all dev servers (frontend + API)
pnpm dev

# Run specific workspace
pnpm --filter @repo/api dev
```

### Adding a New API Route

1. Create route file in `apps/api/src/routes/`
2. Define schema using Zod + createRoute
3. Implement handler with database query
4. Register in `apps/api/src/index.ts`
5. API docs auto-update at `/docs`

### Adding a New Frontend Page

1. Create page in `apps/web/src/app/`
2. Import shared components/utils
3. Use TanStack Query for API data
4. Clerk auth middleware protects if needed

## Frontend Stack Summary

**Current Status:** Vite + React 19 production-ready
- Vite frontend fully operational at `apps/web/` (port 5173)
- All core dependencies installed and optimized
- TanStack Router configured with 18 routes
- Clerk authentication fully integrated

**Architecture:**
- **Package:** `@repo/web`
- **Framework:** Vite 6 + React 19
- **Routing:** TanStack Router (file-based, multi-tenant)
- **API Integration:** Hono backend via fetch
- **Dev Experience:** Vite HMR & fast rebuilds

## Next Steps

1. **Phase 4: Feature Implementation**
   - Calendar functionality with real-time updates
   - Client & appointment management pages
   - Staff management interface
   - Sales & reporting modules

2. **Phase 5: Data Integration**
   - Connect all pages to Hono API via Orval
   - Implement TanStack Query data fetching
   - Add state management for complex features

3. **Phase 6: Testing & Optimization**
   - Unit tests for hooks & utilities
   - Integration tests for critical flows
   - Performance optimization & code splitting

4. **Phase 7+: Production Deployment**
   - Deploy Vite frontend to Vercel
   - Configure production environment
   - Monitor performance & stability

---

## Multi-Tenancy Architecture

### Tenant Model

Clovie uses **Clerk Organizations** as the tenant unit. Each salon = one organization.

```
┌─────────────────────────────────────────────────────────────┐
│                     MULTI-TENANCY MODEL                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Clerk Organization (Tenant)                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  org_abc123 = "Happy Nails Salon"                      │ │
│  │                                                        │ │
│  │  Members:                                              │ │
│  │  ├─ user_001 (Owner)                                   │ │
│  │  ├─ user_002 (Manager)                                 │ │
│  │  ├─ user_003 (Staff)                                   │ │
│  │  └─ user_004 (Receptionist)                            │ │
│  │                                                        │ │
│  │  Data (Isolated via organization_id):                  │ │
│  │  ├─ Appointments                                       │ │
│  │  ├─ Clients                                            │ │
│  │  ├─ Staff                                              │ │
│  │  ├─ Services                                           │ │
│  │  ├─ Sales                                              │ │
│  │  └─ ...                                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### URL Structure (Multi-Tenant Routing)

```
https://app.clovie.io/{orgId}/calendar
https://app.clovie.io/{orgId}/clients
https://app.clovie.io/{orgId}/clients/{clientId}
https://app.clovie.io/{orgId}/sales
https://app.clovie.io/{orgId}/sales/{saleId}
https://app.clovie.io/{orgId}/staff
https://app.clovie.io/{orgId}/products
https://app.clovie.io/{orgId}/gift-cards
https://app.clovie.io/{orgId}/inbox
https://app.clovie.io/{orgId}/reports
https://app.clovie.io/{orgId}/settings/*
```

### TanStack Router Structure (Phase 2 - Complete)

```
apps/web/src/routes/
├── __root.tsx                # Root layout + Helmet provider
├── index.tsx                 # Marketing landing page (public)
├── login.tsx                 # Legacy login (public)
├── _auth.tsx                 # Auth layout (public: sign-in/up)
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── _auth
│   └── $orgId.tsx           # Protected layout with AppShell
│       ├── index.tsx        # Dashboard overview
│       ├── calendar.tsx     # Calendar view
│       ├── clients.tsx      # Client management
│       ├── sales.tsx        # Sales/transactions
│       ├── gift-cards.tsx   # Gift card management
│       ├── inbox.tsx        # Messaging
│       ├── products.tsx     # Inventory
│       ├── reports.tsx      # Analytics
│       ├── get-started.tsx  # Onboarding
│       └── settings
│           ├── index.tsx    # Settings overview
│           ├── staff.tsx    # Staff management
│           └── business-setup.tsx  # Business details
├── _dev
│   └── ui-preview.tsx       # Component gallery (dev only)
└── routeTree.gen.ts         # Auto-generated from file structure
```

**Generation:** File-based routing auto-generates `routeTree.gen.ts` via TanStack Router CLI

### Data Isolation Strategy

**Every database table includes `organization_id`:**

```prisma
model Appointment {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  clientId        String   @map("client_id")
  staffId         String   @map("staff_id")
  // ... other fields

  @@index([organizationId])
  @@map("appointments")
}

model Client {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  // ... other fields

  @@index([organizationId])
  @@map("clients")
}
```

**API middleware extracts and validates orgId:**

```typescript
// middleware/org-context.ts
export const orgContextMiddleware = async (c, next) => {
  const orgId = c.req.param('orgId');
  const clerkOrgId = c.get('clerkAuth').orgId;

  // Verify user belongs to this organization
  if (orgId !== clerkOrgId) {
    throw new HTTPException(403, { message: 'Access denied' });
  }

  c.set('organizationId', orgId);
  await next();
};
```

**All queries filtered by organization:**

```typescript
// services/appointments.ts
export const getAppointments = async (orgId: string, date: Date) => {
  return prisma.appointment.findMany({
    where: {
      organizationId: orgId, // Always filter!
      date: date,
    },
  });
};
```

### Supabase Row-Level Security (RLS)

```sql
-- Enable RLS on all tenant tables
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their organization's data
CREATE POLICY "org_isolation" ON appointments
  FOR ALL
  USING (organization_id = current_setting('app.organization_id')::text);

-- Set organization context before queries
SET app.organization_id = 'org_abc123';
```

---

## Database Schema (Core Models)

### Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│Organization │────<│    Staff    │────<│  Service    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────<│ Appointment │>────│ AppointmentService │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       └───────────>│    Sale     │
                    └─────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │ SaleItem    │
                    └─────────────┘
```

### Core Tables

| Table | Description | Key Fields |
|-------|-------------|------------|
| `organizations` | Tenant (synced from Clerk) | id, name, slug |
| `staff` | Salon employees | id, org_id, name, role, color, avatar_url, invite_status |
| `service_categories` | Service grouping | id, org_id, name, sort_order, is_demo, only_show_with_direct_link |
| `services` | Service catalog (26+ fields) | id, org_id, category_id, name, duration, price, deductions, online_booking_settings, staff_requirements |
| `staff_services` | Staff-service assignments | staff_id, service_id, org_id, custom_price, commission |
| `staff_compensation` | Compensation config | id, staff_id, org_id, service_commission, product_commission, hourly_rate |
| `clients` | Customer database | id, org_id, name, phone, email |
| `appointments` | Scheduled bookings | id, org_id, client_id, staff_id, date, status |
| `sales` | Completed transactions | id, org_id, client_id, total, status |
| `turn_tracker` | Walk-in queue | id, org_id, staff_id, turn_count, date |
| `service_option_group` | **[Phase 19] Service customization groups** | id, org_id, service_id, name, label, display_type, min_selections, max_selections, is_required |
| `service_option_group_option` | **[Phase 19] Individual customization options** | id, group_id, name, value, upcharge_type, upcharge_amount, sort_order |
| `service_option_group_link` | **[Phase 19] Links groups to services** | id, service_id, group_id, is_required, sort_order |

### Database Enums (Phase 11 - Schema)

**Deduction Types** (for pre/post-commission & deposits):
- `FIXED_AMOUNT` - Flat deduction amount
- `PERCENTAGE` - Percentage-based deduction

**Payment Requirements** (for online booking):
- `NONE` - No payment required
- `FULL_PAYMENT` - Full amount due at booking
- `PARTIAL_DEPOSIT` - Deposit portion due, remainder at service

**Upcharge Types** (Phase 19 - Service Customizations):
- `FIXED_AMOUNT` - Fixed price upcharge
- `PERCENTAGE` - Percentage-based upcharge
- `NO_UPCHARGE` - No additional charge

**Display Types** (Phase 19 - Service Customizations):
- `SINGLE_SELECT` - Radio buttons / dropdown
- `MULTI_SELECT` - Checkboxes
- `TEXT_INPUT` - Free text field
- `DROPDOWN` - Select dropdown

---

## Phase 19 - Service Customizations (Schema Phase 1)

### Overview

Adds service customization/option groups for flexible service configuration. Enables clients/staff to select additional options during booking (e.g., gel color, nail art designs).

### Database Models

**ServiceOptionGroup** - Customization group container
- Fields: id, organizationId, serviceId, name, label, displayType, minSelections, maxSelections, isRequired
- Relations: options (ServiceOptionGroupOption), links (ServiceOptionGroupLink)

**ServiceOptionGroupOption** - Individual customization choice
- Fields: id, groupId, name, value, upchrgeType, upchrageAmount, sortOrder
- Supports fixed amount or percentage-based upcharges

**ServiceOptionGroupLink** - Junction table for group-service assignments
- Fields: id, serviceId, groupId, isRequired, sortOrder
- Enables reusing same group across multiple services

### Next Steps (Phase 19 - API)

1. **Phase 19.2:** CRUD endpoints for option groups
   - GET/POST/PATCH/DELETE /services/{serviceId}/option-groups
   - GET/PUT /services/{serviceId}/option-groups/{groupId}/options

2. **Phase 19.3:** Frontend integration
   - Option group management UI in service settings
   - Display customization options in booking flow

---

## Phase 20 - Client Management

### Phase 20.01 - Core Client Schema (Complete)

**Models:**
- **Client** - Core client profile with contact info, preferences, and referral tracking
- **Tag** - Client tagging system for organization (MALE, FEMALE, NON_BINARY, OTHER, PREFER_NOT_TO_SAY)
- **ClientTagAssignment** - M:N junction for client-tag assignments

### Phase 20.02 - Client Addresses & Contacts (Complete - Schema)

**Models:**
- **ClientAddress** - Client address records with type categorization
  - Supports multiple addresses per client (HOME, WORK, BILLING, OTHER)
  - Primary address flag for default selection
  - Full address fields: addressLine1, addressLine2, city, state, zipCode, countryCode
  - Cascade delete on client deletion

- **ClientContactNumber** - Additional phone numbers beyond primary Client.phone
  - Phone type categorization (MOBILE, HOME, WORK, OTHER)
  - Optional custom label (e.g., "Mom's phone", "Work ext")
  - Primary flag for additional phone ranking
  - Unique constraint: organizationId + phoneNumber per tenant
  - Cascade delete on client deletion

- **ClientSocialProfile** - Social media profile links
  - Platform support: INSTAGRAM, FACEBOOK (extensible)
  - Username + optional profileUrl for external linking
  - One profile per platform per client
  - Cascade delete on client deletion

**Enums:**
- **AddressType:** HOME, WORK, BILLING, OTHER
- **PhoneType:** MOBILE, HOME, WORK, OTHER
- **SocialPlatform:** INSTAGRAM, FACEBOOK

**Architecture Notes:**
- All models include organizationId for multi-tenancy isolation
- Cascade delete relationships preserve referential integrity
- Unique constraints prevent duplicate phone numbers per organization
- Design supports future address/phone verification workflows
- Social profiles enable CRM features (follow-up, social messaging)

### Phase 20.06-3 - Client Subresource APIs (Complete)

**Implemented Endpoints (11 total):**

**Addresses (4 endpoints):**
- `GET /clients/{clientId}/addresses` - List all addresses with type & primary flag
- `POST /clients/{clientId}/addresses` - Create address
  - Request: addressLine1, addressLine2, city, state, zipCode, countryCode, addressType, isPrimary
  - Validates address type (HOME, WORK, BILLING, OTHER)
- `PATCH /clients/{clientId}/addresses/{addressId}` - Update address (partial)
- `DELETE /clients/{clientId}/addresses/{addressId}` - Delete address

**Contacts (4 endpoints):**
- `GET /clients/{clientId}/contacts` - List all phone numbers
- `POST /clients/{clientId}/contacts` - Create contact
  - Request: phoneNumber, phoneType, label, isPrimary
  - Validates phone type (MOBILE, HOME, WORK, OTHER)
  - Unique constraint: one primary per client
- `PATCH /clients/{clientId}/contacts/{contactId}` - Update contact
- `DELETE /clients/{clientId}/contacts/{contactId}` - Delete contact

**Social Profiles (3 endpoints):**
- `GET /clients/{clientId}/social` - List all social profiles
- `POST /clients/{clientId}/social` - Create profile
  - Request: platform, username, profileUrl (optional)
  - Supports INSTAGRAM, FACEBOOK
  - Unique constraint: one profile per platform per client
- `DELETE /clients/{clientId}/social/{socialId}` - Delete profile

**Service Layer Structure:**
- `address-service.ts` - CRUD operations for addresses with validation
- `contact-service.ts` - Phone contact management with uniqueness checks
- `social-service.ts` - Social profile operations with platform validation

**Schemas & Validation:**
- `address.ts` - Address Zod schemas with type/country validation
- `contact.ts` - Phone number schemas with format & type validation
- `social.ts` - Social profile schemas with platform enumeration

**Architecture Patterns:**
- Org-scoped isolation on all operations (all queries filter by organizationId)
- Transaction-safe operations for primary flag exclusivity (contacts)
- Cascade delete support (deleting client removes all subresources)
- Partial update support (PATCH endpoints)
- Pagination-ready list endpoints with sorting
- Error handling: 404 for not found, 409 for conflicts (duplicates), 400 for validation

---

## Real-time Architecture

### Supabase Realtime for Calendar Updates

```typescript
// hooks/use-realtime-appointments.ts
export const useRealtimeAppointments = (orgId: string, date: Date) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`appointments:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          // Invalidate and refetch
          queryClient.invalidateQueries(['appointments', orgId, date]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, date]);
};
```

### Events to Broadcast

| Event | Trigger | Subscribers |
|-------|---------|-------------|
| `appointment.created` | New booking | All calendar views |
| `appointment.updated` | Reschedule/edit | All calendar views |
| `appointment.status_changed` | Check-in/checkout | Calendar + Turn Tracker |
| `turn.updated` | Walk-in assigned | Turn Tracker widget |

---

## Feature Module Architecture

### Feature-Based Organization

```
apps/web/src/
├── features/
│   ├── calendar/
│   │   ├── components/
│   │   │   ├── calendar-grid.tsx
│   │   │   ├── appointment-block.tsx
│   │   │   └── time-axis.tsx
│   │   ├── hooks/
│   │   │   ├── use-appointments.ts
│   │   │   └── use-calendar-store.ts
│   │   ├── api/
│   │   │   └── appointments.ts
│   │   └── types/
│   │       └── appointment.ts
│   │
│   ├── clients/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── types/
│   │
│   ├── checkout/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── types/
│   │
│   ├── turn-tracker/
│   │   ├── components/
│   │   │   ├── turn-tracker-widget.tsx
│   │   │   ├── walk-in-modal.tsx
│   │   │   └── turn-queue.tsx
│   │   ├── hooks/
│   │   │   └── use-turn-tracker.ts
│   │   ├── api/
│   │   │   └── turn-tracker.ts
│   │   └── types/
│   │       └── turn.ts
│   │
│   └── settings/
│       ├── components/
│       ├── hooks/
│       └── api/
```

### API Route Organization

```
apps/api/src/
├── routes/
│   ├── health.ts              # /health
│   ├── organizations/
│   │   └── index.ts           # /orgs
│   ├── service-categories/     # Phase 12 - NEW
│   │   ├── index.ts           # GET /service-categories (list)
│   │   ├── create.ts          # POST /service-categories
│   │   ├── get.ts             # GET /service-categories/{categoryId}
│   │   ├── update.ts          # PATCH /service-categories/{categoryId}
│   │   ├── delete.ts          # DELETE /service-categories/{categoryId}
│   │   └── reorder.ts         # PUT /service-categories/reorder
│   ├── staff/
│   │   └── index.ts           # /staff/* (CRUD + relationships)
│   ├── appointments/
│   │   ├── index.ts           # /{orgId}/appointments
│   │   ├── create.ts
│   │   ├── update.ts
│   │   └── status.ts
│   ├── clients/
│   │   ├── index.ts           # /{orgId}/clients
│   │   ├── create.ts
│   │   └── [clientId].ts
│   ├── services/
│   │   └── index.ts           # /{orgId}/services
│   ├── business-setup/         # Phase 15 - NEW
│   │   ├── index.ts           # /organization-settings
│   │   ├── locations/         # /locations (CRUD)
│   │   └── phones/            # /business-phones (CRUD)
│   ├── phones/                # Phase 3 - NEW
│   │   ├── index.ts           # /phones/* (all phone routes)
│   │   ├── list.ts            # GET /phones
│   │   ├── create.ts          # POST /phones
│   │   ├── get.ts             # GET /phones/{phoneId}
│   │   ├── delete.ts          # DELETE /phones/{phoneId}
│   │   └── locations/         # Phone-location assignments
│   │       ├── index.ts       # /phones/{phoneId}/locations/*
│   │       ├── assign.ts      # POST /phones/{phoneId}/locations
│   │       ├── unassign.ts    # DELETE /phones/{phoneId}/locations/{locationId}
│   │       └── update.ts      # PATCH /phones/{phoneId}/locations/{locationId}
│   ├── sales/
│   │   └── index.ts           # /{orgId}/sales
│   └── turn-tracker/
│       ├── index.ts           # /{orgId}/turn-tracker
│       └── assign.ts
```

## Phase 15 - Business Setup Schema (Multi-location & Organization Config)

### Overview

Adds foundational models for multi-location support, business configuration, and location-based hours management.

### Database Models

**OrganizationSettings**
- Business details: businessName, websiteUrl, countryCode, currencyCode
- Branding: brandColor, logoUrl, logoPath, coverImageUrl, coverImagePath
- Advanced features: enableClientOwnership, enableWorkScheduleOverlap, enableClientAccountBalances, customEmailAddress/verification
- One-to-one with Organization

**Location**
- Multi-location support with address, timezone, tax rates
- Fields: name, locationType (PHYSICAL/VIRTUAL), addressLine1-2, city, state, zipCode, countryCode, timezone
- Operating: contactEmail, contactPhone, serviceTaxRate, productTaxRate, locationUrl (online booking)
- Flags: isPrimary, isActive
- Relations: businessHours, phoneAssignments
- Indexes: (organizationId, isActive), (organizationId, isPrimary)

**LocationBusinessHours**
- Base container for location operating hours (one per location)
- Relations: recurringHours (weekly schedule), dailyOverrides (date-specific changes)

**LocationRecurringHours**
- Weekly recurring hours (one per day of week per location)
- Fields: dayOfWeek, isOpen, closedReason (TimeOffReason enum), closedDetails
- Relations: timeSegments (multiple time slots per day)
- Unique constraint: (businessHoursId, dayOfWeek)

**LocationRecurringTimeSegment**
- Individual time slots for recurring hours
- Fields: openTime, closeTime (HH:MM format)
- Unique constraint: (recurringHoursId, openTime)

**LocationDailyOverride**
- Date-specific hour overrides (holidays, special events)
- Fields: overrideDate (DATE), isOpen, closedReason, closedDetails, isActive, createdBy
- Relations: timeSegments (override-specific time slots)
- Unique constraint: (businessHoursId, overrideDate)
- Indexes: (organizationId), (overrideDate) for efficient querying

**LocationOverrideTimeSegment**
- Individual time slots for daily overrides
- Fields: openTime, closeTime (HH:MM format)
- Unique constraint: (overrideId, openTime)

**BusinessPhone**
- Organization phone numbers in E.164 format
- Fields: phoneNumber, displayFormat, isVerified, isActive
- Unique constraint: (organizationId, phoneNumber)
- Relations: locationAssignments

**LocationPhone**
- Junction table for phone-location assignment
- Composite ID: (phoneId, locationId)
- Fields: isPrimary, assignedAt
- Allows multiple phones per location, one phone assigned to multiple locations

### New Enum

**LocationType**
- PHYSICAL - Physical location with address
- VIRTUAL - Virtual/online location

### Architecture Notes

- **Hierarchical hours structure:** BusinessHours → RecurringHours (7 entries) + DailyOverrides → TimeSegments
- **Multi-slot support:** Locations can have multiple operating hours per day (e.g., 9-12, 2-5)
- **Override precedence:** DailyOverrides take precedence over RecurringHours on same date
- **Organizational scope:** All models include organizationId for multi-tenancy
- **Tax flexibility:** Separate tax rates for services & products per location

---

## Phase 7 - Core Linking (Clerk-Staff Integration)

### Staff Invitation Flow

```
┌─────────────────┐
│  Organization   │
│  Admin/Manager  │
└────────┬────────┘
         │
         │ 1. POST /staff/{staffId}/invite
         ▼
┌─────────────────────────────────────────┐
│     Invite Staff Endpoint                │
├─────────────────────────────────────────┤
│ 1. Find staff by ID + orgId             │
│ 2. Validate: no existing Clerk account  │
│ 3. Validate: no pending invite          │
│ 4. Create Clerk org invitation          │
│ 5. Update staff.inviteStatus = PENDING  │
│ 6. Return invite confirmation           │
└────────┬────────────────────────────────┘
         │
         │ 2. Clerk sends webhook
         ▼
┌─────────────────────────────────────────┐
│     Clerk Webhook Handler                │
├─────────────────────────────────────────┤
│ POST /webhooks/clerk (Svix verified)    │
│                                         │
│ Event: organizationInvitation.accepted  │
│ 1. Extract user_id, email_address      │
│ 2. Find staff with matching email      │
│ 3. Link clerkUserId to staff           │
│ 4. Update inviteStatus = ACCEPTED      │
│                                         │
│ Event: user.deleted                    │
│ 1. Unlink clerkUserId (set null)       │
│ 2. Keep staff record intact            │
└─────────────────────────────────────────┘
```

### Database Schema Updates (Phase 7)

**Staff Model - New Fields:**
```prisma
inviteStatus   InviteStatus?   // PENDING | ACCEPTED | EXPIRED
invitedAt      DateTime?       // Timestamp of invitation send
clerkUserId    String?         // Clerk user ID (linked on accept)
```

**New Enum:**
```prisma
enum InviteStatus {
  PENDING     // Invitation sent, awaiting acceptance
  ACCEPTED    // User accepted invitation, linked to Clerk
  EXPIRED     // Invitation expired (not yet implemented)
}
```

### API Endpoints (Phase 7)

**Staff Invitation:**
- `POST /staff/{staffId}/invite` - Send Clerk organization invitation
  - Creates org invitation with email & staffId in publicMetadata
  - Updates inviteStatus to PENDING
  - Returns staffId, inviteStatus, invitedAt
  - Validation: staff exists, no clerkUserId, no pending invite

**Webhook Handler:**
- `POST /webhooks/clerk` - Receive & process Clerk events
  - Signature verification via Svix library
  - Handles: organizationInvitation.accepted, user.deleted
  - No authentication required (Svix signature validates source)

### Validation & Error Handling

**Invite Endpoint Errors:**
- 404: Staff not found
- 409: Staff already has Clerk account
- 409: Invite already pending
- 403: Organization required (auth context)

**Webhook Validation:**
- Svix signature verification required
- Invalid signature → 400 Bad Request
- Missing CLERK_WEBHOOK_SECRET → 500 error (logs to stderr)

### Environment Variables

**Required for Phase 7:**
- `CLERK_SECRET_KEY` - Clerk backend secret (for invite creation)
- `CLERK_WEBHOOK_SECRET` - Svix webhook secret (for signature verification)
- `APP_URL` - Frontend URL for invite redirect

---

## Phase 6 - Compensation Management (COMPLETED)

### API Endpoints
Staff compensation with service commission, product commission, hourly rates, and greater-of logic.

**Endpoints:**
- GET /staff/{staffId}/compensation - Get compensation settings
- PATCH /staff/{staffId}/compensation - Upsert compensation settings
- PUT /staff/{staffId}/compensation/tiers - Replace commission tiers

**Data Models:**
- **Compensation**: staffId, organizationId, serviceCommissionType, productCommissionEnabled, hourlyRateEnabled, etc.
- **ServiceCommissionTier**: minRevenue, maxRevenue, percentage (sliding scale support)

**Validation:**
- Tier validation: no gaps between tiers, correct ordering, min revenue starts at 0
- Commission type validation: BASIC_PERCENTAGE requires basicPct value
- Atomic tier replacement via transactions

**Key Patterns:**
- Partial update support (PATCH) with optional fields
- Default compensation returned when no record exists
- Tier auto-sorting and validation before persistence
- Organization isolation on all operations
- Decimal string format for currency (prevents floating-point errors)

---

## Phase 3 - Phone Management API (COMPLETED)

### Overview

Adds business phone number management with location-based assignments and primary phone selection for multi-location operations.

### Database Models

**BusinessPhone**
- Organization phone numbers in flexible format (not enforced E.164)
- Fields: phoneNumber (7-20 chars), displayFormat (optional, e.g., "(555) 123-4567")
- Flags: isVerified, isActive (soft delete)
- Unique constraint: (organizationId, phoneNumber)
- Relations: locationAssignments (via LocationPhone)
- Timestamps: createdAt, updatedAt

**LocationPhone** (Junction Table)
- Many-to-many relationship between BusinessPhone and Location
- Composite ID: (phoneId, locationId)
- Fields: isPrimary (one primary phone per location), assignedAt
- Includes organizationId for query filtering

### API Endpoints (7 total)

**Phone CRUD:**
- `GET /phones` - List all active phones with location assignments
  - Returns array of phones ordered by createdAt
  - Includes nested locations array with isPrimary flag
  - Auth required (Clerk JWT)
- `POST /phones` - Create new phone
  - Request: phoneNumber (required), displayFormat (optional)
  - Response: Phone with empty locations array
  - Unique constraint check per org
  - Reactivates soft-deleted phone if exists
  - Auth required
- `GET /phones/{phoneId}` - Get single phone with assignments
  - Returns phone + location assignments
  - 404 if not found or inactive
  - Auth required
- `DELETE /phones/{phoneId}` - Soft delete phone
  - Cascades location assignments (deleteMany)
  - Transaction-safe operation
  - Auth required

**Phone-Location Management:**
- `POST /phones/{phoneId}/locations` - Assign to multiple locations
  - Request: locationIds (string[]), isPrimary (boolean)
  - If isPrimary=true, unsets other primary phones for those locations
  - Upsert pattern (create or update existing assignment)
  - Transaction-safe exclusive primary enforcement
  - Returns updated phone with assignments
  - Auth required
- `DELETE /phones/{phoneId}/locations/{locationId}` - Unassign from location
  - Removes single phone-location assignment
  - 404 if assignment not found
  - Auth required
- `PATCH /phones/{phoneId}/locations/{locationId}` - Update assignment
  - Request: isPrimary (boolean)
  - If setting primary, unsets other primary phones
  - Transaction-safe
  - Returns updated phone
  - Auth required

### Schemas

**Request Schemas:**
- `phoneCreateSchema`: phoneNumber (7-20 chars, flexible format), displayFormat (optional)
- `phoneLocationAssignSchema`: locationIds (string[] min 1), isPrimary (default false)
- `phoneLocationUpdateSchema`: isPrimary (boolean)

**Response Schema:**
- `phoneSchema`: Full phone response with ISO timestamps, optional locations array
- `phoneLocationSchema`: Location details (id, name, isPrimary)

### Service Layer (phone-service.ts)

**Functions:**
1. `listPhones(orgId)` - Cursor-ordered listing with location includes
2. `createPhone(orgId, data)` - Creates phone or reactivates soft-deleted
3. `getPhone(orgId, phoneId)` - Single fetch with org isolation
4. `deletePhone(orgId, phoneId)` - Soft delete with cascade
5. `assignToLocations(orgId, phoneId, locationIds, isPrimary)` - Multi-location assignment
6. `unassignFromLocation(orgId, phoneId, locationId)` - Single unassign
7. `updateAssignment(orgId, phoneId, locationId, isPrimary)` - Primary flag update

**Key Patterns:**
- Transaction-safe exclusive primary enforcement (one primary per location)
- Org isolation on all database operations
- Soft deletes with reactivation support
- Location existence validation before assignment
- Cascade delete on phone delete (cleanup LocationPhone records)

### Error Handling

| Status | Scenario |
|--------|----------|
| 404 | Phone not found, location not found, assignment not found |
| 409 | Phone already exists (active), duplicate in same org |
| 400 | Invalid location IDs, validation errors |
| 401/403 | Missing/invalid auth, org mismatch |
| 200 | Success responses with phone data |

### Features

- **Flexible Format:** Phone numbers accept any 7-20 char format (no E.164 enforcement)
- **Display Format:** Optional pretty-printing (e.g., "(555) 123-4567")
- **Soft Deletes:** Soft-deleted phones can be reactivated via re-create
- **Primary Selection:** Exclusive primary phone per location with transaction safety
- **Multi-Location:** Single phone assignable to multiple locations
- **Cascade Delete:** Removing phone cascades to remove all location assignments
- **Org Isolation:** All queries filtered by organizationId

## Location Business Hours API (Phase 11)

**Endpoint Pattern:** `PUT/POST/PATCH/DELETE /locations/{locationId}/hours/*`

**Data Models:**
- **RecurringHours**: Weekly schedule per `dayOfWeek` (SUNDAY-SATURDAY) with `timeSegments` & closed reasons
- **HoursOverride**: Single-day exceptions with override reason (VACATION, SICK, CLOSED, OTHER)

**Key Operations:**
```
PUT /locations/{locationId}/hours/{dayOfWeek}      # Update recurring day
POST /locations/{locationId}/hours/overrides       # Create single-day override
PATCH /locations/{locationId}/hours/overrides/{id} # Update override
DELETE /locations/{locationId}/hours/overrides/{id} # Delete override
```

**Frontend Integration (BusinessHoursCard):**
- Queries via `useGetLocationsLocationIdHours` (TanStack Query hook)
- Mutations via `useBusinessHoursMutations` custom hook (encapsulates all API calls)
- Data transform via `businessHoursTransformer` util (recurring + overrides → week view)
- Modal flows for editing (shift selection, override reason, date picking)

**Response Format:**
```json
{
  "data": {
    "locationId": "cloc_123",
    "recurring": [
      {
        "dayOfWeek": "MONDAY",
        "isOpen": true,
        "timeSegments": [
          { "openTime": "09:00", "closeTime": "17:00" },
          { "openTime": "19:00", "closeTime": "21:00" }
        ]
      }
    ],
    "overrides": [
      {
        "id": "clhr_456",
        "overrideDate": "2025-12-25",
        "isOpen": false,
        "closedReason": "CLOSED",
        "closedDetails": null
      }
    ]
  }
}
```

## Frontend Module Architecture (Phase 11 - UI Refactoring)

**Goal:** Modular feature development with strict <200-line component limit.

**Pattern Applied:** Business Setup module demonstrates best practices for large features:

1. **Constants** (`constants.ts`) - Enums, route lists, menu items
2. **Hooks** (`hooks/use-*`) - API mutations + query management
3. **Utils** (`utils/*-transformer.ts`, `*-validator.ts`) - Pure functions
4. **Components** (`components/*`) - Reusable UI pieces (sidebars, headers)
5. **Tabs** (`tabs/*-card.tsx`) - Page sections (<200 lines each)
6. **Modals** (shared from parent modules) - Dialog workflows

**Example: Business Setup Module**
```
business-setup/
├── constants.ts (routes, menu items, DAYS_OF_WEEK)
├── hooks/use-business-hours-mutations.tsx (save/delete/override logic)
├── utils/business-hours-transformer.ts (API → week view format)
├── components/business-setup-sidebar.tsx (shared nav)
└── tabs/business-hours-card.tsx (170 lines, single responsibility)
```

**Benefits:**
- Maintainability: Each file has single purpose
- Testability: Pure functions in utils, isolated hooks
- Reusability: Sidebar shared across related pages
- Scalability: Easy to add new tabs/pages following same structure
- Compliance: All components enforce <200-line standard

