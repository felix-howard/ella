# Ella - Codebase Summary (Quick Reference)

**Current Date:** 2026-02-04
**Current Branch:** feature/landing-page
**Latest Phase:** Landing Page Phase 06 COMPLETE | Phase 05 COMPLETE | Phase 3 Multi-Tenancy COMPLETE | Phase 6 Frontend Auth COMPLETE | Schedule C Phase 4 COMPLETE

## Project Status Overview

| Phase | Status | Completed |
|-------|--------|-----------|
| **Landing Page Phase 06: Why Ella Page** | **Why Ella page (why-ella.astro) with pain points (4 cards), solutions (4 cards), before/after comparison (3 metrics), differentiators (4 stats), company metrics, CTA. Shared icon-card component, shared icon library (checkPath, xPath). Pricing & Features pages refactored to use shared icons.** | **2026-02-04** |
| **Landing Page Phase 05: Pricing Page** | **Pricing page with 3 tiers (Starter $99, Professional $299, Enterprise Custom), "Most Popular" badge, feature comparison table (12 rows), FAQ (8 items, 2-col), bottom CTA. SEO: BreadcrumbList, FAQPage, Product schemas. Mobile responsive with scroll hints.** | **2026-02-04** |
| **Landing Page Phase 03: Full Home Page** | **Home page (index.astro) rebuilt with 7 sections: Hero (outcome-focused), Stats (1M docs, 500 firms, 99% accuracy, 80% time saved), Features (AI Classification, Smart OCR, Client Portal, Team Collaboration), How It Works (3-step process), Testimonials (3 quotes), CTA section, Contact Form. Structured data schemas added (aggregateRatingSchema). Brand color updated to emerald. OG image (1200x630px gradient). Astro + accessibility complete.** | **2026-02-04** |
| **Landing Page Phase 02: Shared Components** | **8 Astro components (Navbar, Footer, SectionHeading, CTASection, FeatureCard, TestimonialCard, StatsBar, ContactForm), shared nav config, base layout with skip-to-content, site config (formspreeId, linkedIn)** | **2026-02-04** |
| **Phase 3: Multi-Tenancy & Permission System** | **Database schema (Org/ClientAssignment models), 12 API endpoints, org-scoped filtering, frontend Team page, Clerk JWT auth, RBAC via roles, 26 tests, i18n 821 keys** | **2026-02-04** |
| **Phase 6: Frontend Auth & Navigation** | **useAutoOrgSelection hook, ClerkAuthProvider, sidebar org name, useOrgRole RBAC, Team nav conditional, accept-invitation page, full i18n (EN/VI)** | **2026-02-04** |
| **Schedule C Phase 4: 1099-NEC Breakdown** | **Per-payer NEC breakdown display, nec-breakdown-list component, getGrossReceiptsBreakdown() backend, auto-update DRAFT forms, 6 tests, income table dynamic labeling** | **2026-01-29** |
| **Schedule C Phase 3: Portal Expense Form** | **18 files, 2,400 LOC, 10 UI components, 28 IRS categories, auto-save, accessibility, version history. Tests: 578/578 passing** | **2026-01-28** |
| **Phase 2: Multi-Year Engagement (8.1-8.4)** | **TaxEngagement model (year-specific), backfill completed, API CRUD (6 endpoints), engagement-helpers service. Tests: 464/464 passing** | **2026-01-26** |
| **Simplify Client Workflow (Phases 1-4)** | **2-step wizard client creation, Files tab (8 components), YearSwitcher + CreateEngagementModal, integration & testing. Code review 9.5/10** | **2026-01-27** |
| **Voice Calls (Phases 01-04)** | **Backend: Token generation, TwiML routing, webhooks (54 tests). Frontend: Twilio SDK, useVoiceCall hook, incoming call modal. Recording endpoints with AudioPlayer** | **2026-01-22** |
| **Actionable Client Status** | **Database: isInReview/isFiled/lastActivityAt flags. API: Status endpoints, enhanced GET /clients. Frontend: StatusBadge, sorting (activity/name/stale), action buttons. Constants centralized** | **2026-01-22** |
| **AI Document Processing** | **Gemini 2.0-flash integration (image validation, retry logic, batch concurrency). Classification service. 11 OCR prompts (W2, 1099s, K-1, Bank, 1098, 1095-A). Tests: 88/88 passing** | **2026-01-17** |

## Tech Stack (Current)

| Layer | Technology | Version |
|-------|------------|---------|
| Language | TypeScript | 5.7.3+ |
| Frontend (React) | React + Vite + TanStack Router | 19.0.0 / 1.94+ |
| Auth | Clerk | 5.59.3 |
| Backend (Hono) | Hono + Zod + OpenAPI | 4.6.15+ |
| Database | Prisma + PostgreSQL | 6.7.0 / 14+ |
| AI/OCR | Google Gemini | 2.0-flash |
| Styling | Tailwind CSS 4 + shadcn/ui | 4.0.0+ |
| Voice | Twilio SDK | Latest |
| File Storage | Cloudflare R2 | In use |

## Database Schema (Current)

**Core Models:**
- **Organization**: clerkOrgId (unique), name, slug, logoUrl, isActive. Org-scoped root.
- **Client**: organizationId FK, name, phone, email, language, intakeAnswers Json, status tracking
- **Staff**: organizationId FK, clerkId (unique), userId, role (ADMIN|STAFF|CPA), isActive
- **ClientAssignment**: clientId + staffId (unique composite), organizationId FK. 1-to-1 staff-client mapping.
- **TaxCase**: caseId, engagementId FK, taxYear, status (INTAKE→FILED), caseDocs[], checklistItems[]
- **TaxEngagement**: engagementId, clientId FK, taxYear, year-specific profile fields, status
- **ScheduleCExpense**: 20+ expense fields, vehicle info, version history tracking, gross receipts from 1099-NEC
- **RawImage**: documentId, classification (UPLOADED|UNCLASSIFIED|CLASSIFIED|DUPLICATE|VERIFIED), aiConfidence, category
- **DigitalDoc**: Extracted OCR fields, source reference, AI confidence
- **MagicLink**: type (PORTAL|SCHEDULE_C), token, caseId/type, isActive, expiresAt
- **Message**: conversationId, channel (SMS|PORTAL|SYSTEM|CALL), content, callSid/recordingUrl
- **AuditLog**: entityType, entityId, field, oldValue, newValue, changedById, timestamp (complete trail)
- **Action**: actionType, priority, caseId, dueDate, status, completedBy

## API Endpoints (12 Organization/Team)

**Organization & Team Management:**
- `GET /team/members` - List org staff with role + status
- `POST /team/invite` - Send Clerk org invitation, track in DB
- `PATCH /team/members/:staffId/role` - Update role (ADMIN|STAFF), sync with Clerk
- `DELETE /team/members/:staffId` - Deactivate staff member
- `GET /team/invitations` - List pending Clerk org invites
- `DELETE /team/invitations/:invitationId` - Revoke invitation

**Client Assignments:**
- `GET /client-assignments` - List org's staff-client mappings
- `POST /client-assignments` - Create 1-to-1 assignment
- `DELETE /client-assignments/:assignmentId` - Unassign staff from client
- `POST /client-assignments/bulk` - Bulk create assignments
- `PUT /client-assignments/transfer` - Transfer client between staff
- `GET /team/members/:staffId/assignments` - Staff's assigned clients

## Frontend Architecture

**Landing Page (Astro):**
- **Home Page (Phase 03):** 7-section layout (Hero, Stats, Features, How It Works, Testimonials, CTA, Contact Form)
  - Hero: Outcome-focused headline (cut doc collection time by 75%)
  - Stats: 1M documents processed, 500 tax firms, 99% accuracy, 80% time saved
  - Features: 4 cards (AI Classification 89+ docs, Smart OCR for income data, Client Portal magic link, Team Collaboration RBAC)
  - How It Works: 3-step process (Send Link → AI Classifies → Review & Prepare)
  - Testimonials: 3 CPA/EA quotes with 5-star implied rating
  - Contact Form: Formspree integration for lead capture
- **Pricing Page (Phase 05):** 3-tier pricing (Starter $99, Professional $299, Enterprise Custom)
  - "Most Popular" badge on Professional tier with elevated styling
  - Feature comparison table (12 rows, horizontal scroll on mobile)
  - FAQ section (8 items, 2-column grid)
  - Bottom CTA "Still have questions?"
  - SEO: BreadcrumbList, FAQPage, Product schema for each tier
- **Why Ella Page (Phase 06):** Problem-solution narrative with proof points
  - Pain Points: 4 cards (Time-consuming doc collection, Manual classification errors, Compliance gaps, Scalability bottleneck)
  - Solutions: 4 cards (Instant AI classification, Zero manual work, Built-in compliance, Auto-scales infinitely)
  - Before/After: 3 metrics (30min → 5min doc collection, 15% errors → <1%, 2 months → 1 week)
  - Differentiators: 4 competitive advantages (Best-in-class AI, CPA-built not SWE-built, Highest accuracy, Enterprise-ready)
  - Company Metrics: Usage stats (1M docs processed, 500 firms, 99% accuracy, 80% time saved)
  - CTA: "Join the revolution" with email signup
- **Shared Components:** Navbar, Footer, SectionHeading, CTASection, FeatureCard, TestimonialCard, StatsBar, ContactForm, IconCard
- **Shared Icons:** lib/icons.ts with checkPath, xPath for reusable icon assets
- **Shared Config:** NavLinks (Home, Features, Pricing, Why Ella, About), LegalLinks (Privacy, Terms)
- **Base Layout:** HTML shell, global CSS, skip-to-content link, SEO slot, theme color, favicon
- **Site Config:** Organization metadata, social links (Twitter, LinkedIn), Formspree integration
- **SEO & Branding:** Structured data (Organization, Website, SoftwareApplication, AggregateRating), OG image (1200x630px emerald gradient), favicon (emerald green)

**Key Pages (Workspace):**
- `/team` - Team member management (member table, invite dialog, bulk assign)
- `/clients`, `/clients/:id`, `/cases/:id`, `/messages`, `/actions` - Core workflows
- `/accept-invitation` - Clerk org invite sign-in/sign-up flow

**Authentication (Phase 6):**
- `ClerkAuthProvider` (clerk-auth-provider.tsx) - Wraps root, sets JWT token getter, clears cache on sign-out
- `useAutoOrgSelection()` - Auto-selects first Clerk org on sign-in
- `useOrgRole()` - Returns { isAdmin, role }, conditional Team nav visibility
- Zero-org edge case: Shows localized fallback UI (org.noOrg / org.noOrgDesc)

**Sidebar Enhancement:**
- Displays current org name via `useOrganization()` hook
- Role badge (ADMIN/STAFF) next to user info
- Team menu visible only to org admins

**Key Components:**
- Team page: Member table + invite dialog + bulk assign panel
- Sidebar: Org name, role badge, conditional navigation
- Accept-invitation page: Seamless Clerk org acceptance flow
- Team assignment panel: View/edit client assignments

**Org-Scoped Queries:**
- `buildClientScopeFilter(user)` - Core scoping function
- Admins: See all org clients
- Staff: See only assigned clients via ClientAssignment
- Applied to all entity queries (Clients, Cases, Engagements, Messages, Docs, Images, Actions)

## API Client & Endpoints (Frontend)

**Team Endpoints (15+ methods):**
- Members: list, invite, updateRole, deactivate
- Invitations: list, revoke
- Assignments: list, create, delete, bulkCreate, transfer, getStaffAssignments

**Request/Response:**
- Org context via Bearer JWT token (Clerk JWT includes orgId)
- Retry logic: 3 attempts, exponential backoff
- Error handling: Zod validation, type-safe responses
- Pagination: limit=20, max=100 support

## Localization (i18n)

**Coverage:** 821 keys across English (en.json) + Vietnamese (vi.json)

**Team Management Keys:**
- team.members, team.inviteDialog, team.roles, team.assignments
- org.name, org.noOrg, org.noOrgDesc (zero-org fallback)

**Schedule C Keys:**
- expenseForm.categories, expenseForm.vehicle, expenseForm.autoSave, schedule.lockForm

## Auth Flow (Clerk JWT)

**Token Parsing:**
- userId, orgId, orgRole extracted from Clerk JWT
- `syncOrganization()` - Upsert Clerk org to DB (5-min cache)
- `syncStaffFromClerk()` - Create/update Staff, maps org:admin → ADMIN role

**Middleware:**
- `requireOrg` - Verify orgId in token, attach to context
- `requireOrgAdmin` - Verify org:admin role, restrict endpoint
- All team/org endpoints protected

## Multi-Tenancy Security

**Data Isolation:**
- All queries scoped by organizationId
- `buildClientScopeFilter()` applies Admin vs Staff filtering
- ClientAssignment enforces staff-client relationships
- Audit logging tracks all org-scoped changes

**Permission Model:**
- ADMIN: Full org access, manage team + client assignments
- STAFF: Assigned clients only, no team management
- CPA: Future role for CPA firm integrations

## Key Utilities & Patterns

**Shared (TypeScript):**
- TaxYear helpers, IntakeAnswers interface (100+ fields)
- ConditionEvaluator (AND/OR logic), ChecklistTemplate rules
- Engagement helpers service
- AuditLog schema + type-safe queries

**Backend (Hono):**
- Zod OpenAPI validation (all inputs + outputs)
- Prisma ORM with connection pooling
- Error handler middleware (standardized responses)
- Signature validation for Twilio webhooks

**Frontend (React):**
- useQuery (React Query) for server state
- Zustand stores (UI state persistence)
- TanStack Router (file-based routing)
- Tailwind CSS 4.0 (utility-first styling)

## Testing & Quality

- **API Tests:** 26+ comprehensive team/org tests, Clerk Backend SDK mocking
- **Frontend Tests:** Component integration tests, hook testing
- **Total Test Coverage:** 578+ tests across portal form, schedule C, voice calls
- **Type Check:** 100% TypeScript strict mode, zero errors
- **Build:** Success with no warnings
- **Code Review Avg:** 9/10 quality score

## Recent Phases Summary

**2026-02-04:** Landing Page Phase 06 complete. Why Ella page (why-ella.astro) with pain points (4 cards), solutions (4 cards), before/after metrics (3 rows), differentiators (4 stats), company metrics, CTA. Shared IconCard component. Shared icon library (checkPath, xPath). Pricing & Features pages refactored to use shared icons (DRY pattern).

**2026-02-04:** Landing Page Phase 05 complete. Pricing page with 3 tiers (Starter $99, Professional $299, Enterprise Custom), comparison table (12 rows), FAQ (8 items), SEO schemas (BreadcrumbList, FAQPage, Product).

**2026-02-04:** Landing Page Phase 03 complete. Full home page (index.astro) rebuilt with 7 sections: Hero, Stats (1M docs, 500 firms, 99%, 80%), Features (4 cards), How It Works (3 steps), Testimonials (3 quotes), CTA, Contact Form. Structured data (aggregateRatingSchema) added. Brand color to emerald, OG image updated.

**2026-02-04:** Landing Page Phase 02 complete. 8 shared Astro components, shared nav config, base layout integration.

**2026-02-04:** Multi-Tenancy complete. Org model, 12 API endpoints, frontend auth/nav, RBAC, i18n.

**2026-01-29:** Schedule C Phase 4. 1099-NEC breakdown UI, backend calculations, form auto-updates.

**2026-01-28:** Schedule C Phase 3. Portal expense form (2,400 LOC), 28 IRS categories, auto-save.

**2026-01-27:** Simplify Client Workflow. 2-step wizard, Files tab (8 components), multi-year engagement.

**2026-01-22:** Voice Calls Phases 01-04 complete. Backend webhooks, frontend Twilio SDK, recording playback.

**2026-01-21:** Actionable Status. Database flags, API endpoints, status badges, activity sorting.

## Next Steps

1. **Landing Page Phase 07** - Additional page templates (About page, Blog overview)
2. **Landing Page Deployment** - Staging → Production deployment & DNS routing
3. **Schedule C Phase 5** - Workspace Schedule C tab (case detail integration)
4. **Voice Calls Phase 5** - Enhanced incoming call routing, better presence tracking
5. **Team Assignment Workflows** - Bulk operations, transfer auditing

---

**Version:** 2.5
**Created:** 2026-01-11
**Last Updated:** 2026-02-04
**Maintained By:** Documentation Manager
**Status:** Production-ready with Multi-Tenancy & Permission System complete
