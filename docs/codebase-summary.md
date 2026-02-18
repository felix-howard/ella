# Ella - Codebase Summary (Quick Reference)

**Current Date:** 2026-02-18
**Current Branch:** dev
**Latest Phase:** Tax Return Recognition Phase 4 COMPLETE | Tax Return Recognition Phase 3 COMPLETE | Tax Return Recognition Phase 2 COMPLETE | Tax Return Recognition Phase 1 COMPLETE | Phase 3: Hybrid PDF Viewer Enhancement COMPLETE | Mobile Responsive Admin Pages Phase 4 COMPLETE | Mobile Infrastructure Phase 1 COMPLETE | Schedule E Phase 4 Workspace Tab COMPLETE | Schedule E Phase 2 Backend API COMPLETE | Schedule E Phase 1 Backend Foundation COMPLETE | Landing Page Phase 03 Why Ella Updates COMPLETE | Phase 08 COMPLETE | Phase 06 COMPLETE

## Project Status Overview

| Phase | Status | Completed |
|-------|--------|-----------|
| **Tax Return Recognition Phase 4** | **Files UI Frontend Display: TAX_RETURNS category now integrated into workspace Files Tab UI. EDIT: `apps/workspace/src/lib/doc-categories.ts` - Added TAX_RETURNS to DocCategoryKey union type (line 19), added TAX_RETURNS config to DOC_CATEGORIES_DATA with FileText icon, amber color scheme (bg-amber-500/10, text-amber-600, border-amber-500/20), categoryLabelKey 'docCategory.taxReturns', added TAX_RETURNS to CATEGORY_ORDER array (position 3, between INCOME and EXPENSE). EDIT: `apps/workspace/src/components/files/files-tab.tsx` - TAX_RETURNS now available in byCategory filter alongside IDENTITY/INCOME/EXPENSE/ASSET/EDUCATION/HEALTHCARE/OTHER (line 135-145). EDIT: `apps/workspace/src/locales/en.json` - Added "docCategory.taxReturns": "Tax Returns" (line 275). EDIT: `apps/workspace/src/locales/vi.json` - Added "docCategory.taxReturns": "Khai Thuế" (line 275). Users can now view, filter, and drag/drop documents into TAX_RETURNS category alongside other document types. Frontend UI now fully supports Phase 1-3 database schema changes (DocCategory enum, DocType union, AI classification, OCR extraction). Category badges: amber badge with FileText icon for visual distinction. Code quality 9.2/10 (minimal changes, maintains consistency, full i18n coverage).** | **2026-02-18** |
| **Tax Return Recognition Phase 3** | **Form 1040 OCR Extraction: NEW file `apps/api/src/services/ai/prompts/ocr/form-1040.ts` with Form1040ExtractedData interface (20 fields: taxYear, formVariant, filingStatus, names/SSNs, wages, income, AGI, deductions, tax, credits, withholdings, refund/owed, attachedSchedules array). getForm1040ExtractionPrompt() function with detailed line-by-line mapping (line 1z wages, line 9 income, line 11 AGI, line 24 tax, line 33 payments, line 35a/37 refund/owed). validateForm1040Data() ensures minimum viable data (taxYear OR AGI OR tax OR refund). FORM_1040_FIELD_LABELS_VI provides Vietnamese translations for all 20 fields (AGI = "Thu nhập gộp điều chỉnh - AGI (Line 11)", etc). EDIT: `apps/api/src/services/ai/prompts/ocr/index.ts` added FORM_1040 import (form-1040 module), added Form1040ExtractedData export, added 'FORM_1040' to OcrDocType union (17 total types), added case in getOcrPromptForDocType (line 282-283), validateExtractedData (line 334-335), getFieldLabels (line 378-379). Simplified supportsOcrExtraction() to use getOcrPromptForDocType avoiding DRY violation. EDIT: `apps/api/src/services/ai/ocr-extractor.ts` added FORM_1040 key fields to keyFieldsByType map (line 241): ['adjustedGrossIncome', 'totalTax', 'taxableIncome', 'taxpayerSSN']. Supports 1040 family extraction with masked SSN handling. Code quality 9.5/10.** | **2026-02-18** |
| **Tax Return Recognition Phase 2** | **AI Classification + Prompt Enhancement: Updated `apps/api/src/services/ai/prompts/classify.ts` with comprehensive tax return classification. Added 3 few-shot examples (FORM_1040 standard, FORM_1040_X amended, STATE_TAX_RETURN CA 540) demonstrating 1040 vs 1040-X vs state return disambiguation. TAX RETURNS section in prompt documents all 7 doc types with key identifiers (form title, IRS logo, filing status checkboxes, three-column layout for amendments, state agency branding). Disambiguation rules clarify: 1040 vs 1040-X (look for "Amended"), 1040 vs 1040-SR ("SR" in form number), 1040 vs State (IRS logo vs state branding), 1040 vs Transcript (letters vs form layout). Updated `apps/api/src/services/ai/document-classifier.ts` with 7 Vietnamese labels: FORM_1040 → "Tờ khai 1040 (Liên bang)", FORM_1040_SR → "Tờ khai 1040-SR (Người cao tuổi)", FORM_1040_NR → "Tờ khai 1040-NR (Người nước ngoài)", FORM_1040_X → "Tờ khai 1040-X (Điều chỉnh)", STATE_TAX_RETURN → "Tờ khai thuế tiểu bang", FOREIGN_TAX_RETURN → "Tờ khai thuế nước ngoài", TAX_RETURN_TRANSCRIPT → "Bản sao tờ khai IRS". Supports AI-driven classification during client intake. Code quality 9.5/10.** | **2026-02-18** |
| **Tax Return Recognition Phase 1** | **Database schema: New TAX_RETURNS DocCategory (enum value) with Vietnamese label "Khai Thuế". 7 new DocType values: FORM_1040, FORM_1040_SR, FORM_1040_NR, FORM_1040_X, STATE_TAX_RETURN, FOREIGN_TAX_RETURN, TAX_RETURN_TRANSCRIPT. Category mapping: DOC_TYPE_TO_CATEGORY maps all 7 types to TAX_RETURNS. Category order: IDENTITY → INCOME → TAX_RETURNS → EXPENSE → ASSET → EDUCATION → HEALTHCARE → OTHER. Types in @ella/shared/src/types/doc-category.ts (TypeScript type mirrors), CATEGORY_LABELS + CATEGORY_ORDER constants updated. Supports 1040 family + amended returns + state/foreign + IRS transcripts. Foundation for AI classification of prior-year returns during intake workflows. Code quality 9.5/10.** | **2026-02-18** |
| **Phase 3: Hybrid PDF Viewer Enhancement** | **Platform-aware PDF routing in ImageViewer component. Desktop: Native iframe rendering (PdfViewerDesktop, zero bundle). Mobile/iOS: React-based rendering (PdfViewer, DPI scaling, fit-to-width). iOS detection via user agent forces mobile fallback (iPad/iPhone/iPod). Lazy-loaded PDF components via React.lazy() + Suspense. Controls: Mobile zoom/rotate/reset/page nav (top-right + bottom-center), desktop native controls. Interaction: Wheel zoom (Ctrl+wheel native passthrough), drag-to-pan, keyboard shortcuts. Accessibility: Vietnamese aria-labels, error handling, disabled states. Bundle: +0 KB desktop, +150 KB mobile (react-pdf only when needed). Code quality 9.2/10.** | **2026-02-17** |
| **Phase 2: Mobile PDF Enhancement** | **Mobile-optimized PDF viewer (react-pdf) with fit-to-width scaling, DPI-aware rendering (devicePixelRatio), responsive skeleton loading. Features: fitToWidth prop auto-scales PDF to container width, onFitScaleCalculated callback reports computed scale, DPI multiplier for crisp retina displays (scale × dpiMultiplier), ResizeObserver tracks container width changes, Page onRenderSuccess hook calculates fit scale from canvas dimensions. Loading states: skeleton (8.5:11 aspect ratio, responsive 400px max-width, pulse animation), overlay during fit calculation. Image viewer integration: wired fitToWidth=true to PdfViewer, lazy-loads PdfViewer component via Suspense to avoid bundling react-pdf (~150KB) in image-heavy sessions. Code quality 9.2/10.** | **2026-02-17** |
| **Phase 1: Desktop PDF Viewer** | **Native browser PDF rendering via iframe (zero bundle impact). Desktop-only component with iframe-based rendering, native text selection, browser search (Ctrl+F). Rotation support (0°/90°/180°/270°) via ResizeObserver for aspect ratio scaling. URL sanitization (XSS protection). Loading overlay + rotate button. Props: fileUrl, rotation, onRotate, showControls toggle. Integration with mobile PdfViewer (react-pdf) for cross-platform viewing. No new dependencies (native iframe + ResizeObserver). Complete: sanitization, rotation transforms, loading states, accessibility.** | **2026-02-17** |
| **Mobile Responsive Admin Pages Phase 4** | **Team page (responsive header flex-col→flex-row, invitation row wraps, sticky header). Settings page (scrollable tab bar overflow-x-auto, scroll fade indicator). Cases detail Entry page (mobile tab layout via useIsMobile, 3-tab nav: docs/image/data). Responsive form components, touch-friendly spacing. Code review 8.5/10.** | **2026-02-07** |
| **Mobile Infrastructure Phase 1** | **Responsive layout framework for iOS/Android clients. New hook: useIsMobile() (matchMedia @767px, SSR-safe). Layout components: Header (mobile-only hamburger, 56px), Sidebar (desktop fixed/mobile drawer overlay with backdrop), SidebarContent (extracted shared nav/user/voice/logout), PageContainer (responsive margins). Features: Drawer auto-close on route/Escape, focus trap, prefers-reduced-motion, keyboard accessibility. Mobile drawer 240px slide-in, desktop sidebar 240px/64px (collapsed). Ready for workspace mobile flows.** | **2026-02-07** |
| **Schedule E Phase 4: Workspace Tab** | **Frontend tab integration: ScheduleETab component (4 states: empty, draft, submitted, locked). Data hooks: useScheduleE (data fetch), useScheduleEActions (mutations with optimistic updates). 10 sub-components: property-card (XSS sanitization), totals-card, status-badge, schedule-e-empty-state, schedule-e-waiting, schedule-e-summary, copyable-value, format-utils, schedule-e-actions. API endpoints in api-client.ts. I18n: 60+ translations (EN/VI). Magic link send/resend functionality integrated.** | **2026-02-06** |
| **Schedule E Phase 2: Backend API** | **Staff routes (/schedule-e/:caseId/*): GET, POST /send, POST /resend, PATCH /lock, PATCH /unlock. Public routes (/rental/:token): GET, PATCH /draft, POST /submit. Zod schemas for properties. Services: expense-calculator (totals), version-history (track changes). SMS templates (VI/EN). Magic link support. Token validation. 9.1/10 code quality (minor fixes needed).** | **2026-02-06** |
| **Schedule E Phase 1: Backend Foundation** | **Prisma ScheduleEExpense model (properties JSON array, version history, status tracking), ScheduleEStatus enum (DRAFT/SUBMITTED/LOCKED), MagicLinkType.SCHEDULE_E, TypeScript types (7 properties support, 7 IRS expense fields, custom expenses, aggregated totals), helper utilities, export to shared types.** | **2026-02-06** |
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
| **AI Document Processing** | **Gemini 2.0-flash integration (image validation, retry logic, batch concurrency). Classification service. 17 OCR prompts (W2, 1099s, K-1, Bank, 1098, 1095-A, Form 1040 family). Tests: 88/88 passing** | **2026-02-18** |

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
| Document Viewing | Native iframe (desktop) + react-pdf (mobile) | Native / 3.17+ |

## Database Schema (Current)

**Core Models:**
- **Organization**: clerkOrgId (unique), name, slug, logoUrl, isActive. Org-scoped root.
- **Client**: organizationId FK, name, phone, email, language, intakeAnswers Json, status tracking
- **Staff**: organizationId FK, clerkId (unique), userId, role (ADMIN|STAFF|CPA), isActive
- **ClientAssignment**: clientId + staffId (unique composite), organizationId FK. 1-to-1 staff-client mapping.
- **TaxCase**: caseId, engagementId FK, taxYear, status (INTAKE→FILED), caseDocs[], checklistItems[]
- **TaxEngagement**: engagementId, clientId FK, taxYear, year-specific profile fields, status
- **ScheduleCExpense**: 20+ expense fields, vehicle info, version history tracking, gross receipts from 1099-NEC
- **ScheduleEExpense**: Up to 3 rental properties (JSON array), 7 IRS expense fields, custom expenses, version history, status (DRAFT/SUBMITTED/LOCKED)
- **RawImage**: documentId, classification (UPLOADED|UNCLASSIFIED|CLASSIFIED|DUPLICATE|VERIFIED), aiConfidence, category
- **DigitalDoc**: Extracted OCR fields, source reference, AI confidence
- **MagicLink**: type (PORTAL|SCHEDULE_C|SCHEDULE_E), token, caseId/type, isActive, expiresAt
- **Message**: conversationId, channel (SMS|PORTAL|SYSTEM|CALL), content, callSid/recordingUrl
- **AuditLog**: entityType, entityId, field, oldValue, newValue, changedById, timestamp (complete trail)
- **Action**: actionType, priority, caseId, dueDate, status, completedBy

**DocCategory Enum (8 categories):** IDENTITY, INCOME, TAX_RETURNS, EXPENSE, ASSET, EDUCATION, HEALTHCARE, OTHER (display order maintained)
**DocType Enum (96 types):** 5 identity + 13 income forms + 4 K-1 variants + 3 health forms + 2 education + 1 mortgage + 45 business/receipts + 2 prior-year + 1 crypto + 8 foreign/fbar + 3 real estate + 2 credits + 2 business-misc + 1 extension + 7 tax returns (1040 family, state, foreign, transcript) + 2 catchall (OTHER, UNKNOWN)

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

**Mobile Infrastructure (Phase 1):**
- `useIsMobile()` hook: matchMedia @ 767px breakpoint (Tailwind md: sync), SSR-safe with lazy state init
- `Header` component: Mobile-only fixed 56px top bar (hamburger menu, Ella logo, spacer). Desktop returns null.
- `Sidebar` component: Dual-mode responsive layout
  - Desktop: Fixed left sidebar 240px (16px collapsed), collapsible via toggle button
  - Mobile: Slide-in drawer overlay (240px width), -translate-x-full to translate-x-0 animation
  - Backdrop: Black 50% opacity, click-to-close, fade transition (300ms)
- `SidebarContent` component: Shared nav/user/voice/logout content (extracted for reuse)
  - Logo section: Full logo (showLabels) or arrow icon (collapsed/mobile)
  - Navigation: Loop nav items w/ active-state highlight, unread badge on messages
  - User section: Avatar + name + org name (when available)
  - Voice status: Register/connecting/waiting states w/ indicator dot (when available)
  - Logout button: i18n aware
- `PageContainer` component: Responsive margins
  - Mobile: pt-14 (header offset) + px-4 py-4 (edges)
  - Desktop: py-6 px-6 + ml-16 (collapsed) or ml-60 (expanded sidebar)
  - Max-width 1280px container inside
- Accessibility: Focus trap (Escape key, auto-focus first input on drawer open, restore focus on close), prefers-reduced-motion, aria-modal on drawer, aria-labels on buttons

**Sidebar Enhancement:**
- Displays current org name via `useOrganization()` hook
- Role badge (ADMIN/STAFF) next to user info
- Team menu visible only to org admins
- Voice status indicator (connected/connecting/waiting)

**Key Components:**
- Team page: Member table + invite dialog + bulk assign panel
- Sidebar: Responsive dual-mode (desktop sidebar + mobile drawer)
- Header: Mobile hamburger menu header
- PageContainer: Responsive page layout with sidebar offset
- Accept-invitation page: Seamless Clerk org acceptance flow
- Team assignment panel: View/edit client assignments
- PDF Viewers (Phase 1 Desktop + Phase 2 Mobile Enhancement):
  - `PdfViewerDesktop` (iframe-based): Native browser PDF rendering via iframe. Zero bundle impact, native text selection, Ctrl+F search. Desktop-only. Rotation via ResizeObserver for aspect ratio scaling (90°/270° rotations). Sanitizes URLs to prevent XSS (https/http/blob only). Loading state overlay. Keyboard-accessible rotation button (aria-label "Xoay"). Props: fileUrl, rotation (0/90/180/270), onRotate callback, showControls toggle.
  - `PdfViewer` (react-pdf + Phase 2 enhancements): Mobile React PDF viewer using react-pdf library with mobile-first UX. Features: (1) Fit-to-width scaling: fitToWidth boolean prop auto-calculates scale from container width via Page onRenderSuccess hook, reads canvas.width at current render scale to derive natural dimensions, then calculates scale = containerWidth / naturalWidth. (2) DPI-aware rendering: devicePixelRatio multiplier (window.devicePixelRatio || 1) applied to render scale for crisp retina displays. Formula: renderScale = (fitScale || baseScale) × dpiMultiplier. (3) Responsive skeleton loading: 8.5:11 aspect ratio placeholder (max-w-[400px]), pulse animation during fit calculation. (4) Scale-based zoom (1-4x range), page pagination, rotation. (5) ResizeObserver tracks container width changes for responsive reflow. Lazy loaded to avoid bundling react-pdf (~150KB) in image viewer. PDF.js worker from unpkg (CDN). Props: fileUrl, scale, rotation, currentPage, onLoadSuccess, onLoadError, fitToWidth (default false), onFitScaleCalculated callback. ImageViewer integration: passes fitToWidth=true, Suspense lazy-loads PdfViewer for optimal bundle split.

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

**2026-02-18:** Tax Return Recognition Phase 4 complete. Files UI Frontend Display: TAX_RETURNS category now fully integrated into workspace Files Tab UI. EDIT: `apps/workspace/src/lib/doc-categories.ts` (line 19, 44-50, 117): Added TAX_RETURNS to DocCategoryKey type union, added TAX_RETURNS config to DOC_CATEGORIES_DATA with FileText icon and amber color scheme (bg-amber-500/10, text-amber-600, border-amber-500/20), positioned between INCOME and EXPENSE in CATEGORY_ORDER array. EDIT: `apps/workspace/src/components/files/files-tab.tsx` (line 11, 73): Imported DOC_CATEGORIES and CATEGORY_ORDER, TAX_RETURNS now available in byCategory filter alongside all other document categories (IDENTITY, INCOME, EXPENSE, ASSET, EDUCATION, HEALTHCARE, OTHER). Users can view, filter, and drag/drop documents into TAX_RETURNS category. EDIT: `apps/workspace/src/locales/en.json` (line 275): Added "docCategory.taxReturns": "Tax Returns" translation key. EDIT: `apps/workspace/src/locales/vi.json` (line 275): Added "docCategory.taxReturns": "Khai Thuế" Vietnamese translation. Frontend UI now fully operationalizes Phase 1-3 backend schema changes (DocCategory enum, 7 DocType values, AI classification support, OCR extraction). Visual design: amber FileText icon badge distinguishes tax returns from other categories. Code quality 9.2/10 (minimal focused changes, consistent with existing patterns, full i18n support, zero breaking changes).

**2026-02-18:** Tax Return Recognition Phase 3 complete. Form 1040 OCR Extraction: NEW file `apps/api/src/services/ai/prompts/ocr/form-1040.ts` (154 LOC) with Form1040ExtractedData interface capturing 20 fields from IRS Form 1040 (taxYear, formVariant, filingStatus, taxpayer/spouse names & SSNs, totalWages, totalIncome, adjustedGrossIncome, standardOrItemizedDeduction, taxableIncome, totalTax, childTaxCredit, earnedIncomeCredit, totalWithheld, totalPayments, refundAmount, amountOwed, attachedSchedules array). getForm1040ExtractionPrompt() maps OCR fields to form line numbers (line 1z → totalWages, line 11 → AGI, line 24 → totalTax, line 33 → totalPayments, line 35a → refundAmount, line 37 → amountOwed) with field-by-field instructions. Handles 1040/1040-SR/1040-NR/1040-X variants (1040-X extracts column C values only). validateForm1040Data() requires minimum viable data (at least one of: taxYear, AGI, totalTax, refund). FORM_1040_FIELD_LABELS_VI provides Vietnamese field translations (AGI = "Thu nhập gộp điều chỉnh - AGI (Line 11)", SSN = "SSN người nộp thuế"). EDIT: `apps/api/src/services/ai/prompts/ocr/index.ts` (line 86-89, 215-220, 242, 282-283, 334-335, 378-379): Added form-1040 module import, Form1040ExtractedData re-export, 'FORM_1040' to OcrDocType union (17 total types), switch cases in getOcrPromptForDocType/validateExtractedData/getFieldLabels. Simplified supportsOcrExtraction() to call getOcrPromptForDocType (DRY). EDIT: `apps/api/src/services/ai/ocr-extractor.ts` (line 241): Added FORM_1040 key fields ['adjustedGrossIncome', 'totalTax', 'taxableIncome', 'taxpayerSSN'] for confidence scoring. Supports masked SSN extraction (XXX-XX-XXXX format as-is). Zero bundle impact (prompt-only, no new dependencies). Code quality 9.5/10.

**2026-02-18:** Tax Return Recognition Phase 2 complete. AI Classification + Prompt Enhancement: `apps/api/src/services/ai/prompts/classify.ts` updated with comprehensive tax return classification support. Added 3 few-shot examples demonstrating FORM_1040 standard, FORM_1040_X amended return, and STATE_TAX_RETURN (CA 540). TAX RETURNS section added to prompt with key identifiers for all 7 doc types: form title, IRS logo, filing status checkboxes, three-column layout (amendments), state agency branding (state returns), foreign government logo (foreign returns), IRS letterhead (transcripts). Disambiguation rules clarify distinctions (1040 vs 1040-X: "Amended" or three-column layout; 1040 vs 1040-SR: "SR" in form number or "Seniors" title; 1040 vs State: IRS logo vs state branding; 1040 vs Transcript: letters vs form layout; Tax return vs PRIOR_YEAR_RETURN: prefer FORM_1040 when actual 1040 form visible). Updated `apps/api/src/services/ai/document-classifier.ts` with 7 Vietnamese labels: FORM_1040 → "Tờ khai 1040 (Liên bang)", FORM_1040_SR → "Tờ khai 1040-SR (Người cao tuổi)", FORM_1040_NR → "Tờ khai 1040-NR (Người nước ngoài)", FORM_1040_X → "Tờ khai 1040-X (Điều chỉnh)", STATE_TAX_RETURN → "Tờ khai thuế tiểu bang", FOREIGN_TAX_RETURN → "Tờ khai thuế nước ngoài", TAX_RETURN_TRANSCRIPT → "Bản sao tờ khai IRS". Enables accurate AI-driven classification of prior-year returns during client intake workflows. Code quality 9.5/10.

**2026-02-18:** Tax Return Recognition Phase 1 complete. Database: New DocCategory enum value TAX_RETURNS with Vietnamese label "Khai Thuế" (positioned between INCOME and EXPENSE in CATEGORY_ORDER). 7 new DocType values: FORM_1040, FORM_1040_SR, FORM_1040_NR, FORM_1040_X, STATE_TAX_RETURN, FOREIGN_TAX_RETURN, TAX_RETURN_TRANSCRIPT. Prisma schema (packages/db/prisma/schema.prisma): DocType enum updated with comments (1040 variants, amended returns, state/foreign returns, IRS transcripts). TypeScript types (@ella/shared/src/types/doc-category.ts): DocCategory union type includes TAX_RETURNS, DOC_TYPE_TO_CATEGORY mapping updated with all 7 types → TAX_RETURNS, CATEGORY_LABELS and CATEGORY_ORDER constants updated. Foundation for AI classification of prior-year returns during client intake workflows. Code quality 9.5/10 (comprehensive comments, type safety, Vietnamese localization).

**2026-02-17:** Phase 2: Mobile PDF Enhancement complete. Mobile-optimized PdfViewer (apps/workspace/src/components/ui/pdf-viewer.tsx, 147 LOC) with three key improvements: (1) Fit-to-width scaling—fitToWidth prop enables auto-scaling to container width via Page onRenderSuccess hook. Calculates natural PDF width from rendered canvas: naturalWidth = canvas.width / (scale × devicePixelRatio), then computes scale = containerWidth / naturalWidth. ResizeObserver tracks width changes. onFitScaleCalculated callback reports computed scale. (2) DPI-aware rendering—devicePixelRatio multiplier for crisp retina displays. Formula: renderScale = fitScale × userZoom × dpiMultiplier. When fitToWidth enabled, fitScale is base multiplier; when disabled, scale is absolute. (3) Responsive skeleton loading—8.5:11 aspect ratio placeholder (max-w-[400px]), pulse animation, shown during fit calculation. State tracking: hasCalculatedFit ref prevents recalculation race conditions. ImageViewer integration (apps/workspace/src/components/ui/image-viewer.tsx): wired fitToWidth=true, Suspense lazy-loads PdfViewer component to avoid bundling react-pdf (~150KB). Code quality 9.2/10. Zero-bundle-impact mobile PDF rendering achieved.

**2026-02-17:** Phase 1: Desktop PDF Viewer complete. Native browser PDF rendering via iframe (apps/workspace/src/components/ui/pdf-viewer-desktop.tsx, 156 LOC). Zero bundle impact, native text selection, browser search (Ctrl+F). Desktop-only component with rotation support (0°/90°/180°/270°) via ResizeObserver for aspect ratio scaling on 90°/270° rotations. Security: URL sanitization prevents XSS (allows https:/http:/blob: protocols only). State: loading overlay (Loader2 spinner), rotate button overlay (keyboard-accessible, Vietnamese aria-label "Xoay"). Props: fileUrl (required), rotation (0|90|180|270), onRotate callback, showControls toggle (default true). Integration with mobile PdfViewer (react-pdf) for responsive multi-platform PDF viewing. Firefox limitation: toolbar param ignored, toolbar may show. No new dependencies added (uses native iframe + ResizeObserver APIs). Testing complete: URL validation, rotation transforms, loading states, accessibility (ARIA labels, keyboard shortcuts).

**2026-02-07:** Mobile Responsive Admin Pages Phase 4 complete. Team page (apps/workspace/src/routes/team.tsx): responsive header layout (flex-col on mobile → sm:flex-row desktop), invitation row items wrap on small screens, sticky header support. Settings page (apps/workspace/src/routes/settings.tsx): scrollable tab bar with overflow-x-auto, scroll fade indicator for mobile UX. Cases detail Entry page (apps/workspace/src/routes/cases/$caseId/entry.tsx): mobile-first tab layout via useIsMobile hook, 3-tab navigation (docs/image/data), responsive form sections, touch-friendly spacing (44px min touch targets). New utility hooks: use-mobile-breakpoint.ts (useIsMobile for component logic). Code review 8.5/10. Admin page workflows now fully responsive across mobile/tablet/desktop viewports.

**2026-02-07:** Mobile Infrastructure Phase 1 complete. New hook: useIsMobile() via matchMedia (767px breakpoint, SSR-safe) in apps/workspace/src/hooks/use-mobile-breakpoint.ts. Layout refactored into responsive components: Header (mobile-only, fixed 56px top bar with hamburger menu + Ella logo), Sidebar (dual-mode: desktop fixed sidebar 240px/64px collapsed vs mobile drawer overlay w/ backdrop), SidebarContent (extracted shared nav items, user info, voice status indicator, logout), PageContainer (responsive margins: mobile pt-14 + px-4 vs desktop py-6 + sidebar offset). Mobile drawer features: auto-close on route change + Escape key, focus trap (first focusable element on open, restore on close), prefers-reduced-motion support, backdrop click-to-close, aria-modal semantics. Drawer animation: -translate-x-full → translate-x-0 (300ms ease-in-out). Sidebar integration: uses useUIStore (sidebarCollapsed state desktop only) + useMobileMenu (mobileMenuOpen state mobile only). Ready for responsive workspace flows (Cases, Clients, Messages, Team).

**2026-02-06:** Schedule E Phase 1 Backend Foundation complete. Prisma schema: ScheduleEExpense model (unique per TaxCase), ScheduleEStatus enum (DRAFT/SUBMITTED/LOCKED), MagicLinkType.SCHEDULE_E added. TypeScript types in @ella/shared: ScheduleEProperty (7 properties A-C), ScheduleEPropertyAddress, ScheduleEPropertyType (1/2/3/4/5/7/8), ScheduleEOtherExpense, ScheduleEVersionHistoryEntry, ScheduleETotals. Helper utilities: createEmptyProperty(), PROPERTY_TYPE_LABELS (EN/VI). Properties stored as JSON array with 7 IRS expense fields (insurance, mortgage interest, repairs, taxes, utilities, management fees, cleaning/maintenance). Exports added to @ella/shared/src/types/index.ts for frontend consumption.

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

1. **Mobile Infrastructure Phase 2** - Responsive tables/forms for mobile (Cases list, Client detail, Messages). Touch-friendly input sizes (44px min-height). Optimize for landscape orientation.
2. **PDF Viewer Phase 3** - Desktop image viewer enhancement (apply fit-to-width + DPI scaling to images), gesture-based zoom on mobile (pinch-to-zoom), keyboard shortcuts (+ - 0 R for zoom/reset/rotate)
3. **Landing Page Phase 09** - Additional page templates (About page, Blog overview) + full deployment
4. **Landing Page Deployment** - Staging → Production deployment & DNS routing (SMS-first messaging live)
5. **Schedule C Phase 5** - Workspace Schedule C tab (case detail integration)
6. **Voice Calls Phase 5** - Enhanced incoming call routing, better presence tracking
7. **Team Assignment Workflows** - Bulk operations, transfer auditing
8. **Workspace SMS Integration** - Integrate Twilio SMS direct upload feature from landing page into workspace portal

---

**Version:** 3.1
**Created:** 2026-01-11
**Last Updated:** 2026-02-18
**Maintained By:** Documentation Manager
**Status:** Production-ready with Multi-Tenancy, Landing Page Animations, Schedule E Phase 1 Backend, SMS-First Killer Features Phase 01, Phase 1 Desktop PDF Viewer, Phase 2 Mobile PDF Enhancement, Tax Return Recognition Phase 1 & Phase 2 (AI Classification) complete
