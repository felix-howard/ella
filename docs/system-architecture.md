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
│  - ClientAssignments (staff-client mappings)    │
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
- `/clients/:id` - Client detail (overview + documents tabs)
- `/cases/:id` - Tax case with checklist & documents
- `/messages` - Unified inbox with split-view conversations
- `/actions` - Action queue with priority filtering
- `/team` - Team member management (Phase 3)
- `/accept-invitation` - Clerk org invite acceptance (Phase 6)

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
- Org context: Bearer JWT includes orgId
- Retry logic: 3 attempts, exponential backoff
- Pagination: limit=20, max=100

## Backend Layer

**Technology:** Hono 4.6+, Node.js, @hono/zod-openapi, Prisma

**Structure:**
- Entry: `src/index.ts` (PORT 3002, Gemini validation)
- App: `src/app.ts` (Hono instance, all routes)
- Middleware: Error handler, request logging
- Routes: `src/routes/{team,clients,cases,docs,messages,voice,webhooks}/`
- Services: `src/services/{auth,org,ai,webhook-handlers}/`
- Database: `src/lib/db.ts` (Prisma singleton)

**Endpoints (70+ total):**

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

**Team & Organization (12 - Phase 3):**
- `GET /team/members` - List org staff
- `POST /team/invite` - Send Clerk org invitation
- `PATCH /team/members/:staffId/role` - Update role
- `DELETE /team/members/:staffId` - Deactivate staff
- `GET /client-assignments` - List staff-client mappings
- `POST /client-assignments` - Create assignment
- `POST /client-assignments/bulk` - Bulk assign
- `PUT /client-assignments/transfer` - Transfer client
- Similar for invitations & staff assignments

**Clients (8):**
- `GET /clients` - List with org scoping + sort
- `POST /clients` - Create with organization
- `GET /clients/:id` - Detail with org verification
- `PATCH /clients/:id` - Update profile/intakeAnswers
- `DELETE /clients/:id` - Deactivate
- `GET /clients/:id/resend-sms` - Resend welcome link
- Status endpoints for action tracking

**Cases & Engagements (14):**
- `GET /engagements` - List org engagements
- `POST /engagements` - Create (with copy-from for year reuse)
- `GET /engagements/:id` - Engagement detail
- `PATCH /engagements/:id` - Update profile
- `GET /cases/:id` - Case detail with checklist
- `PATCH /cases/:id` - Update case status
- Actions for compliance tracking

**Documents & Classification (12):**
- `POST /documents/upload` - Upload images
- `POST /documents/classify` - Trigger AI classification
- `GET /documents/:id` - Document detail
- `PATCH /documents/:id/verify` - Mark verified with extracted fields
- `GET /documents/:id/ocr` - Request OCR extraction
- Endpoints for document lifecycle

**Messages & Voice (15):**
- `GET /messages` - List conversations (org-scoped)
- `POST /messages` - Send SMS/portal/system message
- `GET /conversations/:id/messages` - Thread detail
- `POST /voice/token` - Generate Twilio token (VoiceGrant)
- `POST /voice/presence/register` - Register staff online
- `GET /voice/caller/:phone` - Lookup incoming caller
- Recording endpoints with auth

**Webhooks:**
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
    ├── Client[] (org clients)
    ├── ClientAssignment[] (staff-client mappings)
    └── Audit[] (all changes)
```

**Data Scoping:**
- `buildClientScopeFilter(user)` - Core scoping function
- **Admin:** See all org clients
- **Staff:** See only assigned clients via ClientAssignment
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
- **Organization** - Org root with Clerk integration
- **Staff** - organizationId FK, clerkId (unique), role (ADMIN|STAFF|CPA)
- **Client** - organizationId FK, profile data, intakeAnswers Json
- **ClientAssignment** - Unique (clientId, staffId), organizationId FK
- **TaxCase** - Year-specific tax case, engagementId FK
- **TaxEngagement** - Year-specific engagement (copy-from support)
- **ScheduleCExpense** - 20+ fields, version history
- **ScheduleEExpense** - 1:1 with TaxCase. Status (DRAFT/SUBMITTED/LOCKED), up to 3 rental properties (JSON array), 7 IRS expense fields (insurance, mortgage interest, repairs, taxes, utilities, management fees, cleaning/maintenance), custom expense list, version history, property-level totals
- **RawImage** - Classification states, AI confidence, perceptual hash, re-upload tracking, relationships to documentViews
- **DocumentView** - Staff document view tracking (staffId + rawImageId unique composite). Tracks which staff members viewed which RawImage documents with timestamp (viewedAt). Enables per-CPA "new upload" badge calculations and document engagement metrics.
- **DigitalDoc** - OCR extracted fields
- **MagicLink** - type (PORTAL|SCHEDULE_C|SCHEDULE_E), token, caseId/type reference, isActive, expiresAt (7-day TTL)
- **Message** - SMS/PORTAL/SYSTEM/CALL channels
- **AuditLog** - Complete change trail

**Indexes:**
- Organization: clerkOrgId (unique), name
- Staff: organizationId + clerkId (compound unique)
- ClientAssignment: organizationId + (clientId, staffId)
- Client: organizationId + status
- Messages: conversationId + createdAt (ordering)

## Authentication Flow

**Clerk JWT Parsing:**
1. Frontend logs in via Clerk UI
2. Receives JWT with: userId, orgId, orgRole (org:admin|org:member)
3. Frontend sets JWT in Authorization header (Bearer token)
4. Backend middleware extracts claims
5. `syncOrganization()` - Upsert Clerk org to DB (5-min cache)
6. `syncStaffFromClerk()` - Create/update Staff, maps org:admin → ADMIN

**Org Verification:**
- All endpoints verify orgId from JWT matches resource org
- Staff see only assigned clients via ClientAssignment query
- Admins see all org clients

## AI Document Processing

**Gemini Integration:**
- Image validation: JPEG, PNG, WebP, HEIC (10MB max)
- Retry logic: 3 attempts, exponential backoff
- Batch processing: 3 concurrent images
- Classification: Multi-class tax form detection (89+ types)
- OCR: W2, 1099-INT, 1099-NEC, K-1, 1098, 1095-A
- Confidence scoring for verification workflow

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
├── document-classifier.ts - Classification service
├── blur-detector.ts - Quality detection
└── prompts/ - Classification + OCR templates
```

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
- ClientAssignment enforces staff-client relationships
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

**Version:** 2.1
**Last Updated:** 2026-02-04
**Status:** Multi-Tenant architecture with Clerk integration
