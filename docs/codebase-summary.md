# Ella - Codebase Summary (Quick Reference)

**Current Date:** 2026-02-05
**Current Branch:** feature/landing-page
**Latest Phase:** Landing Page Phase 03 Why Ella Updates COMPLETE | Phase 08 COMPLETE | Phase 06 COMPLETE | Phase 05 COMPLETE | Phase 3 Multi-Tenancy COMPLETE | Phase 6 Frontend Auth COMPLETE | Schedule C Phase 4 COMPLETE

## Project Status Overview

| Phase | Status | Completed |
|-------|--------|-----------|
| **Landing Page Phase 08: Animations Polish** | **Scroll-based animations (IntersectionObserver), counter animations with NaN validation, fade-up & slide-in effects, stagger timing (12 items, 0.04s increments), prefers-reduced-motion accessibility, micro-interactions (hover/focus states), data-animate & data-stagger attributes, global.css animation utilities & keyframes.** | **2026-02-05** |
| **Landing Page Killer Features - Phase 01** | **SMS-first positioning: Hero eyebrow "SMS-First Document Collection", headline "Clients text docs to your Ella number. No app. No friction." Features prioritized: SMS Direct Upload, AI Auto-Rename (first two), then Classification & OCR. How It Works flow: Client Texts Photo → AI Classifies & Renames → Review & Prepare. SEO description updated. Messaging emphasizes zero-friction SMS intake over portal upload.** | **2026-02-05** |
| **Landing Page Phase 03: Why Ella Updates** | **Expanded Why Ella page (why-ella.astro): problems (6 cards), solutions (6 cards), before/after comparison (7 items each), differentiators (6 cards). Grid layout updated: 3-col desktop (even row distribution). Enhanced data file (why-ella-data.ts) with 2 new problems (Clients Never Use Portal, File Names Are Garbage), 2 new solutions (SMS Upload, AI Auto-Rename), 2 new before/after items each, 2 new differentiators (SMS-First, Auto-Rename Intelligence). Maintained pain-solution narrative.** | **2026-02-05** |
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
- **Animations (Phase 08):** Scroll-based entrance animations, counter animations, stagger timing
  - Scroll Observer: IntersectionObserver API with 0.1-0.2 threshold, fade-up & slide-in effects
  - Counter Animations: easeOutCubic easing, 1500ms duration, NaN validation, locale-aware formatting
  - Stagger Timing: 0.04s increments across 12 child elements (0s to 0.48s delay)
  - Accessibility: prefers-reduced-motion respected, instant display of final state
  - Micro-interactions: Hover/focus states on buttons, cards, links
  - CSS Tokens: --duration-enter (0.6s), --duration-fast (0.4s), --animate-fade-up, --animate-slide-in-left
  - Attributes: data-animate, data-count, data-suffix, data-stagger on component markup
- **Home Page (Phase 03 + Killer Features Phase 01):** 7-section layout (Hero, Stats, Features, How It Works, Testimonials, CTA, Contact Form)
  - Hero: SMS-first positioning. Eyebrow "SMS-First Document Collection". Headline "Clients text docs to your Ella number. No app. No friction." Subheadline emphasizes SMS-first messaging.
  - Stats: 1M documents processed, 500 tax firms, 99% accuracy, 80% time saved (animated counters with Phase 08)
  - Features: 4 cards prioritized SMS-first. SMS Direct Upload (clients text to Ella number), AI Auto-Rename (IMG_xxx → 2024_W2_Employer_Name.pdf), AI Classification (89+ tax docs), Smart OCR (extract income data)
- **Features Page (Phase 02):** 8 detailed feature sections with alternating zigzag layout, icons, descriptions, benefits bullets, image placeholders
  - SMS Direct Upload: Clients text docs to firm's Twilio number, no app/password required, processes via AI classification
  - AI Auto-Rename: Transforms IMG_2847.jpg → structured pattern (YEAR_DOCTYPE_SOURCE_CLIENT), filters duplicates/irrelevant uploads
  - AI Classification: 89+ tax document types (W-2s, 1099s, K-1s, bank statements), 99% accuracy with confidence scoring
  - Data Extraction (OCR): Extracts income figures, employer details, dates from forms into structured fields, export to CSV or tax software
  - Client Portal Upload: Passwordless magic link, drag-drop interface, mobile-friendly, email notifications on upload
  - Team Management: Role-based access (Admin/Staff), assign clients to staff, task queues, audit trail for compliance
  - Voice & SMS: Browser-based calling via Twilio WebRTC, SMS reminders, voicemail transcription, unified message inbox
  - Multi-Year Tracking: Copy-forward previous year data, engagement history, auto-generate checklists from intake, recurring client identification
  - How It Works: 3-step SMS-focused process. (1) Client Texts Photo, (2) AI Classifies & Renames, (3) Review & Prepare
  - Testimonials: 3 CPA/EA quotes with 5-star implied rating
  - Contact Form: Formspree integration for lead capture
- **Pricing Page (Phase 05):** 3-tier pricing (Starter $99, Professional $299, Enterprise Custom)
  - "Most Popular" badge on Professional tier with elevated styling
  - Feature comparison table (12 rows, horizontal scroll on mobile)
  - FAQ section (8 items, 2-column grid)
  - Bottom CTA "Still have questions?"
  - SEO: BreadcrumbList, FAQPage, Product schema for each tier
- **Why Ella Page (Phase 03 Updates):** Problem-solution narrative with proof points
  - Pain Points: 6 cards (Endless Document Collection, Manual Classification Chaos, Data Entry Drudgery, Team Communication Gaps, Clients Never Use Your Portal, File Names Are Garbage)
  - Solutions: 6 cards (Automated Document Collection, AI-Powered Classification, Smart OCR Extraction, Built-In Team Collaboration, SMS Upload, AI Auto-Rename)
  - Before/After: 7 items each (Email clients, Sort PDFs, Type data, Unclear ownership, Phone calls, Portal adoption fails, File naming chaos → Magic link, AI classifies, OCR extracts, Clear assignments, SMS reminders, Clients text Ella, Auto-renamed files)
  - Differentiators: 6 competitive advantages (AI-First not Bolt-On, Modern Intuitive UX, All-In-One Platform, Built for Tax Professionals, SMS-First not Portal-First, Auto-Rename Intelligence)
  - Company Metrics: Usage stats (1M docs processed, 500+ firms, 99% accuracy, 80% time saved)
  - CTA: "Ready to eliminate tax season chaos?" with demo request
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

**2026-02-05:** Landing Page Phase 03 Why Ella Updates complete. Expanded problems (6 cards: added Clients Never Use Portal + File Names Are Garbage). Solutions scaled to 6 cards (added SMS Upload + AI Auto-Rename). Before/After comparison: 7 items each (added SMS reminders, Clients text Ella number, Auto-renamed files). Differentiators expanded: 6 cards (added SMS-First positioning + Auto-Rename Intelligence). Grid layout optimized: 3-col desktop (even row distribution). Why Ella data extracted to why-ella-data.ts config file (pain points, solutions, before/after items, differentiators all now in single source).

**2026-02-05:** Landing Page Killer Features Phase 01 complete. SMS-first hero messaging. Headline "Clients text docs to your Ella number. No app. No friction." Features reordered: SMS Direct Upload + AI Auto-Rename prioritized first. How It Works: 3-step SMS-focused flow (Client Texts → AI Classifies & Renames → Review & Prepare). SEO description updated to emphasize SMS-first intake. Brand alignment with emerald emerges as SMS accessibility theme.

**2026-02-05:** Landing Page Phase 08 complete. Scroll-based animations via IntersectionObserver (fade-up, slide-in effects). Counter animations with easeOutCubic easing, NaN validation, 1500ms duration. Stagger timing (12 items, 0.04s increments). Accessibility: prefers-reduced-motion respected. Micro-interactions (hover/focus). CSS animation utilities (--duration-enter, --animate-fade-up). Data attributes: data-animate, data-count, data-stagger.

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

1. **Landing Page Phase 09** - Additional page templates (About page, Blog overview) + full deployment
2. **Landing Page Deployment** - Staging → Production deployment & DNS routing (SMS-first messaging live)
3. **Schedule C Phase 5** - Workspace Schedule C tab (case detail integration)
4. **Voice Calls Phase 5** - Enhanced incoming call routing, better presence tracking
5. **Team Assignment Workflows** - Bulk operations, transfer auditing
6. **Workspace SMS Integration** - Integrate Twilio SMS direct upload feature from landing page into workspace portal

---

**Version:** 2.7
**Created:** 2026-01-11
**Last Updated:** 2026-02-05
**Maintained By:** Documentation Manager
**Status:** Production-ready with Multi-Tenancy, Landing Page Animations, & SMS-First Killer Features Phase 01 complete
