# Ella - Project Overview & Product Development Requirements

**Current Phase:** 1.2 - Backend API Endpoints (Completed)
**Last Updated:** 2026-01-13

## Project Vision

Ella is a modern, tax-focused SaaS application designed to streamline document management and compliance workflows. Built as a monorepo with TypeScript, it prioritizes type safety, scalability, and developer experience.

## High-Level Goals

1. **Document Management** - Centralized storage and organization of tax-related documents
2. **Compliance Tracking** - Automated compliance monitoring and deadline alerts
3. **User Efficiency** - Intuitive UI reducing manual data entry and errors
4. **Scalability** - Distributed backend serving multiple clients concurrently

## Product Development Requirements (PDR)

### Phase 1: Foundation (COMPLETED)

**Objective:** Establish project structure and tooling

**Requirements Met:**

- Monorepo setup with pnpm workspaces
- Turbo build orchestration
- TypeScript configuration across all packages
- Git workflow established

### Phase 1.1: Database Schema Design (COMPLETED)

**Status:** Completed

**Objective:** Design and implement complete Prisma database schema for tax case management

**Requirements Met:**

- [x] 12 core models for tax case workflow
- [x] 12 enums for tax forms, document types, and statuses
- [x] Proper indexing and constraints for data integrity
- [x] Seed script with 25 checklist templates
- [x] Support for multi-language (VI/EN) and multiple tax forms (1040, 1120S, 1065)

**Functional Features:**

- Staff & Client management with role-based access
- TaxCase workflow from INTAKE to FILED
- Document upload & classification with AI confidence scoring
- Checklist template system with conditional requirements
- Conversation & messaging for client communication
- Magic links for passwordless access
- Action tracking for staff tasks and reminders

**Deliverables:**

- `packages/db/prisma/schema.prisma` - 402 lines, complete schema
- `packages/db/prisma/seed.ts` - Checklist template seeder (25 records)
- Updated package.json with seed script
- Proper migrations via Prisma CLI

### Phase 2: Package Setup (COMPLETED)

**Objective:** Establish core shared packages

#### Requirement 2.1: Database Package (@ella/db)

**Status:** Completed

**Functional Requirements:**

- [x] Prisma ORM integration
- [x] PostgreSQL datasource configuration
- [x] Singleton client pattern preventing connection leaks
- [x] Schema versioning via migrations
- [x] Type generation for TypeScript

**Acceptance Criteria:**

- [x] `pnpm -F @ella/db generate` generates Prisma client to `src/generated`
- [x] Connection pooling safe for development and production
- [x] Schema includes User model with timestamps
- [x] Export from `@ella/db` provides both client and types

**Technical Specs:**

- Prisma version: ^6.7.0
- Database: PostgreSQL
- Output path: `packages/db/src/generated/`
- Logging: Dev (query logs) / Production (silent)

#### Requirement 2.2: Shared Types Package (@ella/shared)

**Status:** Completed

**Functional Requirements:**

- [x] Zod validation schemas for common types
- [x] TypeScript type definitions
- [x] API response wrapper schema
- [x] Pagination utilities
- [x] Type inference from schemas

**Acceptance Criteria:**

- [x] Exports available via `@ella/shared/schemas` and `@ella/shared/types`
- [x] Zod validates: email, phone, UUID formats
- [x] apiResponseSchema provides success/error structure
- [x] Pagination defaults: page=1, limit=20, max=100

**Technical Specs:**

- Zod version: ^3.24.1
- Export paths configured in package.json
- Type-safe inference via `z.infer<typeof schema>`

#### Requirement 2.3: UI Components Package (@ella/ui)

**Status:** Completed

**Functional Requirements:**

- [x] shadcn/ui integration setup
- [x] Button component exported
- [x] Tailwind CSS v4 configuration
- [x] Utility function for class merging
- [x] Global stylesheet

**Acceptance Criteria:**

- [x] Button component renders with accessibility (Radix primitives)
- [x] Tailwind configured with neutral baseColor
- [x] `cn()` utility merges Tailwind classes without conflicts
- [x] Components can be imported via `@ella/ui`

**Technical Specs:**

- Tailwind v4.0.0+
- Radix UI via shadcn/ui registry
- class-variance-authority for variants
- Component variants pattern implemented

### Phase 1.2: Backend API Endpoints (COMPLETED)

**Status:** Completed 2026-01-13

**Objective:** Implement REST API with complete route coverage for tax case management

**Requirements Met:**

- [x] Hono API server on PORT 3001
- [x] 24 endpoints across 7 route modules (clients, cases, docs, actions, messages, portal, health)
- [x] Request validation via Zod + @hono/zod-validator
- [x] Prisma database integration via @ella/db
- [x] Global error handler middleware
- [x] OpenAPI documentation at `/doc` endpoint
- [x] Scalar API UI for interactive testing at `/docs`
- [x] CORS configured for frontend localhost ports
- [x] Pagination helpers & Vietnamese label constants
- [x] Service layer for business logic

**Acceptance Criteria Met:**

- [x] Server starts on PORT 3001
- [x] All endpoints validated via Zod
- [x] Prisma queries typed and type-safe
- [x] Error responses with HTTP status codes & descriptive messages
- [x] Endpoints testable via Scalar UI
- [x] Request logging via hono/logger middleware
- [x] Pagination support on all list endpoints

**Deliverables:**

- Client CRUD with profile & automatic checklist generation
- Tax case management with status tracking & document counts
- Digital document endpoints for classification, OCR, verification
- Action queue for staff task management
- Message/conversation endpoints for client communication
- Magic link portal for passwordless client access
- Health check for monitoring

### Phase 3: Frontend Application

**Status:** Pending

**Objective:** Build React frontend with API integration

**Planned Requirements:**

- React 19+ application with Vite
- TanStack Router for file-based routing
- Components from @ella/ui library
- React Query for server state management
- Authentication flow integration
- API client for backend communication
- Form validation with Zod from @ella/shared

**Acceptance Criteria:**

- [ ] Server starts on configured port
- [ ] Frontend communicates with API successfully
- [ ] Authentication system integrated (Clerk)
- [ ] Login/signup flows working
- [ ] Type-safe API calls via shared schemas
- [ ] Responsive design on mobile

### Phase 5: Features & Polish

**Status:** Pending

**Planned Features:**

- Compliance deadline tracking
- Automated email notifications
- Document OCR for data extraction
- Multi-user collaboration
- Role-based access control (Admin/User/Client)
- Audit logging
- Export functionality (PDF, CSV)
- Analytics dashboard

## Non-Functional Requirements

### Performance

- **API Response Time:** < 200ms for 95th percentile
- **Page Load Time:** < 3s (including assets)
- **Database Query Time:** < 50ms average

### Security

- **Authentication:** JWT with secure refresh token rotation
- **Data Encryption:** HTTPS only, encrypted at-rest for sensitive fields
- **Input Validation:** All inputs validated via Zod
- **SQL Injection Prevention:** Parameterized queries (Prisma enforces)
- **CSRF Protection:** CSRF tokens for state-changing requests

### Scalability

- **Horizontal Scaling:** Stateless API design
- **Database:** Connection pooling for concurrent users
- **Caching:** Redis for session/document caching (future)
- **CDN:** Static assets via CDN (future)

### Maintainability

- **Type Safety:** 100% TypeScript strict mode
- **Documentation:** Code comments explain "why", docs explain "how"
- **Testing:** Unit & integration tests for critical paths
- **Code Reviews:** All merges require review
- **Monitoring:** Error tracking & performance monitoring (future)

## Technology Stack

| Layer           | Technology      | Version |
| --------------- | --------------- | ------- |
| Language        | TypeScript      | 5.7.3+  |
| Package Manager | pnpm            | Latest  |
| Monorepo        | Turbo           | Latest  |
| Database        | PostgreSQL      | 14+     |
| ORM             | Prisma          | 6.7.0   |
| Validation      | Zod             | 3.24.1  |
| Backend         | Hono            | 4.6.15+ |
| Frontend        | React           | 18+     |
| Styling         | Tailwind CSS    | 4.0.0+  |
| Components      | shadcn/ui       | Latest  |
| Routing         | TanStack Router | Latest  |

## Deliverables by Phase

| Phase | Deliverable                                  | Status     |
| ----- | -------------------------------------------- | ---------- |
| 1     | Monorepo structure, TypeScript config        | ✓ Complete |
| 1.1   | Complete database schema (12 models, 12 enums) | ✓ Complete |
| 1.2   | Backend API with 24 endpoints                | ✓ Complete |
| 2     | @ella/db, @ella/shared, @ella/ui             | ✓ Complete |
| 3     | Frontend React app with routing              | - Pending  |
| 4     | Full feature set & polish                    | - Pending  |
| 5     | Production deployment & monitoring           | - Pending  |

## Success Metrics

**Development:**

- All packages type-check without errors
- All workspace exports resolve correctly
- Database migrations run without conflicts
- Zero package.json dependency conflicts

**Product:**

- API response time < 200ms (95th percentile)
- Frontend Core Web Vitals all green
- 95%+ test coverage for critical paths
- Zero unhandled errors in production

## Risk Assessment

| Risk                     | Impact | Mitigation                            |
| ------------------------ | ------ | ------------------------------------- |
| Database scaling         | High   | Connection pooling, indexing strategy |
| Complex schema evolution | Medium | Review migrations before production   |
| Type safety gaps         | Medium | Strict TypeScript, Zod validation     |
| Frontend performance     | Medium | Lazy loading, code splitting          |

## Timeline

- **Phase 1.1 (Current):** Jan 12, 2026 - Database schema design
- **Phase 3 (Next):** Jan 2026 - Backend API implementation
- **Phase 4:** Feb 2026 - Frontend React apps
- **Phase 5:** Feb-Mar 2026 - Features & polish
- **Launch:** Mar 2026

## Documentation Structure

```
docs/
├── codebase-summary.md        # Current phase overview
├── code-standards.md          # Development guidelines
├── project-overview-pdr.md    # This file
├── system-architecture.md     # Technical architecture
├── deployment-guide.md        # Deployment instructions
├── design-guidelines.md       # UI/UX standards
└── project-roadmap.md         # Future planning
```

## Next Steps

### For Development Team (Phase 1.2 Complete → Phase 3)

1. Start API server: `pnpm -F @ella/api dev` (runs on PORT 3001)
2. Test endpoints via Scalar UI: http://localhost:3001/docs
3. Begin Phase 3: Frontend React application
   - Set up API client with type safety from @ella/shared
   - Implement authentication flow (Clerk integration)
   - Build client intake form with profile wizard
   - Create case dashboard with document upload
   - Add checklist status tracking UI
   - Implement message/conversation UI

### For Product Team

1. Finalize feature requirements for Phase 3-5
2. Create detailed wireframes for frontend
3. Define compliance rules & deadline logic
4. Plan notification system architecture

### For DevOps

1. Set up PostgreSQL staging/production databases
2. Configure CI/CD pipeline
3. Set up monitoring & logging infrastructure
4. Plan deployment automation

---

**Document Version:** 1.2
**Created:** 2026-01-11
**Maintained By:** Documentation Manager
**Last Review:** 2026-01-13
