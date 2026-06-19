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
         │           │ - Cloudflare R2         │
         │           │ - TaxBandits API        │
         └─────────────────→ - Supabase Realtime │
                    ↓
┌─────────────────────────────────────────────────┐
│ Realtime Messaging (Supabase Broadcast)         │
│ - Org-scoped channels: org:{orgId}:messages    │
│ - Lightweight event notifications + cache      │
│     Data Layer (Org-Scoped)                      │                                     │
│  - Organizations, Staff, Clients, Cases         │
│  - ClientManager join model + legacy managedById│
│  - Documents, Messages, Audit logs              │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│   Shared Packages                                │
│  @ella/db - Prisma client, migrations           │
│  @ella/shared - Types, validation, utilities    │
│  @ella/ui - shadcn/ui component library         │
└──────────────────────────────────────────────────┘
```

`@ella/shared/constants` is the source of truth for pricing defaults; `@ella/shared/pricing` owns calculator math so landing, workspace, and billing stay aligned.

## Frontend Layer

**Technology:** React 19, Vite, TanStack Router 1.94+, React Query 5.64+, Tailwind CSS 4

**Apps:**
- `apps/landing/` - Public-facing Astro site for Ella Tax Services LLC, with home, services, password-gated pricing calculator, get-started, why Ella, about, privacy, terms, and tax-advisory pages. Shared service primitives cover page heroes, service cards, process steps, trust strips, contact bands, FAQs, contact forms, and stats. `/try-now` redirects to `/get-started`, and `/features` redirects to `/services`.
- `apps/portal/` - Client magic link upload portal
- `apps/workspace/` - Staff dashboard with team management, multi-manager client UI, and an admin-only pricing calculator/payment-link flow

**Key Pages (Workspace):**
- `/` - Dashboard with stats & quick actions
- `/clients` - Client list with Kanban/list views and a compact multi-manager Managed By column
- `/clients/new` - Multi-path client creation wizard (Phase 12: INDIVIDUAL | BUSINESS | INDIVIDUAL_WITH_BUSINESS). INDIVIDUAL_WITH_BUSINESS path includes accordion UI for managing up to 10 business entities per individual client, with per-business validation, add/remove, and batch submit to create ClientGroup (Phase 2 multi-business enhancement)
- `/clients/:id` - Client detail with tabs: Overview, Files, Documents, Data Entry, Schedule C, Schedule E, Draft Return. Overview includes the admin multi-select manager editor and read-only fallback. Tab layout varies by clientType (Phase 15)
- `/cases/:id` - Tax case with checklist & documents
- `/messages` - Unified inbox with split-view conversations
- `/actions` - Action queue with priority filtering
- `/pricing-calculator` - Admin-only pricing calculator with quote summary and Stripe payment-link creation through the staff Clerk session
- `/team` - Team profile access for all active staff; admin-only team management controls (Phase 3)
- `/accept-invitation` - Clerk org invite acceptance (Phase 6)

**Key Pages (Portal):**
- `/upload/:token` - Document upload portal with random 32-character magic link tokens, default 60-day expiry, and token auth
- `/u/:token` - Legacy document upload portal (backward compatible, deprecated)
- `/schedule-c/:token` - Schedule C expense form (magic link auth)
- `/schedule-e/:token` - Schedule E rental form (magic link auth)
- `/draft/:token` - Draft tax return viewer (magic link, public, Phase 03)
- `/pay/:payToken` - Public payment page for checkout (React/TanStack Router, Phase 04)

**Send Upload Link (Phase 15 - Business Entity Separation Smart Routing):**
- `POST /clients/:id/send-upload-link` sends SMS with upload portal link to client (or their designated recipient)
- **Entity Separation Logic**: When business client has clientGroupId (linked to individual owner), endpoint intelligently routes upload link:
  - Queries individual client in same group, same taxYear
  - Creates magic link on individual's taxCase (not business's)—uploads go to owner's document collection
  - Fallback: If individual has no taxCase for year, uses business case with warning log
  - Defense-in-depth: organizationId filter ensures cross-org data protection
- **SMS Recipient Resolution**: For grouped business clients, sends to individual's phone + name
- **Single-Entity Fallback**: Standalone business clients default to their own phone/case (backward compatible)

**Authentication (Clerk + Multi-Tenancy):**
- `ClerkAuthProvider` - Wraps root, sets JWT token getter
- `useAutoOrgSelection()` - Auto-selects first org on sign-in
- `useOrgRole()` - Returns `{ isAdmin, isManager, canManageClients, canViewPhone, canViewTeam, canManageTeam, ...role booleans }` for RBAC (Phase 4)
- Zero-org fallback: Localized UI (org.noOrg)
- Sidebar: Displays org name, role badge, conditional Team nav (gated by `canViewTeam`); active non-admin staff can open the Team page in self-mode, but admin-only controls remain hidden

**Frontend Capability Flags (Phase 4 - MANAGER Role UI + Server Phone Masking):**
- `useOrgRole()` hook in `apps/workspace/src/hooks/use-org-role.ts` provides semantic capability flags; components consume these, never compare role string literals for permissions.
- **Flags:** (1) `isManager` - user has Staff.role='MANAGER'. (2) `canManageClients` - isAdmin || isManager (mirrors server admin-or-manager gate); enables leads list, pricing-calculator nav, clients CRUD UI. (3) `canViewPhone` - isAdmin only (server masks for others via `serializePhone()`). (4) `canViewTeam` - active org staff only; gates `/team` nav/page access. (5) `canManageTeam` - isAdmin only; gates invite/role-change/deactivate UI.
- **App-Level Roles (Phase 4):** `AppRole` union type ('ADMIN' | 'MANAGER' | 'MEMBER') used in team invite dialog + profile role select, mirrors `apps/api/src/lib/staff-role-mapping.ts APP_ROLES` for JSON payloads (TeamInvitation.staffRole, team/members/:staffId/role endpoint).
- **Phone Masking Convention:** `formatPhone()` in `apps/workspace/src/lib/formatters.ts` passes through server-masked values containing '*' unchanged (e.g., `*** *** 1234`). Frontend never re-masks; server is authoritative source via `serializePhone()` middleware.
- **UI Contract:** Nav items (leads, pricing-calculator, /team) gated by capability flags. `/team` visibility uses `canViewTeam`; Team invite dialog + profile role select offer ADMIN/MANAGER/MEMBER app-level roles for admin mutations. Code never checks org:admin literal; instead uses semantic capability flags.

**State Management:**
- React Query: Server state, auto cache invalidation
- Zustand: UI state (sidebar, toast), session persistence
- File-based routing: `src/routes/*` (auto-generated tree)

**Localization:**
- Workspace and portal default to English with Vietnamese selectable by user/client preference.
- User-facing frontend copy lives in app locale files with enforced English/Vietnamese key parity.
- Runtime Vietnamese literals are blocked by `pnpm i18n:audit` unless the file is an explicit bilingual catalog.
- API routes return stable error codes and sanitized English-first messages; frontend clients translate known codes at the display boundary instead of rendering raw server/provider errors.
- Backend-generated customer communication, including SMS, uses English fallback and sends Vietnamese only when explicitly selected.

**API Client (Phase 10 - Client Type & EIN Masking):**
- Type-safe endpoint groups (team, clients, cases, messages, etc.)
- Org context: Bearer JWT includes orgId (workspace)
- Portal: Token-based public endpoints (no auth, portal app)
- Retry logic: 3 attempts, exponential backoff
- Pagination: limit=20, max=100
- **Client Types (Phase 10):** clientType: 'INDIVIDUAL' | 'BUSINESS'. GET /clients/:id returns einMasked (masked EIN) instead of encrypted version.
- **Namespaces:** clients, cases, team, messages, leads, forms, contractors, clientGroups, sharedDocs (Phase 02, replaces draftReturns), businesses (deprecated in favor of clientGroups)
- **Billing namespace:** `api.billing.createCheckoutSession(data)` posts shared pricing input plus optional customer fields to `/billing/checkout-sessions`. The workspace API client injects the Clerk JWT; the workspace pricing UI has no manual bearer-token field.
- **Phase 02 API Client Changes (workspace):**
  - `api.draftReturns.*` renamed to `api.sharedDocs.*`
  - `DraftReturnData` → `ShareableDocumentData` (includes title field)
  - New types: `SharedDocListItem`, `ListSharedDocsResponse`, `SectionDetailResponse`, `CreateSectionResponse`
  - Error code: `DOC_DELETED` (410) for soft-deleted documents
- **Portal API Methods (portalApi):**
  - `getData(token)` - Fetch portal data via magic link: client info, tax case, checklist, stats. Callers treat `RATE_LIMITED` / invalid-token errors as non-retriable.
  - `getDraft(token)` - Fetch document data + signed PDF URL (includes title)
  - `trackDraftView(token)` - Post-load view tracking (fire & forget)

**Frontend Utilities (Phase 03 - Shared Docs Rework):**
- **Clipboard Utility (`apps/workspace/src/lib/clipboard.ts`):**
  - `copyToClipboard(text, options?)` → `Promise<boolean>`
  - Wraps `navigator.clipboard.writeText` with try/catch + automatic toast feedback
  - Validates secure context (HTTPS/localhost) before API call
  - Returns `true` on success, `false` on failure (no exception thrown)
  - Options: `successMsg` (default: i18n `common.linkCopied`), `errorMsg` (default: i18n `common.copyFailed`), `showToast` (default: true)
  - **Safety:** Only safe to call from user gesture context (click, keypress). Auto-copy after async operations (e.g., file upload) risks `NotAllowedError: Document is not focused`. Always use manual copy buttons for user-initiated UI actions.
  - Used in: Shared Docs card copy-link button (Phase 04+), any text-to-clipboard flow

## Backend Layer

**Technology:** Hono 4.6+, Node.js, @hono/zod-openapi, Prisma

**Structure:**
- Entry: `src/index.ts` (PORT 3002, Gemini validation)
- App: `src/app.ts` (Hono instance, all routes)
- Middleware: Error handler, request logging, rate limiting
- Routes: `src/routes/{team,clients,cases,docs,messages,voice,webhooks,leads,forms}/`
- Services: `src/services/{auth,org,ai,webhook-handlers,sms,magic-link}/`
- Database: `src/lib/db.ts` (Prisma singleton)

**Endpoints (80+ total):**

**Company Vault (Shared Staff Credentials):**
- `GET /company-vault` - Authenticated org-scoped list/search of shared credentials. Values decrypt only at the response boundary.
- `POST /company-vault` - Create a shared credential with required `toolName` and optional username/password/note encrypted before storage.
- `PATCH /company-vault/:id` - Update provided fields by id and organization; activity metadata records changed field names only.
- `DELETE /company-vault/:id` - Hard delete credential by id and organization.
- Activity logging uses `company_vault.*` actions with redacted metadata. Credential values must not be written to logs, snapshots, or activity metadata.

**Contractor Agent Agreements (Staff Compliance):**
- `PATCH /team/members/:staffId/contractor-agent` - Admin-only toggle for `Staff.isContractorAgent`.
- `GET /contractor-agreements/status` - Authenticated staff status for current Independent Contractor agreement version.
- `POST /contractor-agreements/accept` - Accept current version. Server accepts contractor PNG signature data URL, loads versioned repo PDF template, overlays Ella firm signer + contractor signer fields, uploads immutable signed PDF to R2, and persists SHA-256/signature snapshots.
- `GET /contractor-agreements/acceptance/:staffId` - Owner/admin scoped current-version acceptance lookup.
- `GET /contractor-agreements/download/:acceptanceId` - Owner/admin scoped signed PDF download URL.
- Template asset: `apps/api/src/assets/agreements/independent-contractor-obamacare-2026-05-15.pdf`; API build copies assets into `dist/assets` and fails if the template is missing.
- Storage keys: `contractor-agreements/{orgId}/{staffId}/{version}/{uuid}.pdf`; unique DB acceptance on `[staffId, version]` makes duplicate signing idempotent.
- Firm signer lookup prefers `kaytax76@gmail.com` with a stored signature, then falls back to the first active admin with a stored signature. Production rollout must verify the exact signer account/title/signature before contractor staff sign.
- Data model: `Staff.isContractorAgent` gates the workspace compliance flow; `ContractorAgreementAcceptance` stores the signed PDF, source template, SHA-256, signer snapshots, IP/User-Agent, and firm signer snapshot.

**Billing (Stripe Checkout with Calculator + Custom Quote Sources):**
- **Quote Sources:** `PaymentQuote.source` field (enum: 'calculator' | 'custom') branches payment flow. Calculator quotes (`source='calculator'`) rebuild from stored `inputSnapshot` (pricing inputs). Custom quotes (`source='custom'`) have no `inputSnapshot`—line items frozen in `resultSnapshot` are the source of truth.
- **PaymentTemplate:** Org-scoped reusable custom-link presets store only line-item payloads (`billingInterval`, `items`, optional `oneTimeItems`). They intentionally exclude recipients, discounts/coupons, Stripe sessions/links, sent status, and customer fields. Creating or sending from a template copies the current rows into the editable custom-link form, then snapshots those rows into `PaymentQuote` so later template edits do not mutate historical quotes.
- **PaymentTemplate CRUD API:** Admin-only `/billing/payment-templates` routes list, create, update, and archive org-scoped presets. Mutations reuse the custom quote line-item schema and `buildCustomQuote()` validation, return normalized summaries for dropdown/load flows, and soft-delete via `archivedAt` without touching Stripe.
- `POST /billing/checkout-sessions` - Admin/manager only. Persists a `PaymentQuote` first, then creates the Stripe Checkout session and stores the returned session URL, status, and expiry in `StripeCheckoutSession`. Uses `quoteId` as the Stripe idempotency key, keeps Stripe metadata free of internal notes and PII, and surfaces config errors as `STRIPE_NOT_CONFIGURED` or `STRIPE_RETURN_URLS_INVALID`. Handles both calculator and custom quote types.
- `POST /webhooks/stripe` - Public Stripe webhook. Verifies `Stripe-Signature` with the raw request body and `STRIPE_WEBHOOK_SECRET`, then syncs local `PaymentQuote` and `StripeCheckoutSession` status for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, and `customer.subscription.deleted`. Completed unpaid checkouts map to `awaiting_payment`, and the existing local checkout-session quote association wins over Stripe metadata when both exist. Webhook updates persist `lastStripeEventId` and `lastStripeEventAt` on quote/session records, ignore older events, apply same-second status precedence, and keep canceled sessions terminal for later invoice events on the same subscription.
- **Custom Payment Links (Staff-Driven):** Staff create free-form quotes with per-line item control (label, description, amount, quantity) + per-line billing interval (one-time | monthly | yearly). Line items frozen in `resultSnapshot`. Optional coupon attachment (XOR with promotion codes per Stripe rules). Checkout session built via generalized `buildCheckoutSessionParams(lineItems[], opts)` supporting mixed intervals via line-item grouping + subscription logic.
- **Coupons (Stripe-Native):** New `Coupon` model (organizationId, name, stripeId, code, discountType, discountValue, maxRedemptions, expiresAt, active). App-side source of truth synced bidirectionally with Stripe Coupon + Promotion Code. Routes: `POST /coupons` (create + sync), `GET /coupons` (list org), `PATCH /coupons/:id` (update), `DELETE /coupons/:id` (soft-delete, deactivate on Stripe). Per-checkout, enforce Stripe rule: `discounts:[{coupon}]` OR `allow_promotion_codes:true`, not both.
- **Quote Drift-Safety:** New `rebuildQuoteForCheckout(quote)` rebuilds Stripe params from frozen snapshot. For calculator source: calls `calculateCheckoutQuote(inputSnapshot)` to regenerate. For custom source: reads `resultSnapshot.lineItems` directly (no recalc, line items are frozen).
- **Portal Pay Page:** New `PublicQuoteView.billingInterval` field exposes per-line cadence (null = one-time). UI surfaces per-line descriptions, correct "Monthly" / "Yearly" group headers, and /mo vs /yr badges.
- Pricing payment links are disabled for enterprise-sized quotes (>20 1099 workers); those quotes remain contact-sales only.
- Workspace `/pricing-calculator` uses the same shared calculator domain as billing and creates payment links through the authenticated `api.billing` client. No-selection, enterprise-sized, unsafe quantity, and oversized checkout states disable link creation before the API call and are enforced again by billing before Stripe session creation. New custom-link tab allows staff to create and send free-form quotes.
- Stripe config lives in the API process env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `STRIPE_CURRENCY`. Local API dev loads `apps/api/.env`.
- Landing payment-link calls require `PUBLIC_API_URL` in the landing process/build env so `/pricing` can reach the API. Local landing dev loads `apps/landing/.env`; deployed static builds need the same variable configured in build/deploy env.
- Local webhook testing: `pnpm dev` starts Stripe CLI forwarding automatically when Stripe CLI plus `STRIPE_SECRET_KEY` and the matching local `STRIPE_WEBHOOK_SECRET` are available. Bootstrap or refresh the local `whsec_...` with `stripe listen --forward-to localhost:3002/webhooks/stripe`, then copy the printed signing secret into `apps/api/.env`. Do not reuse the live Dashboard webhook secret for local CLI forwarding.
- Rollout order: set test-mode Stripe env vars in `apps/api/.env`, set `PUBLIC_API_URL` in `apps/landing/.env`, run `pnpm dev`, create a pricing payment link with an admin token, pay with a Stripe test card, confirm webhook status updates in `PaymentQuote`/`StripeCheckoutSession`, then configure the production Dashboard webhook with a separate live signing secret.
- Production guard rejects non-HTTPS success/cancel URLs; localhost/loopback defaults stay dev-only.

**Shared Docs (Multi-Section Document Sharing - Phase 02 Backend Complete, Phase 01 Actions Rework Complete, Phase 03 UI Refactor Complete):**
- `POST /shared-docs/:caseId` - Create section with title + initial PDF (ShareableDocument + MagicLink)
- `GET /shared-docs/case/:caseId` - List non-deleted sections for case (status=ACTIVE only)
- `GET /shared-docs/:id` - Get section detail (title, status, version count, link status)
- `PATCH /shared-docs/:id` - Rename section; updates title across all versions
- `DELETE /shared-docs/:id` - Soft-delete section (deletedAt set, hides from UI)
- `POST /shared-docs/:id/version` - Upload new version PDF (increments version counter, soft-deletes old)
- `POST /shared-docs/:id/pause` - Disable magic link (section visible, link inactive; reversible)
- `POST /shared-docs/:id/resume` - Reactivate paused link with fresh 14-day expiry
- `POST /shared-docs/:id/generate-link` - Create magic link for sections without one
- `POST /shared-docs/:id/extend` - Extend link expiry; accepts body { duration: '7d'|'14d'|'30d'|'never' }, default '14d'
- `POST /shared-docs/:id/revoke` - **DEPRECATED** — use `/pause` (alias kept for backward compat)
- `GET /shared-docs/:id/signed-url` - Fetch current version PDF from R2 (24h TTL)
- `GET /shared-docs/:id/version/:version/signed-url` - Fetch specific version PDF from R2
- `GET /portal/draft/:token` - Validate token, return section data + PDF signed URL (public). Returns 410 DOC_DELETED if soft-deleted.
- `POST /portal/draft/:token/viewed` - Increment viewCount, update lastViewedAt (public)

**Portal Document Upload (Security Hardened):**
- `GET /portal/:token` - Validate MagicLink token, return portal data (client, taxCase, checklist, stats). Returns 401 for invalid/expired/revoked/replaced token and 429 when rate limited. Read requests are capped at 120 requests / 10 minutes per token hash + IP when trusted proxy headers are enabled; invalid-token probes are capped separately at 30 requests / 10 minutes per IP. Current buckets are process-local memory, so multi-instance deploys need sticky routing or shared limiter storage for global enforcement.
- `POST /portal/:token/upload` - Upload document images via token (public). Validates token, checks file signatures against the declared MIME, stores only supported PDF/JPEG/PNG/WebP/HEIC/HEIF content, then writes RawImage records and triggers async Gemini classification + activity tracking. Returns `INVALID_FILE_CONTENT` before any R2 write or RawImage create when signature and MIME do not match. Returns 400 for invalid files, 401 for invalid token, and 429 when rate limited. Upload requests are capped at 20 requests / hour per token hash + IP when trusted proxy headers are enabled; invalid-token probes use the same separate 30 requests / 10 minutes per IP guard.
- Public portal file lists and upload responses expose safe labels/status only; original filenames, AI-renamed filenames, R2 keys, and signed URLs stay internal.
- PORTAL MagicLink generation: 32-character URL-safe random token, `/upload/:token` route, default 60-day expiry from `MAGIC_LINK_EXPIRY_DAYS`, CASE or GROUP scope, and replacement locking. Staff can reuse active links, extend 7/14/30/60 days, revoke, or replace from the Files tab. Other MagicLink types keep their existing token/expiry behavior.
- Sensitive staff document access: signed URLs default to 900 seconds, workspace cache is shorter than the URL lifetime, and file/media proxy responses use private/no-store cache headers.
- Identity document retention: identity doc types become retention-eligible when staff explicitly clicks `Mark return filed`; review, verification, data entry, checklist completion, and Files tab usage are not prerequisites. Late uploads or reclassification on already-filed cases can schedule retention from the original `filedAt`. The default retention window is 90 days from `IDENTITY_DOC_RETENTION_DAYS`; staff can reopen a filed case to clear pending schedules or extend scheduled identity retention 30/60/90 days. The delete job removes only due R2 objects, preserves DB metadata, marks storage deleted, and logs audit activity without R2 keys, filenames, OCR text, or signed URLs.
- Out of scope: malware/virus scanning and quarantine before CPA preview/download are not implemented yet.

**Portal PDF Viewer (Phase 02-05 Complete):**
- Phase 02: Core react-pdf viewer with fit-to-width scaling, DPI rendering, responsive loading
- Phase 03: iFrame wrapper for public portal page with token validation, view tracking, error handling
- Phase 04: Gesture support (swipe navigation, pinch-to-zoom, double-tap)
- Phase 05: Lazy loading in route to split bundle, auto-hide controls on mobile
- Components: `PdfViewer` (navigation), `PdfDocument` (rendering)
- Features: Fit-to-width, DPI-aware crisp display, touch-friendly controls, fallback buttons
- View tracking: Auto-calls trackDraftView on PDF load (fire & forget)
- Bilingual: Auto-syncs language from client preference (EN/VI)
- Error handling: Invalid token, expired link, revoked link, PDF unavailable, browser unsupported

**Workspace Shared Docs Tab (Phase 04 - Workspace UI Complete):**
- Component: `SharedDocsTab` - Main tab in `/clients/:id` page, manages multi-section ShareableDocument uploads
- Sub-components: `SharedDocCard` (per-doc display), `SharedDocUploadZone` (drag-drop/file picker), `SharedDocLinkBar` (state-driven link display: active/paused/expired/none), `SharedDocVersionHistory` (version list), `AddSectionInlineForm`, `RenameSectionInline`, `DeleteSectionConfirm`, `ActiveLinkPanel`, `ExtendLinkMenu` (7d/14d/30d/Never dropdown), `PauseLinkModal`, `GenerateLinkButton`, `ExpiryBadge` (amber if ≤3 days)
- Hooks: `useSharedDocs()` (CRUD + pauseSection/resumeSection/generateLink + extendSection with duration), `useSharedDocSignedUrl()` (R2 URL generation), `computeLinkState` helper (pure 4-state resolver)
- States: Loading (spinner), Error (retry button), Empty (upload prompt), Active (multi-section list + actions)
- Upload: Drag-drop/file picker, PDF validation (50MB max), automatic multi-section parsing, progress tracking
- Link mgmt: Per-section links (14-day default TTL), copy-to-clipboard (Phase 04 clipboard utility), Pause/Resume (reversible), Extend menu (7d/14d/30d/Never), Generate Link for no-link state, near-expiry amber badge (≤3 days), status badges
- Version history: All document versions per taxCase, uploadedBy + timestamp tracking, current version highlight
- View tracking: Display viewCount + lastViewedAt per document
- Quick actions: `quick-actions-bar.tsx` lists all active section links with copy buttons
- i18n: 26+ keys (EN/VI) for all UI strings, multi-section naming conventions

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

**Public Client Intake Form (3 - Phase 02):**
- `GET /form/:orgSlug` - Get intake form metadata (public, no auth). Returns form fields, validation rules, client language preference
- `GET /form/:orgSlug/:staffSlug` - Get form routed to specific staff member (public). Staff-specific form via formSlug, includes manager assignment
- `POST /form/:orgSlug/submit` - Submit completed intake form (public). Creates Client record with source=GENERIC_FORM (no staff) or STAFF_FORM (routed to staff), optional file uploads, returns confirmationUrl. autoSendFormClientUploadLink controls SMS notification after submission.
- Public endpoints unauthenticated; orgSlug + staffSlug route to correct staff member; ClientSource distinguishes generic forms vs staff-routed forms
- Public registration header contract: `Organization.registrationHeaderMode`, `registrationTitle`, and `registrationSubtitle` control `/register/:orgSlug`. `Campaign.formHeaderMode`, `formTitle`, and `formSubtitle` control `/register/:orgSlug/:campaignSlug`. Modes are `DEFAULT`, `CUSTOM`, and `HIDDEN`; campaign `DEFAULT` inherits org behavior. Header values are sanitized plain text, public responses expose title/subtitle only for `CUSTOM`, stale non-custom copy is suppressed, and campaign `formIntroContent` remains separate rich content above the form.

**Lead Management (9 - Phase 02 API Endpoints + Tag-Based Categorization Complete):**
- `POST /leads` - Create lead from registration form (public, rate-limited 5/min). P2002 duplicate phone+org returns success (idempotent). Accepts `tags` string array for flexible categorization.
- `GET /leads` - List org leads (org-scoped, admin/manager required). Supports pagination (limit 1-100), status filter (NEW|SENT|CONTACTED|CONVERTED|LOST), single tag filter, and full-text search (firstName, lastName, phone, businessName). Returns `latestSms` per lead, plus `selectableTotal` and `bulkSmsMaxRecipients` for bulk-send planning.
- `GET /leads/tags` - Get distinct tags (admin/manager required). Returns array of unique tag strings across all org leads, sorted alphabetically. Used for tag filter dropdowns + tag management UI.
- `GET /leads/:id` - Get lead detail with SMS send history (last 20 SMS logs ordered by sentAt desc). Returns tags array + campaignTag (original source)
- `PATCH /leads/:id` - Update lead (status, notes, firstName, lastName, email, businessName, phone, tags). Phone is optional, normalized to E.164, and validated before update; duplicate phone conflicts return 409. All text fields + tags sanitized. Tags support add/remove mutations. Activity metadata records changed field names only.
- `GET /leads/:id/convert-check` - Check for duplicate client by phone (admin/manager required). Returns hasDuplicate + existingClient data
- `POST /leads/:id/convert` - Convert lead to Client with transaction (create Client + TaxEngagement + TaxCase). Carries over tags to new Client. Optional welcome SMS with magic link. Server enforces phone uniqueness (409 if duplicate)
- `POST /leads/bulk-sms/preview-targets` - Preview eligible bulk SMS recipients before sending. Returns `total`, `selectableTotal`, `returnedIds`, `limit` (200), and `truncated` so workspace can page/filter safely.
- `POST /leads/bulk-sms` - Send bulk SMS to leads with form link personalization. Shared recipient cap comes from `@ella/shared/constants` (`BULK_SMS_MAX_RECIPIENTS = 200`). Supports tag-based filtering + batched concurrency. SMS templates: `{{firstName}}` and `{{formLink}}` replacement. Rejects converted leads before send, returns per-recipient `results` with `sent` / `failed` and structured `errors`, and marks successful new sends as `SENT`.
- `DELETE /leads/:id` - Delete lead (org-scoped, admin/manager required)
- Rate limiter on public create (5/min), authMiddleware + requireAdminOrManager on all protected endpoints (except team management). Phone normalized to E.164 format. Tags: flexible string array (1-100 chars each), stored with GIN index for fast containment queries. SMS integration via Twilio with optional staff form routing

**Team & Organization (19 - Phase 3 + Phase 02 Profile API + Phase 04 Navigation + Phase 02 Intake Form):**
- `GET /org-settings` - Get org profile + autoSendFormClientUploadLink toggle (Phase 02 Intake Form)
- `PATCH /org-settings` - Update org profile + autoSendFormClientUploadLink (admin/manager only, Phase 02 Intake Form)
- `GET /team/members` - Admins list active/archived org staff via `includeArchived`; non-admins get only their own active staff record and must have `staffId` (`400` if missing)
- `POST /team/invite` - Send Clerk org invitation via Backend API (admin only, webhook syncs results to DB)
- `PATCH /team/members/:staffId/role` - Update role via Clerk Backend API (admin only, webhook syncs to DB)
- `DELETE /team/members/:staffId` - Deactivate staff via Clerk Backend API (admin only, webhook syncs to DB)
- `PATCH /team/members/:staffId/contractor-agent` - Toggle `Staff.isContractorAgent` via admin-only backend API (admin only, webhook-independent, DB-backed)
- `GET /team/members/:staffId/profile` - Admins can read any org staff profile with assigned clients; non-admins can read only `me` or their own `staffId` (`403` on cross-member access)
- `PATCH /team/members/:staffId/profile` - Update name/phone/title/preferences (self or admin, Phase 02)
- `POST /team/members/:staffId/avatar/presigned-url` - Get R2 upload URL (self only, Phase 02)
- `PATCH /team/members/:staffId/avatar` - Confirm avatar upload (self only, Phase 02)
- `GET /staff/assignable` - Active org staff list for admin/manager selector workflows; does not relax `/team/members` privacy
- `POST /team/members/:staffId/files/presigned-url` - Create a short-lived R2 upload URL for staff personal documents or invoices. Staff can use `me` or own id; admins can target any org staff member.
- `POST /team/members/:staffId/files` - Confirm staff file upload after R2 metadata verification and create the `StaffFile` record. Invoice uploads replace the active invoice for the same month unless the active invoice is paid.
- `GET /team/members/:staffId/files` - List active staff files, filterable by kind/year/month. Admins can view any org staff member; staff can view only their own files.
- `GET /team/members/:staffId/files/:fileId/download-url` - Return a 900-second signed download URL after owner/admin authorization.
- `DELETE /team/members/:staffId/files/:fileId` - Soft-delete a staff file and mark it inactive. Staff cannot delete their own paid invoices.
- `PATCH /team/members/:staffId/files/:fileId/invoice-status` - Admin-only invoice status mutation with guarded transitions and stale-update conflict handling.
- `GET /staff/me` - Get current staff details with avatarUrl + formSlug field (Phase 04 navigation + Phase 02 Intake Form)
- `PATCH /staff/me/form-slug` - Update personal form slug (self only, Phase 02 Intake Form)
- `GET /client-assignments` - List staff-client mappings
- `POST /client-assignments` - Create assignment (app-level, not Clerk-synced)
- `POST /client-assignments/bulk` - Bulk assign (app-level, not Clerk-synced)
- `PUT /client-assignments/transfer` - Transfer client (app-level, not Clerk-synced)
- Similar for invitations & staff assignments

**Clients (16+ with Tag Support, Phase 10 Entity Separation):**
- `GET /clients` - List with org scoping + sort + tag filters (Phase 2: supports `sort=recentUploads`, returns `uploads: { newCount, totalCount, latestAt }` per client. Tag filtering: hasSome, hasAll operators). Admin/manager filters now match any linked `ClientManager` row. Returns tags + source enum plus manager display fields (`managedBy`, `managedByStaff`).
- `GET /clients/tags` - Get distinct tags (admin/manager required). Returns array of unique tag strings across all org clients, sorted alphabetically. Used for tag filter dropdowns.
- `POST /clients` - Create with organization (admin/manager only). Accepts tags array + source enum (MANUAL, FORM, GENERIC_FORM, STAFF_FORM, CONVERTED). Phase 10: Supports clientType (INDIVIDUAL|BUSINESS), businessType, ein (encrypted as einEncrypted), businessAddress/City/State/Zip for BUSINESS clients.
- `POST /clients/create-with-business` - Combo endpoint (Phase 10, admin/manager only). Creates individual client + business client + ClientGroup in one transaction. Body: individual{firstName, lastName, phone, email, language}, business{name, type, ein, address, city, state, zip}, case{taxTypes, taxYear}, groupName. Returns {individual, business, group, taxCase, magicLink}.
- `GET /clients/:id` - Detail with org verification (Phase 10: returns clientType, einMasked instead of einEncrypted, clientGroupId, business fields for BUSINESS clients). Returns tags array + source enum + conversion metadata, plus manager compatibility fields (`managedById`, `managedBy`, `managedByStaff`).
- `PATCH /clients/:id` - Update profile/intakeAnswers/tags (admin/manager only). Tags support add/remove/replace mutations. Phase 10: Can update clientType, ein (re-encrypted), businessType, business address fields.
- `DELETE /clients/:id` - Deactivate (admin/manager only)
- `GET /clients/:id/resend-sms` - Resend welcome link
- `POST /clients/:id/send-upload-link` - Send upload link SMS to client with random expiring `/upload/:token` URL. Reuses active unexpired links and supports lifecycle controls through Files tab. For business clients with clientGroupId, resolves individual client's taxCase for same year and creates magic link on individual's case—uploads go to individual. Falls back to business case with warning if individual has no taxCase for year. Adds organizationId filter for security.
- `POST /clients/:id/avatar/presigned-url` - Get R2 upload URL for client avatar (Phase 02 Backend)
- `PATCH /clients/:id/avatar` - Confirm avatar upload + return signed download URL (Phase 02 Backend)
- `DELETE /clients/:id/avatar` - Remove client avatar (Phase 02 Backend)
- `PATCH /clients/:id/notes` - Update client notes/internal comments (Phase 02 Backend)
- `GET /activity/recent` - Get org-scoped recent activity timeline with safe DTOs, cursor pagination, and filters (`limit`, `category`, `actorStaffId`, `riskLevel`) (admin/manager only). Invalid cursors return 400 `INVALID_CURSOR`.
- `GET /activity/clients/:clientId` - Get client-scoped activity timeline with safe DTOs and cursor pagination (admin/manager only). Access stays org-scoped; inaccessible clients return 404.
- `GET /clients/:id/activity` - Legacy client overview timeline kept during the workspace migration; sanitized message rows do not include message body snippets.
- `GET /clients/:id/stats` - Get quick stats (totalFiles, taxYears, verifiedPercent, lastMessageAt, Phase 02 Backend)
- Status endpoints for action tracking. Client.source expanded to 5 values: MANUAL, FORM, GENERIC_FORM, STAFF_FORM, CONVERTED.

**Client Groups (5 - Phase 10 Entity Separation):**
- `GET /client-groups` - List org client groups with pagination (limit 1-100, default 20). Supports full-text search by group name. Returns group id, name, client count, timestamps.
- `GET /client-groups/:id` - Get group detail with nested clients array (id, name, clientType, phone). Returns _count.clients for stats.
- `POST /client-groups` - Create group (admin/manager only). Body: name (required), clientIds (optional array). Org-scoped. Returns 201 with created group.
- `PATCH /client-groups/:id` - Update group (admin/manager only). Body: name (optional), addClientIds (add clients to group), removeClientIds (remove clients). Org-scoped. Returns 200 with updated group.
- `DELETE /client-groups/:id` - Delete group (admin/manager only). Org-scoped. Returns 200. No cascade—client relationships preserved (clientGroupId set to null).
- **Auth Pattern:** All routes org-scoped via buildClientScopeFilter. POST requires valid clientIds that exist in org.
- **Data Model:** ClientGroup (id, name, organizationId, clients array relation, createdAt, updatedAt). Index: organizationId for fast lookups. Supports flexible grouping (family businesses, partnerships, multi-entity arrangements).
- **Manager Propagation:** `PATCH /clients/:id/managed-by` accepts compatible `{ staffId?: string | null, staffIds?: string[] }`, normalizes to a unique manager set, syncs `ClientManager` rows in a transaction, and keeps legacy `managedById` / `managedBy` mirrors aligned for rollout compatibility.

**Cases & Engagements (14+):**
- `GET /engagements` - List org engagements
- `POST /engagements` - Create (with copy-from for year reuse)
- `GET /engagements/:id` - Engagement detail
- `PATCH /engagements/:id` - Update profile
- `GET /cases/:id` - Case detail with checklist
- `GET /cases/:id/images` - Case images with `isNew` boolean per image (Phase 2)
- `PATCH /cases/:id` - Update editable case fields and non-filed status transitions. Filed/reopen transitions are rejected here and must use canonical action endpoints.
- `POST /cases/:id/mark-filed` - Canonical filed action. Sets `status=FILED`, `isFiled=true`, clears review state, stamps `filedAt`, and schedules eligible identity document retention.
- `POST /cases/:id/reopen` - Reopens a filed case, resets status to `IN_PROGRESS`, and clears pending identity retention for not-yet-deleted docs.
- `POST /cases/:id/identity-retention/extend` - Extends scheduled identity retention by 30, 60, or 90 days without shortening later schedules.
- Actions for compliance tracking

**Documents & Classification (14+):**
- `POST /documents/upload` - Upload images
- `POST /documents/classify` - Trigger AI classification
- `GET /documents/:id` - Document detail
- `PATCH /documents/:id/verify` - Mark verified with extracted fields
- `GET /documents/:id/ocr` - Request OCR extraction
- `POST /images/:id/mark-viewed` - Create DocumentView record for document view tracking (Phase 2)
- `PATCH /images/:id/reassign-entity` - Move document from one entity to another within same ClientGroup (Phase 04 Entity Routing)
- Endpoints for document lifecycle

**Contractor Management (8 - Phase 08 Client Re-Parent Routes):**
- `GET /clients/:clientId/contractors` - List contractors for business client. Enforces clientType=BUSINESS + org-scope via verifyBusinessClient. Returns contractor list with latest 1099-NEC form per contractor if available (id, firstName, lastName, ssnLast4, address, city, state, zip, email, phone, formId, formStatus, hasCopyA, hasCopyB).
- `POST /clients/:clientId/contractors` - Create contractor (admin/manager only). Body: firstName, lastName, address, city, state, zip, email, phone, tinType (SSN|EIN), ssn. Enforces clientType=BUSINESS. Directly links to Client(clientType=BUSINESS). Returns 201 with created contractor.
- `PATCH /clients/:clientId/contractors/:id` - Update contractor details (admin/manager only). Body: all fields optional. Org-scoped with verifyBusinessClient. Returns 200 with updated contractor.
- `DELETE /clients/:clientId/contractors/:id` - Delete contractor (admin/manager only). Org-scoped with verifyBusinessClient. Returns 204.
- `POST /clients/:clientId/contractors/upload-excel` - Parse nail salon Excel file (admin/manager only). Returns array of parsed contractors with address parsing (regex + AI fallback for ambiguous cities). Org-scoped with verifyBusinessClient.
- `POST /clients/:clientId/contractors/bulk-save` - Batch save parsed contractors to DB (admin/manager only). Body: contractors array with parsed fields. Org-scoped with verifyBusinessClient. Returns 201 with created contractors.
- `DELETE /clients/:clientId/contractors/all` - Delete all contractors for business client (admin/manager only). Org-scoped with verifyBusinessClient. Returns 204.
- `GET /clients/:clientId/contractors/all` - Alternative list endpoint (same as GET /clients/:clientId/contractors).
- **Auth Pattern**: All routes use verifyBusinessClient(clientId, user) + requireAdminOrManager for mutations, enforcing both clientType=BUSINESS + org-scope + role. Audit logging via logProfileChanges(clientId, ...) now uses clientId directly (is business client).
- **Data Model** (Phase 15 Complete): Contractor.clientId is now the sole parent FK (Cascade delete). Contractor.businessId FK removed. All contractors directly linked to Client with clientType=BUSINESS.

**1099-NEC Tax Form Integration (15 routes - TaxBandits API, Phase 09 Client-Scoped Routes):**
- **NEW ROUTES** (Phase 09 - Client-Scoped, preferred):
  - `GET /clients/:clientId/1099-nec/status` - Form status counts (clientType=BUSINESS clients only).
  - `POST /clients/:clientId/1099-nec/create` - Create forms in TaxBandits (DRAFT → IMPORTED). Enforces BUSINESS client via verifyBusinessClient + requireOrgAdmin.
  - `POST /clients/:clientId/1099-nec/fetch-pdfs` - Request & download PDFs to R2 (IMPORTED → PDF_READY).
  - `POST /clients/:clientId/1099-nec/fetch-recipient-pdfs` - Fetch Copy B + C PDFs after IRS transmission (SUBMITTED/ACCEPTED → stored).
  - `POST /clients/:clientId/1099-nec/prepare` - One-click: create forms + fetch draft PDFs combined (single API call).
  - `POST /clients/:clientId/1099-nec/transmit` - Transmit to IRS (PDF_READY → SUBMITTED). Auto-fetches recipient PDFs post-transmission.
  - `GET /clients/:clientId/1099-nec/pdfs` - Signed URLs for all PDF-ready forms (5-min TTL).
  - `GET /clients/:clientId/1099-nec/pdfs/recipient` - Signed URLs for Copy B PDFs (contractor copies, 5-min TTL).
  - `GET /clients/:clientId/1099-nec/:formId/pdf` - Download individual form PDF (signed URL).
  - `GET /clients/:clientId/1099-nec/:formId/pdf/recipient` - Download Copy B PDF (signed URL).
  - `GET /clients/:clientId/1099-nec/batches` - List filing batches for client.
  - `GET /clients/:clientId/1099-nec/batches/:batchId` - Batch details with form statuses.
  - `POST /clients/:clientId/1099-nec/batches/:batchId/refresh` - Refresh batch status from TaxBandits API.
- **Auth Pattern:** All client routes use verifyBusinessClient(clientId, user) + requireAdminOrManager for mutations. Validates clientType=BUSINESS + org-scope.
- **Models:** Form1099NEC (status enum, validation errors, eFile tracking, contractorId FK, batchId FK), FilingBatch (groups forms by tax year + submission, status + timestamps for lifecycle tracking, clientId FK, Cascade delete).
- **TaxBandits Client** (`apps/api/src/services/taxbandits-client.ts`): OAuth 2.0 JWT-based e-filing (form creation, status, PDF request, IRS transmission). Token caching (55-min default), retry with exponential backoff, 30s request timeout.
- **Shared Helpers** (`apps/api/src/routes/form-1099-nec/shared-helpers.ts`, Phase 09):
  - `createFormsInTaxBandits()` - DRY helper for recipient list building + TaxBandits API call + batch creation + form correlation by Sequence ID.
  - `fetchDraftPdfs()` - DRY helper for parallel PDF fetch from TaxBandits S3 + R2 storage + form status updates.
  - Reduces code duplication between /clients and /businesses routes during transition.

**Messages & Voice (15):**
- `GET /messages` - List conversations (org-scoped)
- `POST /messages` - Send SMS/portal/system message
- `GET /conversations/:id/messages` - Thread detail
- `POST /voice/token` - Generate Twilio token (VoiceGrant)
- `POST /voice/presence/register` - Register staff online
- `GET /voice/caller/:phone` - Lookup incoming caller
- Recording endpoints with auth

**Realtime Messaging (Supabase Broadcast):**
- **Backend Publisher** (`apps/api/src/services/realtime/message-publisher.ts`): Publishes lightweight message events to Supabase Broadcast channels after message creation or read-state changes. Event payload includes `eventType` (`message.created`, `message.status.updated`, or `conversation.read`) plus the relevant lightweight fields: `{ conversationId, caseId, leadId, messageId, direction, channel, twilioStatus, twilioErrorCode, unreadCount, readAt, timestamp }`. Org-scoped channels use format `org:{clerkOrgId}:messages`. Non-blocking: publish failures don't interrupt message flow. Gracefully degrades if Supabase not configured.
- **Frontend Subscription** (`apps/workspace/src/hooks/use-realtime-messages.ts`): React hook using Supabase client to subscribe to org-scoped message channels. On event receipt: invalidates React Query caches (`conversations`, `unread-count`, `messages`). Optional `caseId` filter for component-level subscriptions. Gracefully handles missing Supabase config.
- **60-Second Fallback Polling**: Retained as safety net if Realtime unavailable. React Query cache auto-refetch at 60s intervals keeps data fresh.
- **Performance Impact**: Near-instant updates (100-500ms vs 10-30s polling). Org-scoped isolation ensures no cross-org leaks. Broadcast channels auto-cleanup after unsubscribe.

**Read Contract:**
- `POST /messages/:caseId/read` marks an org-scoped case conversation as read, accepts optional `upTo` to preserve newer inbound messages, returns `caseId`, `unreadCount`, and `readAt`, and publishes a non-blocking `conversation.read` realtime event for UI refreshes.

**Webhooks:**
- `POST /webhooks/clerk` - Clerk event sync (user/org/membership lifecycle). Signed with Svix. Handlers: user.updated (sync email/name/avatar), user.deleted (deactivate staff), organization.created/updated (upsert org), organizationMembership.created/updated/deleted (sync staff member, handle out-of-order events). Uses upserts for idempotency. Returns 500 on handler error for Clerk retry.
- `POST /webhooks/twilio/sms` - Twilio incoming SMS webhook. Resolves exactly one active org from recipient Twilio number before client/lead lookup, routes known callers within that org, creates resolved-org placeholder conversations for unknown callers, and publishes realtime events. Unresolved or ambiguous recipient org returns `ORG_NOT_RESOLVED` without cross-tenant phone lookup; there is no global single-org fallback.
- `POST /webhooks/twilio/status` - Twilio SMS delivery status updates (queued, sent, delivered, undelivered, failed). Updates `Message.twilioStatus` + `SmsSendLog.status/error`, persists failed/undelivered details for `latestSms`, and uses an atomic transaction to update Lead status (`NEW`/`SENT` → `CONTACTED`) on confirmed delivery when a matching `SmsSendLog` exists.
- `POST /webhooks/twilio/voice` - Twilio outbound call connection. Returns TwiML for recording setup
- `POST /webhooks/twilio/voice/recording` - Twilio outbound call recording completion. Stores recording URL + duration in Message
- `POST /webhooks/twilio/voice/incoming` - Twilio incoming call from customer. Resolves exactly one active org from called number, routes known callers to linked client managers plus org admins, routes unknown callers to resolved-org admins only, and uses no-staff hangup/missed-call handling if org cannot be resolved, org mapping is ambiguous, or no eligible staff are online. There is no global single-org fallback. Voice callbacks carry called-number context and require resolved org context before missed-call textback or placeholder persistence.
- `POST /webhooks/twilio/voice/status` - Twilio call status updates (terminal states). Updates Message.callStatus + content
- `POST /webhooks/twilio/voice/dial-complete` - Twilio dial completion (after ring timeout). Returns missed-call/no-staff hangup TwiML when unanswered
- `POST /webhooks/twilio/voice/voicemail-recording` - Twilio voicemail recording completion. Creates voicemail message for known/unknown callers, increments conversation.unreadCount
- `POST /webhooks/twilio/voice/inbound-recording` - Twilio inbound call recording completion. Stores recording URL + duration for answered inbound calls

## Multi-Tenancy Architecture

**Organization Model:**
```
Organization (root entity)
├── clerkOrgId (unique, synced from Clerk)
├── name, slug, logoUrl, isActive
└── Relations:
    ├── Staff[] (organization members)
    ├── Client[] (org clients, ClientManager links; managedById retained for compatibility)
    └── Audit[] (all changes)
```

**Data Scoping:**
- `buildClientScopeFilter(user)` - Core scoping function
- **Admin/Manager:** See all org clients
- **Staff:** See only clients with any matching `ClientManager` link for the current staff member; legacy `managedById` remains a compatibility mirror during rollout
- Applied to: Clients, Cases, Engagements, Messages, Documents, Images, Actions
- **Predicates:** `isAdminOrManager(user)` returns true for org:admin, ADMIN, or MANAGER roles; `canSeeAllClients(user)` wraps same logic for scope filter

**Permission Model:**
- **ADMIN:** Full org management: team (invite/role/deactivate), all clients, admin config, billing, leads, cases, campaigns, agreements, 1099-NEC, org settings, activity timeline
- **MANAGER:** Client/operational mgmt: admin config, clients (create/assign), leads, cases, campaigns, agreements, 1099-NEC, billing checkout, org settings, activity timeline. Can open `/team` in self-mode and use own Team profile; blocked from team management. **Phone Privacy (Phase 3):** Server enforces masking on all workspace-facing responses (clients, leads, messages, engagements, cases, actions, managed-clients)—`serializePhone()` at response layer returns `*** *** {last4}` except for ADMIN. Internal SMS/lead-convert/voice logic uses raw numbers.
- **STAFF:** View assigned clients only via `ClientManager` links; no admin functions. Can open `/team` in self-mode and use own Team profile. Receives masked phone numbers.
- **CPA:** Future role for CPA firm integrations

**Middleware:**
- `requireOrg` - Verify orgId in JWT, all protected endpoints
- `requireOrgAdmin` - Verify org:admin role (Clerk or app ADMIN), team endpoints only (invite/role/deactivate)
- `requireAdminOrManager` - Verify org:admin, app ADMIN, or app MANAGER, non-team admin-gated endpoints

**RBAC Regression Tests (Phase 5 - MANAGER Role):**
- `apps/api/src/lib/__tests__/org-scope.test.ts` - MANAGER org-wide scope filter, STAFF/CPA assigned-only, no-staffId/no-org failsafes
- `apps/api/src/lib/__tests__/phone-privacy.test.ts` - `canViewFullPhone` (ADMIN-only), `maskPhone` null/short/format, `serializePhone` per role
- `apps/api/src/lib/__tests__/staff-role-mapping.test.ts` + `apps/api/src/services/auth/__tests__/auth.test.ts` - Clerk sync preserve rule: org:member + existing MANAGER stays MANAGER (no downgrade), org:admin→ADMIN, ADMIN demoted via Clerk→STAFF
- `apps/api/src/routes/__tests__/manager-role-authorization.test.ts` - Route-level matrix through real middleware: MANAGER 200 on /clients (org-wide where clause), /admin, /leads; 403 on /team mutations; raw response-body scan proves no unmasked phone for MANAGER/STAFF, full phone for ADMIN

**Audit Logging:**
- AuditLog tracks: entity type, id, field, old/new values, changedBy, timestamp
- All org-scoped changes logged for compliance
- ActivityLog tracks server-side business actions with category, target, actor, risk, and safe summary fields; metadata is redacted before persistence and should not be rendered raw in UI.
- Timeline and activity surfaces should use `toActivityTimelineItem()` or equivalent safe DTOs, not the stored metadata JSON.

## Database Schema

**Key Models (Multi-Tenant):**
- **Organization** - Org root with Clerk integration, autoSendFormClientUploadLink (bool, Phase 02 Intake Form - auto-send SMS to staff on form submission)
- **Staff** - organizationId FK, clerkId (unique), role (ADMIN|MANAGER|STAFF|CPA), notifyOnUpload (default: true), isContractorAgent (default: false), title, signaturePngKey, formSlug (auto-generated six-digit unique slug per org for public form routing, editable by staff/admin). Notification preferences for client upload alerts and contractor-agent compliance.
- **Client** - organizationId FK, managedById FK (legacy primary manager during rollout; `ClientManager` is canonical), firstName, lastName, phone, email, language, profile data, intakeAnswers Json, avatarUrl (optional signed R2 URL), notes (HTML up to 50KB), notesUpdatedAt, source (enum: MANUAL|FORM|GENERIC_FORM|STAFF_FORM|CONVERTED, Phase 02 Intake Form), clientType (enum: INDIVIDUAL|BUSINESS, default INDIVIDUAL). For clientType=BUSINESS: businessType (BusinessType enum, required), einEncrypted (encrypted, required), businessAddress, businessCity, businessState, businessZip (all required). Database stores einEncrypted; API returns einMasked (XX-XXX####). clientGroupId FK (optional, links related clients like individual+business or partnerships). Relations: contractors, filingBatches, intakeTokens (all BUSINESS-type specific).
- **ClientManager** - tenant-scoped canonical join row between Client and Staff. Backfilled from legacy managedById, unique on `[clientId, staffId]`, with org-scoped guards and tenant-scoped foreign keys.
- **ClientGroup** - organizationId FK (optional, org-scoped grouping), name (group name), clients array relation. Phase 01 Entity Separation: new entity enables flexible grouping of related clients (e.g., family businesses, partnerships, multi-entity tax arrangements). Indexed on organizationId for fast group lookups.
- **Business** - REMOVED in Phase 15. Business model deleted from schema. All business information now stored directly on Client(clientType=BUSINESS) records.
- **TaxCase** - Year-specific tax case, engagementId FK
- **TaxEngagement** - Year-specific engagement (copy-from support)
- **ScheduleCExpense** - 20+ fields, version history
- **ScheduleEExpense** - 1:1 with TaxCase. Status (DRAFT/SUBMITTED/LOCKED), up to 3 rental properties (JSON array), 7 IRS expense fields (insurance, mortgage interest, repairs, taxes, utilities, management fees, cleaning/maintenance), custom expense list, version history, property-level totals
- **PaymentQuote** - checkout quote record for Stripe billing. Stores organization/client/lead links, customerEmail/customerName/businessName, inputSnapshot/resultSnapshot, monthlyTotalCents/setupTotalCents, status, createdByStaffId, and related checkout sessions.
- **PaymentTemplate** - org-scoped reusable custom-link preset. Stores organizationId, name, optional description, JSON `items` payload (line items only), createdByStaffId, archivedAt soft delete, createdAt, and updatedAt. Recipient/customer, discount, Stripe session/link, sent, and quote-status fields stay on `PaymentQuote`. Active names are unique per organization only while `archivedAt` is null, and creator attribution is tenant-guarded at the DB layer.
- **CompanyVaultCredential** - org-scoped shared credential row for staff tooling. Fields: organizationId, toolName, usernameEncrypted, passwordEncrypted, noteEncrypted, createdAt, updatedAt. `toolName` is plaintext for display/search; optional username/password/note are encrypted at rest and decrypted only for authenticated org-scoped API responses. Hard delete removes the row, and related activity metadata stores ids/field names only.
- **StripeCheckoutSession** - Stripe session mirror keyed by `stripeSessionId`. Stores paymentQuoteId, Stripe customer/subscription/paymentIntent ids, status, url, expiresAt, paidAt, and timestamps.
- **Contractor** - clientId FK (Cascade delete, only parent). Links to Client(clientType=BUSINESS). firstName, lastName, tinType (SSN|EIN), ssnEncrypted (encrypted), ssnLast4, address, city, state, zip, email, phone.
- **ContractorAgreementAcceptance** - staffId FK + organizationId FK. Independent Contractor agreement acceptance for Contractor Agent staff. Fields: version, signedAt, signedPdfR2Key, sourceTemplateR2Key, pdfSha256, signerName, signerEmail, signerIpAddress, signerUserAgent, firmSignerName, firmSignerEmail, firmSignerTitle, firmSignaturePngKey. Unique on `[staffId, version]`.
- **StaffFile** - org-scoped staff upload record for personal documents and invoices. Fields: organizationId, staffId, uploadedByStaffId, kind (PERSONAL_DOCUMENT|INVOICE), title, category, originalFilename, mimeType, fileSize, r2Key (unique), checksumSha256, invoiceYear, invoiceMonth, invoiceStatus, replacedById, isActive, reviewedByStaffId, reviewedAt, paidAt, adminNote, deletedAt, deletedByStaffId. Contract: invoice rows require invoiceYear/invoiceMonth/invoiceStatus and invoiceMonth 1-12; personal documents must not carry invoice metadata or paidAt. Indexes: organizationId+staffId+kind, organizationId+kind+invoiceYear+invoiceMonth. Storage keys use `staff-files/{org}/{staff}/documents/{uuid}.{ext}` or `staff-files/{org}/{staff}/invoices/{yyyy-mm}/{uuid}.{ext}` and storage logs redact `staff-files/...` keys.
- **FilingBatch** - clientId FK (Cascade delete, only parent). Links to Client(clientType=BUSINESS). taxYear, status (PENDING|SUBMITTED|PROCESSING|ACCEPTED|PARTIALLY_ACCEPTED|REJECTED), TaxBandits submission tracking (taxbanditsSubmissionId, submittedAt, acceptedAt, rejectedAt, rejectionReason), form counts (totalForms, acceptedForms, rejectedForms), e-file settings (tinCheckEnabled, uspsEnabled, eDeliveryEnabled).
- **ContractorIntakeToken** - clientId FK (Cascade delete, only parent). Links to Client(clientType=BUSINESS). Public intake form token for contractors. token (unique), taxYear, isActive (default true), expiresAt (optional TTL). Indexes: token (unique), clientId+isActive.
- **RawImage** - Classification states, AI confidence, perceptual hash, re-upload tracking, relationships to documentViews, documentGroupId FK (Phase 2/3 multi-page grouping), pageNumber (Phase 3 page order detection), aiMetadata JSON (Phase 1 metadata extraction: taxpayerName, ssn4, pageMarker with currentPage/totalPages, continuationMarker). Phase 01 Entity Routing: entityConfidence (AI confidence 0-1 for entity detection), routedFromCaseId (audit trail for docs re-routed to correct ClientGroup member, indexed for fast lookups)
- **DocumentView** - Staff document view tracking (staffId + rawImageId unique composite). Tracks which staff members viewed which RawImage documents with timestamp (viewedAt). Enables per-CPA "new upload" badge calculations and document engagement metrics.
- **DocumentGroup** - Phase 2/3 multi-page document grouping: baseName (base filename), documentType (identified type), pageCount (pages in group), confidence (AI confidence), images relation (array of RawImages). Indexes: caseId, caseId+createdAt. Phase 3 Enhancement: sortDocumentsByPageMarker() orders docs by extracted pageMarker.currentPage with fallback to upload order. validatePageSequence() checks for gaps and duplicates in page ordering.
- **DigitalDoc** - OCR extracted fields
- **ShareableDocument** (Prisma model name; table preserved as `DraftReturn` via `@@map`) - taxCaseId FK (Cascade delete), r2Key (unique storage), filename, fileSize, title (default: "Draft Return", min 1 / max 100 chars, unique per case+ACTIVE+non-deleted), version tracking (auto-increment per section via (taxCaseId, title) grouping; rename propagates title across all versions to keep grouping stable), uploadedById FK to Staff, status (DocumentStatus enum: ACTIVE|REVOKED|EXPIRED|SUPERSEDED), viewCount, lastViewedAt, deletedAt (soft-delete — single source of truth for "removed"), magicLinks relation. Indexes: taxCaseId, (taxCaseId, status, deletedAt)
- **ActivityLog** - canonical org-scoped event stream for business actions. Fields: organizationId, clientId, caseId, rawImageId, magicLinkId, category, targetType, targetId, targetLabel, summary, actorType, actorStaffId, action, riskLevel, redacted metadata, request context. Indexes support org/category, target lookup, and actor/category lookup. Used for upload links, portal rate limits, document access, staff-file workflows, retention jobs, profile/team/settings changes, leads, auth, and other system events. Staff-file mutations emit document-category actions such as `document.staff_file_uploaded`, `document.staff_file_deleted`, `document.staff_file_downloaded`, and `document.staff_invoice_status_updated`.
- **MagicLink** - type (PORTAL|SCHEDULE_C|SCHEDULE_E|DRAFT_RETURN), token (unique, 12-char base36), caseId/type reference, optional `draftReturnId` FK (SetNull) pointing at current ShareableDocument — FK column name preserved for zero data movement, isActive, expiresAt (14-day TTL for DRAFT_RETURN, null for others), usageCount, lastUsedAt. On version upload the same token is retained and `draftReturnId` is repointed to the new version. Indexes: token (unique), caseId+type, draftReturnId
- **Message** - SMS/PORTAL/SYSTEM/CALL channels
- **AuditLog** - Complete change trail
- **Lead** - Marketing lead capture. Fields: id (cuid), firstName, lastName, phone (unique per org + organizationId), email, businessName, status (NEW|SENT|CONTACTED|CONVERTED|LOST), campaignTag (renamed from source; eventSlug or null), tags (String[] for categorization, auto-populated from campaignTag on creation), notes (5KB max), organizationId FK, convertedToId FK (Client, null if not converted), createdAt/updatedAt. Indexes: organizationId+status, organizationId+phone, tags (GIN). Phase 02 Marketing API Complete. Phase 01 Tag-Based Categorization Added.
- **SmsSendLog** - Audit trail for SMS to leads. Fields: id (cuid), message, status (SENT|DELIVERED|UNDELIVERED|FAILED), twilioSid (optional), error (optional), sentAt timestamp, createdAt/updatedAt. Relations: leadId FK, sentById FK (Staff), organizationId FK. Used by bulk-sms endpoints to track per-message delivery and drive `latestSms` summaries. Phase 02 Marketing API Complete.

**Phase 02 Types (Document Upload Notification & Intake Form):**
- **ClientUploads** - Type: `{ newCount: number, totalCount: number, latestAt: string | null }`. Per-client upload tracking based on DocumentView records. `newCount` = images without DocumentView record (unviewed). `totalCount` = all images in client's cases. `latestAt` = most recent image createdAt serialized for API clients. Included in GET /clients response via aggregation query.
- **ClientSource** - Enum: `MANUAL | FORM | GENERIC_FORM | STAFF_FORM | CONVERTED`. Tracks client origin: MANUAL = created via staff portal, FORM = deprecated (phase 02), GENERIC_FORM = created via public intake form, STAFF_FORM = created by staff via form link, CONVERTED = converted from Lead. Phase 01 Tag-Based Categorization extended enum.
- **Client Tags** - Phase 01 addition. String[] field for flexible categorization beyond source. Indexed via GIN for fast filtering.

**Indexes:**
- Organization: clerkOrgId (unique), name
- Staff: organizationId + clerkId (compound unique)
- Client: organizationId + status, managedById (legacy FK index kept for compatibility)
- ShareableDocument: taxCaseId (single), taxCaseId + status + deletedAt (compound), status (single) - optimize case-to-documents + status filtering with soft-delete awareness
- Messages: conversationId + createdAt (ordering)

## Phase 04: Business Entity Separation — Data Migration

**Overview:**
Convert existing Business records into top-level Client records with `clientType=BUSINESS`, creating ClientGroups to link individual owners to their businesses. Industry-standard model matching Canopy, TaxDome, Karbon.

**Migration Script:** `apps/api/scripts/migrate-business-to-client.ts`

**Process:**
1. Query all Business records with owner Client + related Contractor/FilingBatch/ContractorIntakeToken records
2. For each Business (idempotent check via unique phone):
   - Create new Client(clientType=BUSINESS) with business fields (name, businessType, EIN, address)
   - Create/reuse ClientGroup grouping owner + business
   - Update all Contractor → clientId (new business client)
   - Update all FilingBatch → clientId (new business client)
   - Update all ContractorIntakeToken → clientId (new business client)
3. Transaction-wrapped per business, 30s timeout, per-business error handling

**Idempotency:**
- Phone field: `biz-{businessId}` placeholder (unique per source business)
- Existing migrated records skipped via phone lookup
- Safe to re-run without duplicates

**CLI Flags:**
- `--dry-run` — Log planned changes without executing
- `--confirm` — Required for live mode (safety guard)
- `--org-id <id>` — Optional, migrate single org only (testing)

**Usage:**
```bash
cd apps/api
# Preview changes
npm run migrate:business-to-client -- --dry-run

# Execute migration (requires confirmation)
npm run migrate:business-to-client -- --confirm

# Test single org
npm run migrate:business-to-client -- --dry-run --org-id <orgId>
```

**Output:** Migration summary (total, migrated, skipped, errors, groups created, records updated)

**Data Integrity:**
- All Contractor/FilingBatch/ContractorIntakeToken data preserved
- EIN remains encrypted, no re-encryption needed
- Org/manager assignments maintained on business client
- Phase 15 Complete: Business model removed, all business data now on Client(clientType=BUSINESS)

## Authentication Flow

**Request-Time (Read-Only) Pattern:**
1. Frontend logs in via Clerk UI
2. Receives JWT with: userId, orgId, orgRole (org:admin|org:member)
3. Frontend sets JWT in Authorization header (Bearer token)
4. Backend middleware extracts claims (read-only: no DB writes)
5. Middleware looks up Staff by clerkId from DB (verify staff exists)
6. No sync occurs at request time — auth is stateless DB lookup

**Event-Time (Async) Pattern:**
- Clerk events trigger webhook on state changes (user/org/membership)
- Webhook handler syncs to DB asynchronously (decoupled from requests)
- DB becomes eventual-consistent with Clerk state

**Org Verification:**
- All endpoints verify orgId from JWT matches resource org
- Staff see only managed clients via matching `ClientManager` rows; `managedById` mirrors the primary manager only for compatibility during rollout
- Upload notifications and incoming voice-call routing use `ClientManager` links so secondary managers are included in operational workflows. Upload notifications also include org admins who keep `notifyOnUpload` enabled.
- Admins see all org clients

## Clerk Webhook Sync (Event-Driven User/Org Sync)

**Overview:**
Webhooks from Clerk sync user, organization, and membership changes to DB in real-time. Single source of truth: Clerk state flows to DB via webhooks + JWT token parsing. Handlers use Prisma upserts for idempotency (safe on event retries).

**Event Handlers:**
- **user.updated** - Sync email, name, avatar to Staff (updateMany by clerkId)
- **user.deleted** - Deactivate staff (isActive=false, set deactivatedAt)
- **organization.created/updated** - Upsert Organization (handles out-of-order events)
- **organizationMembership.created** - Link user to org: (1) ensure org exists (upsert), (2) check if staff exists by email (pre-existing), (3) upsert/update staff with clerkId, resolve role via preserve rule (org:admin→ADMIN; org:member→respect metadata.staffRole or preserve existing MANAGER/STAFF/CPA, default STAFF), org assignment
- **organizationMembership.updated** - Update staff role using preserve rule: org:admin→ADMIN, org:member→demote ADMIN to STAFF only, preserve MANAGER/STAFF/CPA on re-sync
- **organizationMembership.deleted** - Deactivate staff for that org (scope by organizationId + clerkId)

**Route Handler (POST /webhooks/clerk):**
- Svix signature verification (svix-id, svix-timestamp, svix-signature headers)
- Awaits handler so Clerk retries on failure (500 = retry, 400 = permanent failure)
- Svix verification error → 400, handler error → 500

**Error Handling & Idempotency:**
- Each handler validates required fields before DB operations
- Missing fields → log warning, return gracefully (no error thrown)
- Upsert pattern prevents duplicates on re-delivery
- Out-of-order events: membership.updated may arrive before .created; org.updated upserts to handle created arriving late

**Key Insights:**
- Membership created handler checks if staff exists by email (legacy pre-Clerk staff may have email but no clerkId yet)
- Deactivation uses isActive flag + deactivatedAt timestamp (soft delete pattern)
- Organization slug optional (null allowed)
- Field mapping: Clerk identifier field (email) → Staff.email

## Phase 02: Portal PDF Viewer - Core React PDF Rendering

**Overview:**
Mobile-first PDF viewer using react-pdf library with fit-to-width scaling, DPI-aware rendering, and responsive skeleton loading. Lazy-loaded to avoid bundling react-pdf (~150KB) for users who don't view PDFs.

**Components:**
```
apps/portal/src/components/pdf-viewer/
  ├── index.tsx
  │   ├── Page navigation state (currentPage, numPages)
  │   ├── Load handlers (success/error callbacks)
  │   ├── Gesture handler integration (swipe, pinch, double-tap)
  │   ├── Auto-hide controls UI (visible toggle)
  │   └── Navigation + controls bar with auto-hide
  │
  ├── pdf-document.tsx
  │   ├── ResizeObserver for container width tracking
  │   ├── Fit-to-width calculation
  │   ├── DPI-aware rendering (devicePixelRatio)
  │   ├── Loading state with pulse skeleton
  │   └── Error state with fallback buttons
  │
  ├── pdf-controls.tsx
  │   ├── Navigation buttons (← →)
  │   ├── Page indicator (current/total)
  │   ├── Mobile-optimized touch targets (44px min)
  │   └── Fade in/out animation
  │
  ├── use-pdf-gestures.ts
  │   ├── Swipe detection (left/right for page nav)
  │   ├── Pinch-to-zoom (scale factor)
  │   ├── Double-tap to fit-width reset
  │   └── Touch event listeners + cleanup
  │
  └── use-auto-hide.ts
      ├── Auto-hide timer (3s default after interaction)
      ├── show() callback to reset and display
      ├── Cleanup on unmount
      └── Configurable delay + initial visibility
```

**Key Features:**

1. **Fit-to-Width Scaling**
   - Calculates natural PDF width from rendered canvas
   - Scale formula: `containerWidth / naturalWidth`
   - ResizeObserver tracks responsive width changes
   - Prevents recalculation race conditions (hasCalculatedFit ref)

2. **DPI-Aware Rendering**
   - Multiplier: `window.devicePixelRatio` (1.0 on standard, 2.0+ on retina)
   - Effective scale: `fitScale × dpiMultiplier`
   - Crisp rendering on high-DPI displays

3. **Loading State**
   - 8.5:11 aspect ratio placeholder (max-w-[400px])
   - Pulse animation during fit calculation
   - Prevents layout shift (min-h-0 on scrollable container)

4. **Error Handling**
   - Browser unsupported fallback (AlertTriangle icon)
   - Open in New Tab button (external link icon)
   - Download PDF button (file-down icon)
   - Bilingual error messages (EN/VI via i18n)

**Props (PdfViewer):**
```typescript
interface PdfViewerProps {
  url: string         // PDF URL from signed R2 link
  filename: string    // Original filename for download
}
```

**Data Flow:**
1. Page route passes url + filename to PdfViewer
2. PdfDocument loads Document from react-pdf
3. ResizeObserver measures container width
4. Page renders at scale 1, canvas renders
5. onRenderSuccess handler calculates fit scale
6. Page re-renders at `fitScale × dpi` for crisp display
7. Page navigation controls currentPage state
8. PdfViewer renders selected page at calculated scale

**Bundle Impact:**
- react-pdf (~150KB gzipped) lazy-loaded via dynamic import in route
- Index.tsx + pdf-document.tsx: minimal (~3KB together)
- Saves ~150KB bundle for non-PDF users
- Worker (pdf.js) fetched from unpkg CDN (matches workspace pattern)

**Localization Keys:**
```
draft.loadingPdf     → "Loading PDF..."
draft.viewerUnsupported  → "PDF Viewer Unavailable"
draft.viewerFallback → "Your browser cannot display PDFs directly..."
draft.openInNewTab   → "Open in New Tab"
draft.download       → "Download PDF"
```

**Browser Compatibility:**
- Modern browsers: Full react-pdf support with fit-to-width
- Mobile: Touch-friendly navigation, zoom support
- Fallback: Download/open buttons if library fails
- Workers: PDF.js from unpkg CDN (no build step needed)

**Future Enhancements:**
- Fullscreen mode toggle
- Keyboard shortcuts (+ - 0 for zoom/reset, arrow keys for navigation)
- PDF annotation/markup (draw on PDF in workspace)
- Side-by-side document viewer for comparison

## Phase 03: Portal PDF Viewer - Token-Based Draft Return Viewing

**Overview:**
Public-facing draft tax return viewer accessible via magic link tokens. No authentication required. Supports bilingual UI (EN/VI), view tracking, and error states for invalid/expired/revoked links.

**Route & Components:**
```
apps/portal/src/routes/draft/$token/index.tsx
  ├── Page load → GET /portal/draft/:token
  ├── Validate token (type, active, expiry)
  ├── Return draft data + signed PDF URL
  ├── Auto-sync client language preference
  ├── Track view on PDF load
  └── Lazy load PdfViewer via dynamic import (Phase 05)

apps/portal/src/components/pdf-viewer/ (modular structure)
  ├── index.tsx - Main viewer with gesture + auto-hide integration
  ├── pdf-document.tsx - Core react-pdf rendering
  ├── pdf-controls.tsx - Mobile-optimized touch controls
  ├── use-pdf-gestures.ts - Swipe/pinch/double-tap detection
  └── use-auto-hide.ts - Auto-hide controls on inactivity
```

**Data Flow:**
1. Client receives magic link email: `/draft/abc123token`
2. Client clicks link (no login required)
3. Frontend fetches `GET /portal/draft/abc123token`
4. Backend validates: token exists, type=DRAFT_RETURN, isActive=true, !expired, updates usageCount
5. Backend returns: clientName, taxYear, version, pdfUrl (signed R2 URL, 15min TTL)
6. Frontend syncs language from clientLanguage field
7. PdfViewer renders iFrame with pdfUrl
8. On successful load, frontend calls `POST /portal/draft/abc123token/viewed` (fire & forget)
9. Backend increments viewCount, updates lastViewedAt

**Error States:**
- `INVALID_TOKEN` - Token not found in database
- `LINK_REVOKED` - Staff revoked the draft access
- `LINK_EXPIRED` - Token expiresAt date passed
- `DOC_DELETED` - Document soft-deleted by CPA (HTTP 410 from Phase 02 API) - Phase 05 addition, suppresses retry button
- `PDF_UNAVAILABLE` - R2 signed URL generation failed
- Browser unsupported - iFrame load error, fallback to download/open buttons

**API Endpoints:**
- `GET /shared-docs/:token` - Public, no auth, returns ShareableDocumentData (multi-section portal view)
- `POST /shared-docs/:token/viewed` - Public, fire & forget, updates view tracking per section

**Portal API Client (apps/portal/src/lib/api-client.ts):**
```typescript
export interface ShareableDocumentData {
  clientName: string           // Display name
  clientLanguage: 'EN' | 'VI'  // Auto-sync language
  taxYear: number              // Tax year
  version: number              // Document version
  title: string                // Section title (custom or "Draft Return" default) - Phase 05 addition
  filename: string             // Original filename
  uploadedAt: string           // ISO8601
  pdfUrl: string              // Signed R2 URL (15min expiry)
  sections?: Array<{           // Multi-section support (Phase 04)
    id: string                 // Section identifier
    title: string              // Section title
    status: 'ACTIVE' | 'REVOKED' // Section-level status
  }>
}

portalApi.getSharedDoc(token: string) → Promise<ShareableDocumentData>
portalApi.trackSharedDocView(token: string) → Promise<void>
```

**Localization Keys:**
```
draft.title              → "Draft Tax Return for Review" (fallback if title missing - Phase 05)
draft.titleFormat        → "{{title}} for Review" (dynamic title per section - Phase 05, pending i18n)
draft.loading            → "Loading your draft tax return..."
draft.taxYear            → "Tax Year"
draft.version            → "Version"
draft.contactCpa         → "Please contact your CPA if you have any questions."
draft.errorTitle         → "Unable to Load"
draft.errorLoading       → "Could not load the draft tax return. Please try again."
draft.errorInvalidLink   → "This link is not valid. Please contact your CPA for a new link."
draft.errorRevoked       → "This link has been revoked. Please contact your CPA."
draft.errorExpired       → "This link has expired. Please contact your CPA for a new link."
draft.errorDeleted       → "This document has been removed by your CPA." (Phase 05, pending i18n)
draft.linkInvalid        → "Link Invalid"
draft.viewerUnsupported  → "PDF Viewer Unavailable"
draft.viewerFallback     → "Your browser cannot display PDFs directly. Please use the buttons below."
draft.openInNewTab       → "Open in New Tab"
draft.download           → "Download PDF"
```

**Security:**
- Token validation: Checks type=DRAFT_RETURN, isActive=true, expiresAt > now
- Signed URL expiry: 15 minutes (prevents URL sharing beyond session)
- No sensitive data exposure: Error messages don't reveal internal details
- Magic link type safety: Only DRAFT_RETURN type can access this endpoint
- Cross-origin: iFrame sandbox="allow-same-origin allow-scripts" prevents XSS

**View Tracking:**
- Called on successful PDF load (fire & forget pattern)
- Updates `ShareableDocument.viewCount` and `lastViewedAt`
- Staff can monitor engagement in workspace dashboard
- No sensitive data logged (token only)

**Browser Compatibility:**
- Modern browsers: iFrame native PDF viewer
- Fallback browsers (some mobile): Download PDF or open in new tab
- onError handler detects iFrame load failure

**Performance:**
- Single GET request to validate token + fetch metadata
- R2 signed URL good for 15 minutes (client-side PDF load)
- View tracking is async (doesn't block UI)
- No polling or refetching after load

**Accessibility:**
- ARIA roles: role="status" for loading, role="alert" for errors
- aria-label for loading state and error messages
- Keyboard navigation: Tab through action buttons in error state
- Retry button available for non-permanent errors

## Phase 04-05: Portal PDF Viewer - Gestures & Lazy Loading Integration

**Overview (Phase 04):**
Mobile gesture support for PDF viewer: swipe-to-navigate pages, pinch-to-zoom, and double-tap to reset zoom. Auto-hide controls bar after 3 seconds of inactivity with mobile-optimized touch targets (44px minimum).

**Overview (Phase 05):**
Lazy load PdfViewer component in route via dynamic import to split bundle (~155KB chunk). Removed old iframe-based pdf-viewer.tsx in favor of gesture-enabled modular components. Integrated auto-hide controls with Suspense fallback for smooth UX.

**Route Integration (`apps/portal/src/routes/draft/$token/index.tsx`):**
```typescript
// Lazy load PDF viewer to split bundle (~155KB)
const PdfViewer = lazy(() => import('../../../components/pdf-viewer'))

// In JSX: Wrap with Suspense for smooth loading
<Suspense fallback={<PdfLoadingSkeleton />}>
  <PdfViewer url={data.pdfUrl} filename={data.filename} />
</Suspense>
```

**Bundle Impact:**
- react-pdf (~155KB gzipped) lazy-loaded on-demand
- Dynamic import splits into separate chunk
- Non-PDF users: Zero impact on initial bundle
- PdfLoadingSkeleton: Lightweight fallback UI during chunk load

**Gesture Hook (`use-pdf-gestures.ts`):**
```typescript
const { scale, onTouchStart, onTouchMove, onTouchEnd, resetZoom } = usePdfGestures()

// Touch listeners track:
- Single-finger swipe: Left/right triggers page navigation
- Two-finger pinch: Scale multiplier (1.0 to 3.0)
- Double-tap: Reset scale to 1.0 (fit-width)
- Momentum-aware: Only trigger nav on sufficient swipe distance
```

**Auto-Hide Hook (`use-auto-hide.ts`):**
```typescript
const { visible, show } = useAutoHide({ delay: 3000, initialVisible: true })

// Triggers on:
- User interaction (touch, mouse move)
- Page navigation (next/prev buttons)
- Zoom changes (pinch)
// Hides after 3s inactivity
```

**Controls Component (`pdf-controls.tsx`):**
```
Mobile-optimized UI:
- Button size: 44px (touch target minimum)
- Fade animation: Opacity transition 200ms
- Position: Bottom bar with safe-area-inset-bottom
- Buttons: Previous, Page Indicator, Next
- Responsive: Adapts to viewport width
```

**Mobile-First Design:**
- Touch-friendly spacing (gap-2 between buttons)
- Full-width viewport usage (h-dvh = dynamic viewport height)
- Auto-hide improves immersion (controls fade after interaction)
- Swipe-to-navigate intuitive for mobile users
- Pinch-to-zoom native gesture (matches user expectations)

**Data Flow (Phase 05):**
1. Route fetches draft data via portalApi.getDraft()
2. On success, renders PdfViewer with Suspense fallback
3. Browser downloads react-pdf chunk (~155KB) via dynamic import
4. PdfViewer mounts: initializes gesture hooks + auto-hide
5. User touches PDF: show() resets auto-hide timer, controls visible
6. User swipes left: gesture handler calls goToNextPage()
7. User pinches: scale updates, gesture handler manages zoom
8. 3 seconds of inactivity: controls fade out automatically
9. User taps again: show() restores controls visibility

**Cleanup & Migration:**
- Deleted: Old `apps/portal/src/components/pdf-viewer.tsx` (iframe-based)
- Reason: Replaced by modular gesture-aware components
- Migration: Route now uses lazy-loaded PdfViewer directory

**Browser Support:**
- Touch events: Modern mobile browsers (iOS Safari 13+, Chrome Android)
- Pinch detection: Native touch events (no library needed)
- Swipe detection: Distance + velocity calculation
- Fallback: Native PDF controls still available if gestures fail

---

## Phase 05: Portal Viewer - Header UI Updates (Dynamic Title + Ella Logo) (COMPLETE)

**Overview:**
Portal draft viewer header redesign to display dynamic document titles and Ella branding. Each section can have a custom title (e.g., "2024 Tax Return" vs "Draft Financials") rendered as `{title} for Review`. Ella logo added to header (top-left) with light/dark mode support. New error state for soft-deleted documents (HTTP 410 DOC_DELETED).

**Files Changed:**
- `apps/portal/src/lib/api-client.ts` — Added `title: string` to `ShareableDocumentData` interface (Phase 02 API addition)
- `apps/portal/src/routes/draft/$token/index.tsx` — Logo imports, header layout redesign, dynamic title rendering, DOC_DELETED error handling

**Header Layout (Phase 05 Update):**
```tsx
// New 3-column header with logo + centered title
<div className="flex items-center justify-between mb-2">
  <img src={EllaLogoLight} alt="Ella" className="h-6 w-auto dark:hidden" />
  <img src={EllaLogoDark} alt="Ella" className="h-6 w-auto hidden dark:block" />
  <div /> {/* spacer for center alignment */}
</div>
<h1 className="text-base font-semibold text-foreground text-center">
  {t('draft.titleFormat', { title: data.title })}
</h1>
```

**Logo Implementation:**
- Import: `import { EllaLogoLight, EllaLogoDark } from '@ella/ui'`
- Size: 24px height, auto width (aspect ratio preserved)
- Variants: `EllaLogoLight` (light mode, black text), `EllaLogoDark` (dark mode, white text)
- Dark mode: Conditional render via Tailwind `dark:` utilities
- No layout shift: Dimensions reserved via aspect-ratio

**Title Rendering (Phase 05):**
- Source: `data.title` from API (custom title set by CPA in workspace)
- Format key: `draft.titleFormat` with placeholder `{{title}}` (values: "...for Review" en, "...để Xem Xét" vi)
- Fallback: `draft.title` key if title field missing (defensive degradation, though atomic deploy ensures presence)
- XSS safe: React text node auto-escapes user-provided title

**Error Handling (Phase 05):**
```typescript
// Added DOC_DELETED case
switch (error?.code) {
  case 'INVALID_TOKEN': return t('draft.errorInvalidLink')
  case 'LINK_REVOKED': return t('draft.errorRevoked')
  case 'LINK_EXPIRED': return t('draft.errorExpired')
  case 'DOC_DELETED': return t('draft.errorDeleted')   // NEW (Phase 05)
}
// Suppress retry button for permanent errors
const isInvalidLink = ['INVALID_TOKEN', 'LINK_REVOKED', 'LINK_EXPIRED', 'DOC_DELETED'].includes(error?.code)
```

**Pending i18n (Phase 06):**
- `draft.titleFormat` — Message key, not yet in locale files
- `draft.errorDeleted` — Message key, not yet in locale files

**API Compatibility (Phase 02 Dependency):**
```typescript
// Portal API response includes title field (added in Phase 02)
ShareableDocumentData {
  title: string  // "Draft Return", "2024 Tax Return", etc.
  ...other fields
}
```

**Mobile Layout:**
- Logo + title stay on single line on portrait (headroom reserved)
- Logo doesn't wrap; spacer adapts to available width
- Existing metadata chips (year/version/client) unchanged below title

**Security:**
- No new CSP impact (logo is static asset from workspace)
- Title value rendered as text node → HTML-escaped automatically
- 410 response doesn't leak internal state ("removed by CPA" only)

---

## Phase 05: Client Overview Tab - Integration & Cleanup (COMPLETE)

**Overview:**
Integration of Client Overview Tab as default tab on client detail page. Avatar upload with client-side Canvas compression, rich text notes with Tiptap editor, quick stats cards, activity timeline, and assigned staff badges.

**Phase 05 Completion:**
- `apps/workspace/src/routes/clients/$clientId.tsx` - Default tab set to `overview` (line 75)
- `apps/workspace/src/components/clients/index.ts` - Removed old ClientOverviewSections export (line 16, comment added)
- Old components fully replaced by ClientOverviewTab modular structure

**ClientOverviewTab Features:**
- **Avatar Section:** Client avatar display with hover state, fallback initials badge
- **Profile Card:** Client name, phone, email with quick-edit icons
- **Quick Stats:** totalFiles, taxYears (pills), verifiedPercent (progress), lastMessageAt
- **Activity Timeline:** Recent uploads, messages, case updates (10 items max, chronological)
- **Assigned Staff:** Staff badges with avatar/name, hover card for details
- **Rich Notes Editor:** Tiptap integration with HTML sanitization, auto-save (30s debounce)

**Image Compression Utility (`image-utils.ts`):**
```typescript
compressImage(file): Promise<{ blob, dataUrl, width, height }>
- Resizes to 400x400px max (maintains aspect ratio)
- Targets 200KB with adaptive quality reduction
- Quality loop: 0.85 → 0.5 in 0.1 increments (max 10 iterations)
- Returns compressed JPEG blob + preview dataUrl
- Memory management: revokes ObjectURL on load/error

isValidImageFile(file): boolean
- Accepts: image/jpeg, image/png, image/webp, image/gif
- Prevents unsupported formats pre-compression

formatFileSize(bytes): string
- Display helper: "123 KB", "1.5 MB"
```

**AvatarUploader Component (`client-avatar-uploader.tsx`):**
```typescript
Props:
- clientId: string
- currentAvatarUrl: string | null (existing avatar)
- clientName: string (for initials fallback)

States: idle | compressing | uploading | confirming | success | error

Upload Flow:
1. User clicks avatar
2. File input → validation (type + size ≤10MB)
3. Compress via Canvas (progress: "Compressing...")
4. GET presigned URL from backend
5. Fetch PUT to R2 with compressed blob (progress: "Uploading...")
6. PATCH /confirm with R2 key (progress: "Saving...")
7. Success → toast + cache invalidation

Accessibility:
- Enter/Space triggers upload (keyboard)
- aria-label: "Change client avatar" (EN/VI)
- Focus ring: focus:ring-2 focus:ring-primary

Visual Feedback:
- Idle: Camera icon on hover
- Uploading: Spinner overlay
- Success: Green check overlay (1.5s fade)
- Error: AlertCircle icon + error message + dismiss button
```

**API Integration:**
```typescript
POST /clients/:id/avatar/presigned-url
  Request: { contentType: 'image/jpeg', fileSize: number }
  Response: { uploadUrl, expiresIn, r2Key }
  Notes: Expires 15min, R2 PUT requires Content-Type header

PATCH /clients/:id/avatar
  Request: { r2Key: string }
  Response: { id, avatarUrl, updatedAt } (signed download URL, 7-day TTL)
  Notes: Validates avatars/ prefix, creates signed URL immediately

DELETE /clients/:id/avatar
  Response: { id, avatarUrl: null, updatedAt }

PATCH /clients/:id/notes
  Request: { notes: string } (HTML, max 50KB)
  Response: { id, notes, notesUpdatedAt, updatedAt }

GET /activity/recent
  Response: ActivityTimelineResponse { data[], nextCursor }
  Notes: Org-scoped, safe DTOs only, filters: limit/category/actorStaffId/riskLevel

GET /activity/clients/:clientId
  Response: ActivityTimelineResponse { data[], nextCursor }
  Notes: Client-scoped, safe DTOs only, invalid cursor returns 400 INVALID_CURSOR

GET /clients/:id/activity (legacy)
  Response: ActivityItem[] (legacy sanitized fallback; message descriptions do not include body snippets)

GET /clients/:id/stats
  Response: { totalFiles, taxYears[], verifiedPercent, lastMessageAt }
```

**Cache Invalidation:**
```typescript
confirmMutation.onSuccess:
  - queryClient.invalidateQueries(['client', clientId])
  - Success toast + preview reset (1.5s delay)
```

**Localization Keys:**
```
profile.clientAvatar - Section heading
profile.changeClientAvatar - Button aria-label
profile.compressing - Upload state text
profile.uploading - Upload state text
profile.saving - Confirmation state text
profile.avatarUpdated - Success toast
profile.avatarUploadFailed - Error toast
profile.invalidImageType - Validation error
profile.imageTooLarge - Validation error
overview.quickStats - Stats card heading
overview.totalFiles - File count label
overview.taxYears - Tax years label
overview.verified - Verification % label
overview.lastMessage - Last message label
overview.activity - Activity timeline heading
overview.assignedStaff - Staff badges heading
overview.notes - Rich notes editor label
overview.notesPlaceholder - Editor placeholder text
```

**Security:**
- Org-level access control: buildClientScopeFilter applied to all endpoints
- Presigned URLs expire: 15min (upload), 7 days (download)
- R2 key validation: client-avatars/{clientId}/{timestamp}-{random}.jpg (directory traversal safe)
- File size limits: 10MB pre-compression, 200KB post-compression target
- HTML sanitization: Notes stored as HTML, frontend auto-escapes React rendering (no XSS)
- HTTPS only: Presigned URLs include X-Amz-* signatures

---

## Phase 03: Client Detail Add Business Drawer (COMPLETE)

**Overview:**
Slide-over drawer enabling CPAs to link additional business entities to existing individual clients directly from the client detail Overview tab. Provides empty state UI for individuals without businesses and persistent add button for those with existing businesses.

**Components:**

1. **AddBusinessDrawer** (`apps/workspace/src/components/clients/client-overview-tab/add-business-drawer.tsx`)
   - Fixed slide-over drawer: 100% height, max-width 28rem (md breakpoint), positioned right side
   - Overlay: Semi-transparent backdrop (opacity-50) with click-to-close
   - Accessibility: role="dialog", aria-modal="true", aria-label, escape-key dismiss
   - Body scroll lock: Prevents page scroll while drawer open (document.body.style.overflow)
   - Header: Title "Add Business" + close button (X icon)

   **Form Content:**
   - Uses existing `BusinessInfoForm` with `idPrefix="add-biz-"` and `hideTitle` props for drawer context
   - Fields: business name (required), type, EIN, phone, email, address, city, state, zip
   - Tax year selector: 3-button toggle group (current year, -1, -2 dynamic from `new Date().getFullYear()`)
   - Error display: Top banner for API errors with red bg/text
   - Submit button: "Create & Link Business" with loading spinner during submission

   **Mutation Logic:**
   ```typescript
   const mutation = useMutation({
     mutationFn: (data: LinkBusinessInput) =>
       api.clients.linkBusiness(clientId, data),
     onSuccess: () => {
       onSuccess() // Parent callback for cache invalidation
       onClose()   // Close drawer
     }
   })
   ```

   **Validation:**
   - Business name required (trim check)
   - Other fields optional (matching BusinessInfoForm validation)
   - Submit disabled while mutation pending

   **Data Mapping:**
   ```typescript
   const payload: LinkBusinessInput = {
     firstName: business.name,           // Business name → firstName
     phone: clientPhone,                 // Client's phone (from parent)
     email: clientEmail || undefined,    // Client's email (optional)
     businessType: business.businessType,
     ein: business.ein || undefined,
     businessAddress: business.address || undefined,
     businessCity: business.city || undefined,
     businessState: business.state || undefined,
     businessZip: business.zip || undefined,
     taxYear                              // Selected tax year
   }
   ```

2. **ClientLinkedEntityCard** (Enhanced)
   - Shows differently based on currentClientType and linkedClients array:
     - Business clients with no owner: Card hidden (returns null)
     - Individual clients with no businesses: Empty state card with CTA button
     - Individual/Business with linked entities: List of linked clients
     - Individual with businesses: Add button persists at bottom

   **Empty State UI:**
   ```
   │ Building icon "Linked Business"
   │ "No businesses linked yet."
   │ [  + Add Business  ] (dashed border button)
   ```

   **Linked Entity Cards:**
   - Avatar: Initials (rounded-full for individuals, rounded-lg for businesses)
   - Name + business type badge (e.g., "LLC", "S-Corp")
   - Contact info: Phone + Email + EIN masked
   - Navigation: Link to linked client detail page
   - Hover state: Border + background color change

   **Props:**
   ```typescript
   interface ClientLinkedEntityCardProps {
     clientId: string
     clientPhone: string
     clientEmail?: string | null
     currentClientType: ClientType
     linkedClients: ClientPreview[]
     onBusinessAdded?: () => void
   }
   ```

3. **ClientOverviewTab** (Updated)
   - Conditional render: Show ClientLinkedEntityCard for INDIVIDUAL clients OR if clientGroup with members exists
   - Pass `onBusinessAdded` callback: Invalidates `['clients', client.id]` query
   - Query refresh shows newly linked business on Overview tab

**API Integration:**
```
POST /clients/:clientId/link-business
Body: LinkBusinessInput {
  firstName: string              // Business name
  phone: string                  // Client phone (E.164)
  email?: string                 // Client email
  businessType: BusinessType
  ein?: string
  businessAddress?: string
  businessCity?: string
  businessState?: string
  businessZip?: string
  taxYear: number
}
Response: LinkBusinessResponse
```

**User Workflow:**
1. CPA opens individual client detail page
2. Overview tab shows: "No businesses linked yet" + "+ Add Business" button
3. Click button → AddBusinessDrawer opens (slide-over from right)
4. Fill business form + select tax year
5. Click "Create & Link Business" → Submits LinkBusinessInput
6. Success: Drawer closes, Overview refreshes with new linked business
7. Can repeat: "+ Add Business" button remains visible

**Validation & Error Handling:**
- Client-side: Business name required
- API errors: Displayed in-drawer red banner with retry
- Loading state: Button disabled, spinner, "Creating..." text
- Success: Auto-close drawer + cache invalidation

**Cache Strategy:**
```typescript
onBusinessAdded={() =>
  queryClient.invalidateQueries({ queryKey: ['clients', client.id] })
}
```
Ensures GET /clients/:id re-fetches with updated clientGroup.clients array.

**Mobile Support:**
- Drawer: 100% width on mobile, right-aligned
- Overlay: Full coverage
- Close: Large X button, escape key
- Form: Mobile-optimized spacing + full-width tax year buttons

---

## Phase 04: Navigation Integration - Staff Profile Routes

**Overview:**
User profile navigation system enabling staff to access member profiles from two entry points: sidebar user section and team member table rows.

**Route Structure:**
```
/team/profile/$staffId
├── $staffId = 'me'      → Current user profile
└── $staffId = '{uuid}'  → Specific team member profile
```

**Navigation Patterns:**

1. **Sidebar User Section** (desktop + mobile):
   - Component: `SidebarContent` (apps/workspace/src/components/layout/sidebar-content.tsx)
   - Link: `to="/team/profile/$staffId" params={{ staffId: 'me' }}`
   - Trigger: Click user section (name, avatar, org)
   - Avatar source: `useOrgRole()` → `api.staff.me()` → `avatarUrl` field
   - Avatar fallback: Initials badge if no avatarUrl
   - Hover feedback: `hover:bg-muted/50 cursor-pointer`
   - Responsive: Collapsed sidebar shows avatar only

2. **Team Member Table Rows** (team management page):
   - Component: `TeamMemberTable` (apps/workspace/src/components/team/team-member-table.tsx)
   - Link: `to="/team/profile/$staffId" params={{ staffId: member.id }}`
   - Trigger: Click row (excluding buttons, menus, expand toggle)
   - Interactive element detection:
     ```typescript
     if (target.closest('button') ||
         target.closest('[role="menu"]') ||
         target.closest('[aria-expanded]')) {
       return  // Don't navigate
     }
     ```
   - Hover feedback: Right arrow icon on member name
   - Row styling: `hover:bg-muted/50 transition-colors cursor-pointer`

**Data Flow:**
```
Frontend Hook (useOrgRole)
  ↓
  queryKey: ['staff-me']
  ↓
  Backend: GET /staff/me
    ↓
    Returns: { id, name, email, role, language, orgRole, avatarUrl }
    ↓
    avatarUrl: Signed download URL from R2 or null
  ↓
  Hook returns: { orgRole, isAdmin, isLoading, staffId, avatarUrl }
  ↓
  Sidebar renders: avatar (img or initials) + name + org
```

**Type Contracts:**

1. **Staff.me Response Type** (api-client.ts:773):
   ```typescript
   {
     id: string                    // Staff UUID
     name: string                  // Display name
     email: string                 // Clerk email
     role: string                  // 'ADMIN' | 'STAFF'
     language: Language            // 'EN' | 'VI'
     orgRole: string | null        // 'org:admin' | 'org:member' | null
     avatarUrl: string | null      // NEW: R2 signed URL or null
   }
   ```

2. **useOrgRole Hook Return** (use-org-role.ts:8-24):
   ```typescript
   {
     orgRole: OrgRole | null
     isAdmin: boolean
     isLoading: boolean
     staffId: string | null
     avatarUrl: string | null      // NEW
   }
   ```

3. **SidebarContent Props** (sidebar-content.tsx:25-43):
   ```typescript
   interface SidebarContentProps {
     isMobile: boolean
     showLabels: boolean
     isCollapsedDesktop: boolean
     navItems: NavItem[]
     currentPath: string
     unreadCount: number
     userInitials: string
     userName: string
     organizationName?: string
     avatarUrl?: string | null     // NEW
     voiceState: { ... }
     onClose: () => void
     onLogout: () => void
   }
   ```

**Localization Keys:**
- `profile.viewProfile` - Sidebar Link title tooltip
- English: "View profile"
- Vietnamese: "Xem hồ sơ"

**Access Control:**
- Current user (me): Always allowed via useOrgRole
- Team page: Active non-admin staff can open the self-mode view; admin-only controls stay hidden and member-table actions remain admin-only
- Query scoping: `/staff/me` returns current user only

**Performance Considerations:**
- `useOrgRole` caches for 60 seconds (staleTime: 60000)
- Avatar URL from R2: 7-day TTL (set during avatar confirmation)
- Single API call per session for staff.me data
- No N+1 queries: sidebar uses cached hook result

**Backward Compatibility:**
- avatarUrl: optional field (null for existing accounts)
- No database schema changes
- Graceful fallback: initials badge if no avatar
- All changes additive (no breaking changes)

**Code Quality:** 9.5/10
- Type-safe navigation
- Proper accessibility (title, aria labels)
- Full i18n coverage
- Clean component composition
- Responsive design

## AI Document Processing

**Gemini Integration (Phase 9 - Wiring Complete):**
- Image validation: JPEG, PNG, WebP, HEIC, PDF (10MB max)
- Retry logic: 3 attempts, exponential backoff
- Batch processing: 3 concurrent images
- Classification: Multi-class tax form detection (180+ types)
- OCR: ~120 document types via map-based routing (O(1) lookup)
  - Phase 1: Generic fallback extractor (handles any document type)
  - Phase 2: 16 additional 1099 variants (1099-B/C/S/SA/Q/A/OID/LTC/PATR/CAP/H/LS/QA/SB + RRB variants)
  - Phase 3: 10 additional schedules (Schedule 2/3/A/B/8812/EIC/F/H/J/R)
  - Phase 4: K-1 variants + health forms (K1-1065/1120S/1041, 1095-B/C, 5498-SA, 1098-E, 8332)
  - Phase 5: 13 IRS forms (2441, 4562, 4797, 5695, 8283, 8606, 8829, 8863, 8889, 8949, 8959, 8960, 8995)
  - Phase 6: 16 additional IRS forms (8995-A, W2-G, 2210, 3903, 4684, 4868, 8936, W9, 6251, 2555, 5329, 8379, 8582, 8880, 8962, 8938)
  - Phase 7: 4 tax return types (1040-SR, 1040-NR, 1040-X, state returns)
  - Phase 8: 34 semi-structured docs (pay stubs, visas, certificates, mortgage docs, etc.)
- Confidence scoring for verification workflow
- **NEW (Phase 02):** Fallback smart rename for confidence < 60% (semantic filename generation via vision analysis)
- **NEW (Phase 09):** Map-based routing replaces switch statements (promptGetters, validators, labelMaps)
- **NEW (Phase 10):** Comprehensive test suite covering all 874 OCR extraction tests across 7 test files

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
├── document-classifier.ts - Classification service (+ generateSmartFilename NEW)
├── blur-detector.ts - Quality detection
├── prompts/
│   ├── classify.ts - Classification + SmartRename prompts
│   ├── address-parser.ts - US address parsing (structured extraction for contractors)
│   └── ocr/ - 49 form-specific extraction prompts: form-1040.ts, schedules 1-8812 (2,3,a,b,c,d,e,8812,eic,f,h,j,r,se), 1099 variants (25+), w2, k-1, bank-statement, ssn-dl, generic-extractor.ts (fallback)
└── __tests__/ (Phase 10 Testing)
    ├── 1099-variants.test.ts - 8 tests for Form 1099 variants
    ├── k1-health-education.test.ts - 8 tests for K-1 and health forms
    ├── irs-forms-part1.test.ts - 9 tests for first 13 IRS forms
    ├── irs-forms-part2.test.ts - 9 tests for additional 16 IRS forms
    ├── schedules.test.ts - 10 tests for Schedule A-R variants
    ├── semi-structured.test.ts - 6 tests for 35 semi-structured document types
    ├── tax-returns.test.ts - 12 tests for tax return variants
    ├── ocr-pipeline-integration.test.ts - 14 tests for full pipeline + confidence calculation
    ├── performance.test.ts - 5 tests for prompt retrieval latency benchmarks
    └── generic-extractor.test.ts - 60 tests for fallback extractor (validation + VI label generation)
```

**Phase 10 OCR Testing Coverage (874 total tests, all passing):**
- Validation functions for all 110+ document types
- Generic fallback extractor (unknown document handling)
- Full pipeline integration tests (prompt routing, confidence calculation)
- Performance benchmarks: <1ms per prompt lookup, <100ms for 1000 lookups
- Vietnamese field label generation for UI accessibility
- Edge case handling: missing fields, invalid data, array validation
- No regressions in existing OCR functionality

**Address Parsing Service (NEW - Excel Import Fallback):**
- Used in `excel-parser.ts` when regex fails to extract city from contractor addresses
- Batch API calls: up to 50 addresses per request, handles network fallback gracefully
- Input: raw address strings (e.g., "6424 NW 53 RD ST LAUDERHILL, FL 33319")
- Output: structured { address, city, state, zip } with index mapping for fast lookup
- Validation: response type checking + address field verification
- Graceful degradation: AI parsing optional (if no Gemini key, continues with regex results)

**Phase 02 Fallback Smart Rename:**
- Triggered when classification confidence < 60%
- Extracts semantic naming elements: documentTitle, source, recipientName
- Generates filename: `{TaxYear}_{DocumentTitle}_{Source}_{RecipientName}.pdf` (max 60 chars)
- Stores in RawImage.aiMetadata JSON field for audit trail
- Graceful degradation: failures don't block job or create false classifications
- Vietnamese name handling: diacritics removed (ă→a, đ→d), PascalCase formatting
- See: [`phase-02-fallback-smart-rename.md`](./phase-02-fallback-smart-rename.md) for details

**Phase 03 Multi-Entity Document Routing (NEW):**
- **Inngest Job Step:** route-to-entity (executes after classify, before route-by-confidence)
- **Activation:** Client has ClientGroup (individual + business entities), AI detected targetEntityId
- **Validation:** entityConfidence ≥ 0.7, target in same ClientGroup, org-scoped defense-in-depth, target has taxCase for current year
- **Action:** RawImage.caseId routed from upload entity to intended recipient entity. routedFromCaseId tracks original case (audit trail). entityConfidence stored.
- **Isolation:** Downstream steps (OCR, rename) use effectiveCaseId (routed destination) for correct entity association
- **Graceful Degradation:** All routing failures non-fatal—document processing continues with original caseId
- **Backward Compatible:** Single-entity clients unaffected. Entity routing skipped when conditions not met.
- **Cross-Group Protection:** targetEntityId must be in current ClientGroup (prevents cross-group document leakage)
- See: [`phase-02-classification-job.md`](./phase-02-classification-job.md#entity-routing-step-phase-03) for details

Magic Link Service:
```typescript
apps/api/src/services/magic-link.ts
├── getMagicLinkUrl() - Maps link types to URLs (/upload, /expense, /rental, /draft)
├── createPortalMagicLink() - Generate 32-character random PORTAL token with default 60-day expiry and CASE/GROUP scope
├── createMagicLink() - Generate token scoped to caseId; PORTAL delegates to createPortalMagicLink()
├── createMagicLinkWithDeactivation() - Atomically create replacement link and deactivate previous active link
├── resolveToken(type) - PORTAL → random 32-character token; other link types → random 12-character token
├── validateMagicLink() - Token validation + usage tracking
├── validateScheduleEToken() - Schedule E validation + expiry check
└── Support for PORTAL, SCHEDULE_C, SCHEDULE_E, DRAFT_RETURN types
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

## Phase 12: Frontend Client Creation Wizard - Multi-Path (2026-04-09)

**Location:** `apps/workspace/src/routes/clients/new.tsx` + `apps/workspace/src/components/clients/`

**Overview:**
Three-path client creation wizard supporting Individual, Individual+Business, and Business-only client types. Path selection drives form complexity and submission strategy. Business-only path submits directly without SMS confirmation step.

**Client Creation Paths:**

1. **Individual Path** (Type: 'INDIVIDUAL')
   - Steps: Basic Info → Confirm & Send SMS
   - Form: firstName, lastName, phone, email, language, taxYear
   - Returning client detection: Phone-based lookup (existing client reuse)
   - Submission: `POST /clients` with customMessage (SMS template)
   - No business association

2. **Individual + Business Path** (Type: 'INDIVIDUAL_WITH_BUSINESS')
   - Steps: Basic Info → Business Info → Confirm & Send SMS
   - Creates linked records: Individual Client + Business Client + ClientGroup
   - Individual form: firstName, lastName, phone, email, language
   - Business form: name, businessType, EIN, phone, email, address, city, state, zip
   - Submission: `POST /clients/with-business` (combo endpoint)
   - Returns both individual.id and business.id
   - Business phone inherits from individual if not provided

3. **Business Only Path** (Type: 'BUSINESS')
   - Steps: Business Info (single form, no SMS confirm)
   - Form: name, businessType, EIN, phone (required), email, address, city, state, zip
   - Submission: Direct `POST /clients` with clientType='BUSINESS'
   - Phone required (no individual phone fallback)
   - No SMS confirmation step — form redirect to client detail on success
   - Tax year selector: 3-button toggle (current year - 1, -2, -3)

**Component Hierarchy:**
```
CreateClientPage (new.tsx)
├── Step: 'type-select'
│   └── ClientTypeSelector
│       ├── Card: Individual (User icon, "A person (files 1040)")
│       ├── Card: Individual + Business (UserPlus icon, "A person who owns a business")
│       └── Card: Business Only (Building2 icon, "A business entity")
│
├── Step: 'individual-form' (paths: INDIVIDUAL, INDIVIDUAL_WITH_BUSINESS)
│   └── BasicInfoForm
│       ├── firstName, lastName (required)
│       ├── phone (required, 10 digits, checked for returning client)
│       ├── email (optional, email validation)
│       ├── language (VI/EN select)
│       ├── taxYear (3-button toggle)
│       └── ReturningClientSection (if match found)
│
├── Step: 'business-form' (paths: INDIVIDUAL_WITH_BUSINESS, BUSINESS)
│   └── BusinessInfoForm
│       ├── name (required)
│       ├── businessType (dropdown: SOLE_PROPRIETORSHIP, LLC, PARTNERSHIP, S_CORP, C_CORP)
│       ├── EIN (auto-formatted XX-XXXXXXX, optional except for BUSINESS path)
│       ├── phone (required for BUSINESS, optional for INDIVIDUAL_WITH_BUSINESS)
│       ├── email (optional)
│       ├── address (optional, street)
│       ├── city, state, zip (optional grid layout, state auto-uppercase)
│       └── Tax Year selector (BUSINESS path only)
│
├── Step: 'confirm' (paths: INDIVIDUAL, INDIVIDUAL_WITH_BUSINESS)
│   └── ConfirmStep
│       ├── Client summary (name, phone, taxYear, language)
│       ├── SMS template editor (customizable per language)
│       └── Create button (submits form + sends SMS)
```

**Sub-Components:**
- **client-type-selector.tsx** - 3-card type picker (Individual/Individual+Business/Business)
- **basic-info-form.tsx** - Individual form fields (firstName, lastName, phone, email, language, taxYear)
- **business-info-form.tsx** - Business form fields (name, type, EIN, phone, email, address, city, state, zip)
- **clients/index.ts** - Barrel exports (ClientTypeSelector, BasicInfoForm, BusinessInfoForm, EMPTY_BUSINESS_INFO, EMPTY_BASIC_INFO, type ClientCreationType, type BasicInfoData, type BusinessInfoData)

**Form Data Interfaces:**
```typescript
type ClientCreationType = 'INDIVIDUAL' | 'INDIVIDUAL_WITH_BUSINESS' | 'BUSINESS'

interface BasicInfoData {
  firstName: string
  lastName: string
  phone: string
  email: string
  language: 'VI' | 'EN'
  taxYear: number
}

interface BusinessInfoData {
  name: string
  businessType: BusinessType
  ein: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
}

type BusinessType = 'SOLE_PROPRIETORSHIP' | 'LLC' | 'PARTNERSHIP' | 'S_CORP' | 'C_CORP'
```

**Validation Rules:**

*Basic Info (Individual paths):*
- firstName: required, non-empty trim check
- lastName: required, non-empty trim check
- phone: required, exactly 10 digits (after removing non-digits)
- email: optional, but if provided must match email regex pattern
- language: VI or EN (default VI)
- taxYear: valid year from TAX_YEARS list

*Business Info (Business paths):*
- name: required, non-empty trim check
- businessType: must be valid enum value
- EIN: if provided, must match format XX-XXXXXXX (2-digit + hyphen + 7-digit)
- phone: required for BUSINESS path, optional for INDIVIDUAL_WITH_BUSINESS
  - If provided, must be 10 digits (after removing non-digits)
- email: optional, but if provided must match email regex
- state: optional, but if provided must be 2-letter uppercase code (validated against US_STATES set)
- zip: optional, but if provided must be 5 digits or 5-4 format (XXXXX or XXXXX-XXXX)

**Data Sanitization:**
- email: Control characters removed (0x00-0x1F, 0x7F), length limited to 254 chars, trimmed
- firstName/lastName: Trimmed, sliced to 50 chars max on submission
- businessName: Trimmed, sliced to 100 chars max on submission
- phone: Converted to E.164 format (+1XXXXXXXXXX) on submission
- state: Auto-uppercase, limited to 2 chars

**Returning Client Detection (Individual paths only):**
- Triggered on phone blur (BasicInfoForm)
- API call: `GET /clients/search?phone=<formatted>`
- If match found:
  - firstName/lastName auto-populate (if not already filled)
  - ReturningClientSection shows existing engagement + "Copy from previous" option
  - Submission creates engagement on existing client instead of new client
- Checked async: isCheckingPhone loading state during API call

**API Submissions:**

*Individual Path:*
```
POST /clients
{
  firstName: string
  lastName: string
  phone: "+1XXXXXXXXXX"    (E.164)
  email?: string          (sanitized)
  language: "VI" | "EN"
  profile: { taxYear: number, taxTypes: ["FORM_1040"] }
  customMessage: string   (SMS template from confirm step)
}
```

*Individual + Business Path:*
```
POST /clients/with-business
{
  individual: {
    firstName: string
    lastName: string
    phone: "+1XXXXXXXXXX"
    email?: string
    language: "VI" | "EN"
    profile: { taxYear: number, taxTypes: ["FORM_1040"] }
  }
  business: {
    firstName: string            (business name)
    businessType: BusinessType
    ein?: string
    phone: "+1XXXXXXXXXX"        (defaults to individual.phone)
    email?: string
    businessAddress?: string
    businessCity?: string
    businessState?: string
    businessZip?: string
    language: "VI" | "EN"
    profile: { taxYear: number }
  }
  groupName: string             (e.g., "John Doe Group")
}
```

*Business Only Path:*
```
POST /clients
{
  firstName: string            (business name)
  clientType: "BUSINESS"
  businessType: BusinessType
  phone: "+1XXXXXXXXXX"       (required, no fallback)
  email?: string
  ein?: string
  businessAddress?: string
  businessCity?: string
  businessState?: string
  businessZip?: string
  profile: { taxYear: number }
}
```

**Step Navigation:**

*Forward Navigation (handleNext):*
- 'individual-form' → validate basic info
  - If INDIVIDUAL: go to 'confirm'
  - If INDIVIDUAL_WITH_BUSINESS: go to 'business-form'
- 'business-form' (INDIVIDUAL_WITH_BUSINESS only) → validate business info → go to 'confirm'
- 'business-form' (BUSINESS only): no next step, submit inline via button

*Backward Navigation (handleBack):*
- 'individual-form' → 'type-select' (reset type)
- 'business-form' (INDIVIDUAL_WITH_BUSINESS) → 'individual-form'
- 'business-form' (BUSINESS only) → 'type-select' (reset type)
- 'confirm' → 'business-form' (INDIVIDUAL_WITH_BUSINESS) or 'individual-form' (INDIVIDUAL)

*Step Indicator:*
- Hidden on 'type-select'
- INDIVIDUAL path: 2 steps (Basic Info, Confirm)
- BUSINESS path: 1 step (Business Info, no indicator shown)
- INDIVIDUAL_WITH_BUSINESS path: 3 steps (Basic Info, Business Info, Confirm)
- Current step highlighted, completed steps show checkmark

**Business-Only Direct Submission (No Confirm Step):**
- Business form has inline "Create Business Client" button
- Button validates businessInfo before submission
- No SMS confirm step (business entities assumed to have secure communication channels)
- On success: navigate to `/clients/:clientId` (client detail view)
- On error: submitError displayed, no form reset (user can retry)

**EIN Auto-Formatting:**
- Input: User types/pastes any text
- Processing: Digits extracted, limited to 9 chars
- Format: If > 2 digits, format as XX-XXXXXXX
- Display: Real-time, as user types
- Validation: Final format checked before submission (must be XX-XXXXXXX or empty)

**US State Validation:**
- Hard-coded SET of 50 states + DC + territories (AL, AK, ... VI, GU, AS, MP)
- Input: Case-insensitive, auto-uppercase to 2 chars
- Validation error: "Invalid state code" if not in set

**Accessibility Features:**
- All form fields have htmlFor-linked labels
- Error messages: aria-describedby linked, role="alert"
- Required fields: aria-required="true", red asterisk with aria-hidden="true"
- Invalid fields: aria-invalid="true" when errors present
- TypeSelector cards: Keyboard navigable, Enter/Space to select
- StepIndicator: Semantic nav with aria-label="Progress", icon descriptions
- Focus management: First invalid field focused on validation error
- Modal/drawer patterns: Escape key, backdrop click, focus trap

**Internationalization (i18n):**
- SMS template defaults: DEFAULT_SMS_TEMPLATE_VI and DEFAULT_SMS_TEMPLATE_EN
- Template editable on confirm step (language selector changes active template)
- Language passed to SMS send endpoint
- Error messages: t('newClient.errorFirstNameRequired'), etc.
- UI text: t('newClient.stepBasicInfo'), t('newClient.stepConfirm'), etc.

**Error Handling:**
- Validation errors: Local state, displayed per-field with aria-describedby
- Submission errors: Top-level error banner (submitError state)
- Returning client check: Silent failure (setExistingClient(null)), no error shown
- Phone blur check: Async (isCheckingPhone flag), debounce recommended by caller

**Performance:**
- No query caching for type selector (UI-only state)
- Returning client query: No automatic retry, user can manually blur phone field again
- Submission: Single request per path, no parallel requests
- Form re-render optimization: useState for each form data object, onChange callbacks only update that object

**Key Differences from Prior Client Creation:**
- OLD: Single form with clientType toggle + all business fields (removed in Phase 04)
- NEW: Path-driven wizard with separate form components per path type
- NEW: Business phone optional for Individual+Business path (inherits from individual)
- NEW: Business-only path submits directly (no SMS confirm step)
- NEW: ClientTypeSelector as first step (three-card UX)
- NEW: Combo endpoint `POST /clients/with-business` for Individual+Business path

---

## Phase 13: Client Detail Page - Type-Based Tab Layout (2026-04-09)

**Location:** `apps/workspace/src/routes/clients/$clientId.tsx`

**Overview:**
Client detail page now renders different tab layouts based on clientType (INDIVIDUAL vs BUSINESS). INDIVIDUAL clients show Overview, Files, Data Entry, Draft Return, Schedule C, Schedule E. BUSINESS clients show Overview, Files, Contractors, Data Entry, Draft Return, Schedule C. Removed old "Businesses" tab. Added cross-link banner showing linked clients in same ClientGroup. Header adapts with building icon and businessType badge for BUSINESS clients.

**Tab Configuration:**

**BUSINESS Client Tabs:**
- Overview (Building2 icon)
- Files (FolderOpen icon)
- Contractors (UserCircle icon) — new, shows contractor list for business
- Data Entry (ClipboardList icon)
- Draft Return (FileText icon)
- Schedule C (Calculator icon) — conditional, appears if scheduleCExpense data exists

**INDIVIDUAL Client Tabs:**
- Overview (User icon)
- Files (FolderOpen icon)
- Data Entry (ClipboardList icon)
- Draft Return (FileText icon)
- Schedule C (Calculator icon) — conditional, appears if scheduleCExpense data exists
- Schedule E (Home icon) — conditional, appears if scheduleEExpense data exists

**Tab Configuration Logic (`$clientId.tsx` lines 506-534):**
```typescript
const isBusiness = client.clientType === 'BUSINESS'

const tabs = isBusiness
  ? [
      { id: 'overview', label: t('clientOverview.title'), icon: Building2 },
      { id: 'files', label: t('clientDetail.tabFiles'), icon: FolderOpen },
      { id: 'contractors', label: 'Contractors', icon: UserCircle },
      { id: 'data-entry', label: t('clientDetail.tabDataEntry'), icon: ClipboardList },
      { id: 'shared-docs', label: t('clientDetail.tabSharedDocs'), icon: FileText },
      ...(scheduleCExpense ? [scheduleCTab] : []),
    ]
  : [
      { id: 'overview', label: t('clientOverview.title'), icon: User },
      { id: 'files', label: t('clientDetail.tabFiles'), icon: FolderOpen },
      { id: 'data-entry', label: t('clientDetail.tabDataEntry'), icon: ClipboardList },
      { id: 'shared-docs', label: t('clientDetail.tabSharedDocs'), icon: FileText },
      ...(scheduleCExpense ? [scheduleCTab] : []),
      ...(scheduleEExpense ? [scheduleETab] : []),
    ]

// Overflow tabs (shown in "More" dropdown)
const overflowTabs = isBusiness
  ? [...(!scheduleCExpense ? [scheduleCTab] : [])]
  : [
      ...(!scheduleCExpense ? [scheduleCTab] : []),
      ...(!scheduleEExpense ? [scheduleETab] : []),
    ]
```

**Header Adaptations:**

1. **Avatar**
   - BUSINESS: Building2 icon with primary/10 background
   - INDIVIDUAL: Initials with color-coded background (getAvatarColor)

2. **Business Type Badge**
   - BUSINESS only: Displays businessType (SOLE_PROPRIETORSHIP, LLC, PARTNERSHIP, S_CORP, C_CORP)
   - Maps via BUSINESS_TYPE_LABELS (e.g., "S_CORP" → "S-Corp")
   - Style: px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary

3. **EIN Display**
   - BUSINESS only: Shows einMasked in header (e.g., "EIN: XX-XXXX567")
   - INDIVIDUAL: No EIN displayed

**Cross-Link Banner (lines 551-574):**

Shows linked clients in same ClientGroup below back button:
```typescript
{client.clientGroup && client.clientGroup.clients.length > 1 && (
  <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm mb-4">
    <span className="text-muted-foreground">Linked:</span>
    {client.clientGroup.clients
      .filter(c => c.id !== clientId)
      .map(sibling => (
        <Link
          key={sibling.id}
          to="/clients/$clientId"
          params={{ clientId: sibling.id }}
          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
        >
          {sibling.clientType === 'BUSINESS' ? (
            <Building2 className="w-3.5 h-3.5" />
          ) : (
            <User className="w-3.5 h-3.5" />
          )}
          {sibling.name}
          <ArrowRight className="w-3 h-3" />
        </Link>
      ))}
  </div>
)}
```

**Tab State Management:**

Tab state resets on clientId change via useEffect (prevents stale state when navigating between clients):
```typescript
useEffect(() => {
  setActiveTab('files') // or appropriate default per clientType
}, [clientId])
```

**Removed Features:**
- Old "Businesses" tab (businesses now appear as separate top-level clients)
- Schedule E support for BUSINESS clients (E-type income is individual-only)

**Tab Type Definition:**
```typescript
type TabType = 'overview' | 'files' | 'checklist' | 'schedule-c' | 'schedule-e' | 'data-entry' | 'shared-docs' | 'contractors'
```

---

## Phase 03: Business Detail Buttons Redirect to Individual (2026-04-10)

**Location:** `apps/workspace/src/routes/clients/$clientId.tsx` (lines 282–288, 298, 709–750)

**Overview:**
Messages and Upload buttons on BUSINESS client detail page now intelligently redirect to the individual owner's tax case. Unread badge queries the correct case conversation count. Visual indicators show owner name. Seamless fallback for standalone business clients.

**Sibling Client Data Flow:**

Backend API (`GET /clients/:id`, apps/api/src/routes/clients/index.ts):
```
For each sibling in clientGroup.clients (excluding self):
  - Query latest TaxCase (taxYear DESC, take 1)
  - Extract magicLink token from latest case
  - Build portalUrl from token (if exists)
  - Include: id, name, clientType, phone, email, businessType, einMasked, latestCaseId, portalUrl
```

Frontend ClientPreview type (apps/shared):
```typescript
interface ClientPreview {
  id: string
  name: string
  clientType: ClientType
  phone: string
  email?: string | null
  businessType?: BusinessType | null
  einMasked?: string | null
  latestCaseId?: string | null      // Latest tax case for this client
  portalUrl?: string | null         // Magic link portal for this client
}
```

**Owner Individual Resolution (lines 282–288):**

```typescript
const ownerIndividual = useMemo(() => {
  if (client?.clientType !== 'BUSINESS' || !client.clientGroup?.clients) {
    return null
  }
  return client.clientGroup.clients.find((c) => c.clientType === 'INDIVIDUAL') ?? null
}, [client?.clientType, client?.clientGroup?.clients])
```

**Unread Badge Query (line 298):**

```typescript
const messageCaseId = ownerIndividual?.latestCaseId || activeCaseId
const { data: unreadData } = useQuery({
  queryKey: ['unread-count', messageCaseId],
  queryFn: () => api.messages.getUnreadCount(messageCaseId!),
  enabled: !!messageCaseId,
})
```

**Upload Button (lines 709–728):**

- Uses three-tier fallback chain for portal URL:
  1. `ownerIndividual?.portalUrl` (preferred for business clients in groups)
  2. `selectedCase?.portalUrl` (current case portal)
  3. `client.portalUrl` (backward compat, top-level client portal)
- Opens in new tab (target="_blank")
- Shows visual hint: `(via {ownerName.split(' ')[0]})`

**Messages Button (lines 731–750):**

- Navigates to `/messages` with `caseId=messageCaseId` (ownerIndividual's latestCaseId when available)
- Shows same "(via Name)" hint
- Unread badge queries correct case conversation count
- All message queries use `messageCaseId` for accurate count

**Send Upload Link Button (line 752):**

- Visible only when portalUrl is null (no active magic link)
- Uses same portal URL fallback chain to determine visibility
- Submits with correct caseId for SMS routing

**Backward Compatibility:**

- INDIVIDUAL clients: `ownerIndividual` null, uses current client's caseId/portalUrl
- BUSINESS clients without clientGroup: No redirect hint shown, uses current client's portalUrl
- Clients with multiple businesses: Only first INDIVIDUAL sibling used (assumes 1:many relationships)

**Visual Indicators:**

```
Messages button:    [📨 Messages (via John)]
Upload button:      [⬆️ Upload (via John)]
```

The "(via Name)" hint is semantic text (no screen reader override), helping CPAs understand which entity's documents they're accessing.

**Code Quality:** 9.2/10
- Minimal prop additions (latestCaseId, portalUrl on ClientPreview)
- Clear fallback logic (3-tier chain)
- Consistent UX across Messages/Upload/SendLink flows
- Production-ready, zero breaking changes

---

## Phase 4: Unified Conversation & Business UX - Manager Propagation (2026-04-10, updated 2026-06-03)

**Location:** `apps/api/src/lib/client-helpers.ts` (NEW), `apps/api/src/routes/clients/index.ts` (PATCH /clients/:id/managed-by), test files

**Overview:**
Manager assignment now propagates atomically to all ClientGroup members. Since 2026-06-03, `ClientManager` rows are canonical for client visibility and linked clients receive the same full manager set. `managedById` remains a primary-manager mirror during rollout.

**Helper Library** (`apps/api/src/lib/client-helpers.ts`):

```typescript
/**
 * Check if a client is a business linked to a group (with an individual owner).
 * Business clients in a group should share the individual's conversation/portal.
 */
export function isBizWithGroup(client: { clientType: string; clientGroupId?: string | null }): boolean {
  return client.clientType === 'BUSINESS' && !!client.clientGroupId
}

/**
 * Find the individual owner in a client group.
 * Uses createdAt desc ordering — in current data model, each group has exactly one individual.
 */
export async function findGroupIndividual(clientGroupId: string, organizationId?: string) {
  return prisma.client.findFirst({
    where: {
      clientGroupId,
      clientType: 'INDIVIDUAL',
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id, phone, name, language,
      taxCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id, taxYear },
      },
    },
  })
}
```

**Endpoint: PATCH /clients/:id/managed-by**

Current behavior:
```
1. Query client with clientGroupId
2. If client.clientGroupId exists:
   - sync ClientManager rows for all group members with same manager set (atomic $transaction)
   - keep managedById mirror aligned to the primary manager
   - Log: "Propagated staffIds=... to X members"
3. If orphan (no clientGroupId):
   - Sync ClientManager rows for single client only
4. Filter by organizationId for security
```

**Code Pattern:**

```typescript
// Group-aware manager sync
const client = await prisma.client.findUnique({
  where: { id: clientId },
  select: { clientGroupId: true },
})

const clientIds = client?.clientGroupId
  ? await findOrgScopedGroupClientIds(client.clientGroupId, organizationId)
  : [clientId]

await prisma.$transaction((tx) =>
  syncClientManagers(tx, { clientIds, organizationId, staffIds })
)
```

**Verification Tests:**

`send-upload-link.test.ts` (13 tests):
- Magic link routed to individual's taxCase when business has clientGroupId
- SMS sent to individual's phone (not business landline)
- Fallback to business case with warning log if individual lacks taxCase for year
- Standalone business clients unchanged (backward compatible)

`managed-by-propagation.test.ts` (13 tests):
- Assign staff to individual -> business manager set also updated atomically
- Assign staff to business -> individual manager set also updated atomically
- Clear all managers -> linked clients clear manager rows and legacy mirror
- Non-grouped clients remain independent (no cross-org leakage)
- Orphan client updates don't affect other groups

**Integration Points:**

1. **Messages Routes** (`apps/api/src/routes/messages/index.ts`): Guard conversation creation against business cases using `isBizWithGroup()` helper—conversations belong to individual owner only.

2. **SMS Webhook** (`apps/api/src/services/sms/webhook-handler.ts`): Check `isBizWithGroup()` before creating incoming message conversation. Routes inbound SMS to individual's conversation if applicable.

3. **Portal Routes** (`apps/api/src/routes/portal/index.ts`): send-upload-link endpoint uses `findGroupIndividual()` to resolve individual's taxCase, creates magic link on individual's case, SMS to individual's phone.

**Code Quality:** 9.3/10
- Helper functions eliminate duplication (used in 3+ route files)
- Atomic transactions ensure group consistency
- Comprehensive test coverage (26+ tests across 2 files)
- Backward compatible (orphans unaffected)
- Security: organizationId filters prevent cross-org updates

---

## Phase 3: Multi-Business Per Client - Add Business Drawer (2026-04-09)

**Location:** `apps/workspace/src/components/clients/client-overview-tab/`

**Overview:**
Enables CPAs to add linked businesses to existing individual clients directly from client detail page. Component hierarchy: ClientOverviewTab → ClientLinkedEntityCard (shows empty state + add button) → AddBusinessDrawer (form submission).

**Components:**

**AddBusinessDrawer** (`add-business-drawer.tsx`):
- Slide-over drawer from right side (fixed inset-y-0 right-0, max-w-md, z-50)
- Overlay: fixed inset-0 bg-black/30 z-40 (dismisses on click)
- Form: BusinessInfoForm + TaxYearSelector
- States: idle | loading | error | success
- Submission: POST `/clients/:clientId/link-business` with {businessInfo, taxYear}
- On success: calls `onSuccess()` callback → invalidates React Query cache → drawer closes
- Error display: AlertCircle icon + error message
- Mobile-friendly: Full viewport width on mobile, constrained on desktop

**ClientLinkedEntityCard** (Enhanced):
- Props: `clientId` (NEW), `currentClientType`, `linkedClients`, `onBusinessAdded` (NEW)
- Behavior: Shows for INDIVIDUAL clients even when no businesses linked (empty state)
- Empty State: Card title "Linked Business" + "No businesses linked yet" + "+ Add Business" button
- Card Button: Dashed border, Lucide Plus icon, hover effects (border-primary, text-primary)
- Drawer Open: Local state `drawerOpen`, renders AddBusinessDrawer when true
- Non-empty: Lists existing linked clients with edit/archive icons

**ClientOverviewTab** (Updated):
- Condition: Shows LinkedEntityCard if `client.clientGroup?.clients.length > 0` OR `client.clientType === 'INDIVIDUAL'`
- Callback: `onBusinessAdded={() => queryClient.invalidateQueries({ queryKey: ['clients', client.id] })}`
- Passes: `clientId`, `currentClientType`, `linkedClients` array, callback

**Data Flow:**
1. User navigates to INDIVIDUAL client detail
2. Overview tab renders ClientLinkedEntityCard (shows even if no businesses)
3. User clicks "+ Add Business" button → drawer opens
4. User fills BusinessInfoForm + selects tax year
5. User clicks Submit → loading state
6. API: POST `/clients/:clientId/link-business` (Phase 1)
7. Success: onSuccess() → queryClient.invalidateQueries → card refreshes with new business
8. Error: Error message displayed, form preserved (user can retry)

---

## Phase 04: Frontend Profile Toggles - CPA Upload SMS Notifications

**Overview:**
Staff notification preferences UI enabling staff to control SMS alerts for document uploads via profile settings. Integrates with Phase 01 (schema) and Phase 02-03 (backend services).

**Features:**
- `notifyOnUpload` toggle: Receive SMS when managed clients upload documents; admins receive org-wide upload alerts while this is enabled.

**UI Integration:**

**ProfileForm Component** (`apps/workspace/src/components/profile/profile-form.tsx`):
```typescript
// State management
const [editNotifyOnUpload, setEditNotifyOnUpload] = useState(staff.notifyOnUpload)

// Update mutation includes notification fields
api.team.updateProfile(staffId, {
  name, phoneNumber, notifyOnUpload
})

// Switch components for toggle UI
<Switch
  checked={editNotifyOnUpload}
  onCheckedChange={setEditNotifyOnUpload}
  disabled={!canEdit}
/>
```

**UI Package Switch Component** (`packages/ui/src/components/switch.tsx`, NEW):
- Accessible toggle switch (role="switch", aria-checked)
- Keyboard support: Enter/Space to toggle
- Controlled + uncontrolled modes
- Size variants: default (h-6 w-11) | sm (h-5 w-9)
- States: idle, hover, focused, disabled
- No external dependencies (pure CSS via CVA)

**API Integration:**

**Backend Schema** (`apps/api/src/routes/team/schemas.ts`):
```typescript
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/).optional().nullable(),
  notifyOnUpload: z.boolean().optional(),
})
```

**Backend Endpoints** (`apps/api/src/routes/team/index.ts`):
- `GET /team/members/:staffId/profile` - Returns Staff with notification fields (self or admin)
- `PATCH /team/members/:staffId/profile` - Updates notification fields (self or admin)

**API Client** (`apps/workspace/src/lib/api-client.ts`):
```typescript
interface StaffProfile {
  id: string
  name: string
  email: string
  phoneNumber: string | null
  notifyOnUpload: boolean        // NEW
  // ... other fields
}

interface UpdateStaffProfileInput {
  name?: string
  phoneNumber?: string | null
  notifyOnUpload?: boolean       // NEW
}
```

**Localization Keys** (5 new keys):
```json
{
  "profile.notifyOnUpload": "Document upload notifications",
  "profile.notifyOnUploadDesc": "Receive SMS when clients upload documents"
}
```

**Vietnamese Translations** (vi.json):
```json
{
  "profile.notifyOnUpload": "Thông báo tải tài liệu",
  "profile.notifyOnUploadDesc": "Nhận tin nhắn SMS khi khách hàng tải tài liệu"
}
```

**Access Control:**
- Self-only editing via JWT context validation
- Team page supports self-mode for active non-admin staff; admin-only controls remain hidden

**Data Flow:**
```
ProfileForm renders
  ↓
User toggles Switch component
  ↓
State updates (editNotifyOnUpload)
  ↓
User clicks Save
  ↓
useMutation calls api.team.updateProfile(staffId, { notifyOnUpload })
  ↓
Backend PATCH /team/members/:staffId/profile validates + updates Staff
  ↓
onSuccess: invalidate ['team-member-profile', staffId]
  ↓
Profile refetches with new notification preferences
  ↓
Success toast: "Profile updated"
```

**Backward Compatibility:**
- New fields optional in schema (updateProfileSchema)
- Notification fields nullable in UpdateStaffProfileInput
- Database defaults: notifyOnUpload=true (set at schema)
- Graceful fallback for existing staff without preferences

**Code Quality:** 9.2/10
- Type-safe notification fields
- Accessible Switch component (WCAG 2.1 compliant)
- Full i18n coverage (EN/VI)
- Self-only enforcement via backend
- Clean component composition with ProfileForm

---

## Phase 02: Backend Client Overview - Avatar, Notes & Activity

**Overview:**
Client profile enhancement API enabling staff to manage client avatars, internal notes, and view activity timeline. Presigned R2 workflow for efficient avatar uploads, rich HTML notes support, and aggregated activity from documents/messages/case updates.

**New Client Fields:**
```typescript
Client {
  avatarUrl?: string | null         // Signed R2 URL (7-day TTL) or null
  notes?: string | null             // HTML content up to 50KB (Tiptap editor format)
  notesUpdatedAt?: Date | null      // Timestamp of last notes edit
}
```

**Avatar Upload Workflow (`POST` then `PATCH`):**
1. `POST /clients/:id/avatar/presigned-url` - Request presigned PUT URL
   - Input: `{ contentType, fileSize }` (JPEG/PNG/WebP/GIF, max 10MB)
   - Output: `{ uploadUrl, r2Key }` (15min expiry)
   - Security: Generates key as `client-avatars/{clientId}/{timestamp}-{random}.{ext}`
2. Browser PUT to presigned URL directly (bypasses server)
3. `PATCH /clients/:id/avatar` - Confirm upload
   - Input: `{ r2Key }` (from presigned response)
   - Validates key belongs to client (prevents path traversal)
   - Generates signed download URL (7-day TTL)
   - Output: `{ id, avatarUrl, updatedAt }`

**Avatar Security:**
- Presigned URLs expire 15 min (upload), 7 days (download)
- R2 key validation: Must start with `client-avatars/{clientId}/`
- Client-level access control via org-scoped queries
- File size limits: 10MB pre-upload validation

**Notes API (`PATCH /clients/:id/notes`):**
- Input: `{ notes }` (HTML string, max 50KB)
- Stores as-is from Tiptap editor (frontend responsible for sanitization on render)
- Truncates to 50KB if exceeded
- Updates notesUpdatedAt timestamp
- Output: `{ id, notes, notesUpdatedAt, updatedAt }`
- XSS prevention: Frontend auto-escapes React rendering (notes aren't treated as raw HTML)

**Activity Timeline (`GET /activity/recent` and `GET /activity/clients/:clientId`):**
Aggregates recent events into safe timeline DTOs with actor hydration and cursor pagination:
```typescript
ActivityTimelineResponse {
  data: ActivityTimelineResponseItem[]
  nextCursor: string | null
}

ActivityTimelineResponseItem {
  id: string
  createdAt: string
  category: ActivityCategory
  action: string
  riskLevel: ActivityRiskLevel
  summary: string
  actor: {
    type: ActivityActorType
    staffId: string | null
    name: string | null
    avatarUrl: string | null
  }
  target: {
    type: ActivityTargetType
    id: string | null
    label: string | null
  }
  clientId: string | null
  caseId: string | null
  route: string | null
  method: string | null
}
```
- **Safe surface:** no raw `metadata`, IP address, or user-agent in the list response.
- **Cursor handling:** stale or out-of-scope cursors return 400 `INVALID_CURSOR`.
- **Actor hydration:** actor names/avatar URLs are joined from org-scoped `Staff` records.
- **Workspace display:** dashboard shows recent org/access-scoped actions; client overview shows the same canonical stream filtered to that client.
- **Future option:** admin-only detail drawer and CSV export can expose more context later, but must keep the same redaction boundary.

**Quick Stats (`GET /clients/:id/stats`):**
Single query endpoint for client overview cards:
```typescript
{
  totalFiles: number          // Count of RawImage uploads
  taxYears: number[]          // Unique tax years (sorted desc)
  verifiedPercent: number     // % of DigitalDoc with status=VERIFIED (0-100)
  lastMessageAt: string | null // Most recent Message.createdAt (ISO8601)
}
```

**API Integration:**
```typescript
// In api-client.ts
api.activity.recent({ limit: 20 })       // GET /activity/recent
api.activity.client(clientId)            // GET /activity/clients/:clientId
api.clients.getStats(clientId)          // GET /clients/:id/stats
api.clients.avatarPresignedUrl(clientId, { contentType, fileSize })
api.clients.confirmAvatar(clientId, { r2Key })
api.clients.deleteAvatar(clientId)      // DELETE /clients/:id/avatar
api.clients.updateNotes(clientId, { notes })
```

**Validation Schemas (New):**
- `avatarPresignedUrlSchema` - contentType enum (JPEG/PNG/WebP/GIF), fileSize 100B-10MB
- `avatarConfirmSchema` - r2Key must start with `client-avatars/`
- `updateNotesSchema` - notes max 50KB

**Access Control:**
- All endpoints org-scoped via buildClientScopeFilter
- Admin: See all client avatars/notes
- Staff: See only assigned client avatars/notes
- Activity/stats: Scoped to client's own cases + messages

**Performance Notes:**
- Activity endpoint: Parallel queries (rawImages, messages, taxCases), returns top 10
- Stats endpoint: Single aggregation query with COUNT, no N+1
- Avatar presigned: Single R2 API call (cached 15min)
- Notes: Single update, no indexing overhead

**Localization:**
All avatar/notes UI will need i18n keys in workspace:
- `profile.changeClientAvatar` - Button label
- `profile.avatarUpdated` - Success toast
- `profile.notesPlaceholder` - Editor hint text
- Error keys for validation failures

## Initial Payment Flow (Post-Agreement Signing)

**Overview:** After client signs an agreement with an initial payment amount, system auto-creates Payment record + SMS to client with portal pay link + Stripe checkout session. Webhook marks payment PAID → SMS admins + client receipt. Staff can resend links + view payment status on client profile. Internal service/model names still use `deposit*` and `Payment.type='DEPOSIT'`.

**Models & Data:**
- **Payment** - `organizationId, clientId, leadId, agreementId` (FKs with SetNull), `type='DEPOSIT'`, `status` (PENDING|PAID|FAILED|CANCELED|REFUNDED), `payToken` (unique per-token rate limit 3/hour with auto-refund on server failure), `amount` (Decimal USD amount; converted to cents for Stripe), `stripeCheckoutSessionId`, `paidAt`, `failedAt`
- **Staff Notifications** - ADMIN-only toggles: `notifyOnAgreementSigned` (SMS to admins when client signs), `notifyOnClientPayment` (SMS to admins when client pays)

**Post-Sign Hook** (`agreement-signing-service.ts`):
Fire-and-forget after signing commit — isolated try/catch per step (no transaction impact):
1. Admin SMS fan-out: Query staff with `notifyOnAgreementSigned=true` → send SMS via `agreement-post-sign-notifications.ts`
2. Payment creation: Create Payment(type=DEPOSIT, status=PENDING, payToken) via `deposit-payment-service.ts`
3. Client SMS: Send pay-link SMS with `portal/pay/:payToken` URL via `signer-sms-delivery.ts` (SMSTemplate: `payment-sms-templates.ts`)

**Public Payment API** (`/public/pay`):
- `GET /:payToken` - Public view Payment (no auth required). Returns amount, client name, agreement details. Returns 404 if token invalid/payment already paid
- `POST /:payToken/checkout` - Fresh Stripe Checkout session (mode=payment). Amount always from DB (never client-supplied). Per-token rate limit 3/hour with auto-slot-refund on server failure (idempotent). Returns session.url. Returns 410 if already PAID, 404 if invalid token
- Shared Stripe webhook (`webhook-handler.ts`) — discriminates deposit sessions via `metadata.payToken` → `markDepositPaymentPaid` in `deposit-checkout-service.ts`. Idempotent claim guard (status !== PAID before mutate). Syncs agreement depositStatus. Admin SMS + client receipt SMS on success

**Workspace UI:**
- **Payments Tab** (new `/clients/:id` tab): Client Payment list, status badges (PENDING, PAID, FAILED), created date, amount
- **Overview Payments Card**: Quick summary (total collected, pending, overdue count)
- **Settings → Notifications**: 2 ADMIN-only toggles (`notifyOnAgreementSigned`, `notifyOnClientPayment`), default OFF. PATCH endpoint rejects toggles for non-ADMIN targets (403)
- **Resend Payment Link**: Staff button (ADMIN/MANAGER only, throttled 1/60s), triggers `POST /clients/:clientId/payments/resend` → admin SMS + new client SMS with fresh link

**Portal Pay Page** (`/pay/:payToken`):
React/TanStack Router public checkout flow. Validates token → displays amount + pay CTA → redirects to Stripe Checkout session.url → webhook marks paid.

**Staff Payments Endpoint** (`/clients/payments-staff.ts`):
- `POST /clients/:clientId/payments/resend` - ADMIN/MANAGER only. Throttled 1/60s per client. Creates fresh Payment + sends new SMS to client. Returns 429 if throttled
- Query `GET /clients/:clientId/payments` - List client payments with status filtering + pagination

**Webhook Idempotency:**
- Per-session: Check if status !== PAID before state mutation
- Per-org: lastStripeEventId + lastStripeEventAt guard against duplicate processing
- Graceful degradation: SMS failures don't rollback payment mark (post-commit fire-and-forget)

---

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
- Realtime: Optional Supabase Realtime (disabled locally if env vars missing)

**Production:**
- Frontend: Vercel (React + TanStack Router)
- Backend: Railway or Fly.io (Hono + Node)
- Database: PostgreSQL (Supabase or cloud provider)
- Realtime: Supabase Realtime Broadcast (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY backend; VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY frontend)
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
- ClientManager links enforce multi-staff manager membership; Client.managedById is a legacy primary-manager mirror during rollout
- ActivityLog is the canonical user/system timeline for meaningful mutations; route instrumentation records actor, org scope, target, request context, risk, and redacted metadata.
- Audit logging remains for legacy field-level snapshots and specialized destructive snapshots.
- `/admin/*` configuration routes require org admin access, and voice caller lookup is org-scoped.

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

**Version:** 3.0
**Last Updated:** 2026-05-22
**Status:** English-first i18n enforcement complete. Multi-Tenant architecture with Clerk Webhook Sync Migration complete. Client-Business Entity Separation Phase 06 (Cleanup & Integration Testing) complete. Supabase Realtime Broadcast integrated for 100-500ms message updates. Phase 12 Client Creation Wizard (multi-path) complete. Phase 13 Client Detail Page (type-based tabs) complete. Phase 02 ShareableDocument (multi-section) API + Phase 04 Workspace UI complete: SharedDocsTab + 10 sub-components, useSharedDocs/useSharedDocSignedUrl hooks, legacy DraftReturn components removed. Draft Return tab renamed to Shared Docs tab across UI and i18n keys.
