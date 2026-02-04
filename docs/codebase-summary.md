# Ella - Codebase Summary (Quick Reference)

**Current Date:** 2026-02-04
**Current Branch:** feature/landing-page
**Latest Phase:** Phase 3 Multi-Tenancy COMPLETE | Phase 6 Frontend Auth COMPLETE | Schedule C Phase 4 COMPLETE | Landing Page Phase 02 COMPLETE

## Project Status Overview

| Phase | Status | Completed |
|-------|--------|-----------|
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
- **Shared Components:** Navbar, Footer, SectionHeading, CTASection, FeatureCard, TestimonialCard, StatsBar, ContactForm
- **Shared Config:** NavLinks (Home, Features, Pricing, Why Ella, About), LegalLinks (Privacy, Terms)
- **Base Layout:** HTML shell, global CSS, skip-to-content link, SEO slot, theme color, favicon
- **Site Config:** Organization metadata, social links (Twitter, LinkedIn), Formspree integration

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

**2026-02-04:** Landing Page Phase 02 complete. 8 shared Astro components, shared nav config, base layout integration.

**2026-02-04:** Multi-Tenancy complete. Org model, 12 API endpoints, frontend auth/nav, RBAC, i18n.

**2026-01-29:** Schedule C Phase 4. 1099-NEC breakdown UI, backend calculations, form auto-updates.

**2026-01-28:** Schedule C Phase 3. Portal expense form (2,400 LOC), 28 IRS categories, auto-save.

**2026-01-27:** Simplify Client Workflow. 2-step wizard, Files tab (8 components), multi-year engagement.

**2026-01-22:** Voice Calls Phases 01-04 complete. Backend webhooks, frontend Twilio SDK, recording playback.

**2026-01-21:** Actionable Status. Database flags, API endpoints, status badges, activity sorting.

## Next Steps

1. **Landing Page Phase 03** - Page templates (Home, Features, Pricing, Why Ella, About)
2. **Deploy Multi-Tenancy to Production** - All code tested, ready for merge to main
3. **Schedule C Phase 5** - Workspace Schedule C tab (case detail integration)
4. **Voice Calls Phase 5** - Enhanced incoming call routing, better presence tracking
5. **Team Assignment Workflows** - Bulk operations, transfer auditing

---

**Version:** 2.5
**Created:** 2026-01-11
**Last Updated:** 2026-02-04
**Maintained By:** Documentation Manager
**Status:** Production-ready with Multi-Tenancy & Permission System complete
