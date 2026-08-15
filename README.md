# Ella - Tax Document Management SaaS

Modern tax document management and compliance platform built with TypeScript, React, Hono, and PostgreSQL.

## Overview

Ella streamlines tax preparation workflows by automating document collection, classification, data extraction, and team collaboration. Built as a multi-tenant SaaS with organization-based access control and role-based permissions.

**Status:** MVP complete. Automatic Paid Client Services Phase 6 and its release-readiness rollout are complete: automated validation, ADMIN card/ACH/lifecycle smoke, and legitimate same-org STAFF assigned/unassigned scope smoke all passed. Production deployment remains a separately authorized operation.

## Key Features

### Document Management
- Client magic link upload portal with random expiring links, revoke/extend controls, rate limits, and filename privacy
- AI-powered document classification (180+ tax document types)
- OCR data extraction (W2, 1099s, K-1, bank statements)
- Document verification workflow with staff review
- Duplicate detection, auto-categorization, content signature validation, and identity document retention controls

### Multi-Tenancy & Team Management
- Organization-based data isolation (Clerk integration)
- Team member management (invite, role assignment, deactivate)
- Role-based access control (ADMIN, STAFF)
- Client-to-staff assignment workflows
- Audit logging for compliance

### Tax Workflows
- Multi-year engagement support (copy-from previous year)
- Automated checklist generation based on intake
- Dynamic intake questionnaire (100+ fields)
- Schedule C self-employed expense collection
- Action queue for staff task management

### Communication
- SMS notifications (Twilio integration)
- Unified message inbox with split-view
- Browser-based voice calling (Twilio WebRTC)
- Voicemail recording and transcription
- Magic link portal for client communication

### Operational Activity
- Canonical `ActivityLog` timeline for meaningful staff, client, and system actions
- Dashboard recent activity and client overview activity surfaces
- Redacted activity metadata: no message bodies, phone numbers, emails, tokens, signed URLs, OCR text, storage keys, or long notes

### AI & Automation
- Google Gemini 2.0-flash integration
- Automatic document classification
- Structured data extraction via OCR
- Confidence scoring for verification
- Image quality detection (blur, clarity)

## Tech Stack

### Frontend
- **React 19.0.0** - UI library
- **TanStack Router 1.94+** - File-based routing
- **React Query 5.64+** - Server state management
- **Tailwind CSS 4.0.0** - Utility-first styling
- **shadcn/ui** - Component library
- **Clerk 5.59.3** - Authentication & org management

### Backend
- **Hono 4.6.15+** - Lightweight HTTP framework
- **Prisma 6.7.0** - ORM & migrations
- **Zod 3.24.1** - Input validation
- **PostgreSQL 14+** - Relational database
- **Google Gemini 2.0-flash** - AI document processing
- **Twilio SDK** - Voice & SMS

### DevOps
- **TypeScript 5.7.3+** - Type safety
- **pnpm** - Package manager
- **Turbo** - Monorepo build orchestration
- **Docker** - Containerization
- **GitHub Actions** - CI/CD

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Clerk account (auth)
- Gemini API key (AI)
- Twilio account (optional, for voice/SMS)

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/ella.git
cd ella

# Install dependencies
pnpm install

# Set up environment
# Use .env.example as the variable checklist.
# API dev loads apps/api/.env; landing dev loads apps/landing/.env.
# Copy needed values into each app env file or export them in each shell.

# Database setup
pnpm -F @ella/db migrate

# Start development servers
pnpm dev
# Workspace: http://localhost:5174
# Portal: http://localhost:5173
# Landing: http://localhost:4321
# Backend: http://localhost:3002
```

### Environment Variables

**Required:**
```
DATABASE_URL=postgresql://user:password@localhost:5432/ella
CLERK_SECRET_KEY=sk_test_...
GEMINI_API_KEY=AIzaSy...
PORTAL_URL=http://localhost:5173
```

**Optional:**
```
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
WEB_PUSH_VAPID_PUBLIC_KEY=...
WEB_PUSH_VAPID_PRIVATE_KEY=...
WEB_PUSH_VAPID_SUBJECT=mailto:support@example.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
MAGIC_LINK_EXPIRY_DAYS=60
IDENTITY_DOC_RETENTION_DAYS=90
TRUST_PROXY_HEADERS=false
VITE_LANDING_URL=http://localhost:4321
GOOGLE_DRIVE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=xxx
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3002/integrations/google-drive/callback
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=64_hex_characters
GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive
```
Workspace PWA push notifications require the Web Push VAPID variables above on the API. Generate keys with `pnpm -F @ella/api exec web-push generate-vapid-keys --json`, deploy API and Workspace over HTTPS, then staff must add Workspace to the iPhone Home Screen before enabling notifications.

Google Drive folder automation is optional and API-only. Configure a Google Cloud OAuth client with the redirect URI above, keep the app internal to the firm Workspace when possible, and store a 32-byte hex token encryption key in `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY`. Admins connect the firm Drive account from Workspace Organization settings, choose a root folder, and may add an admin Google Group fallback. Staff can store zero, one, or many Drive email aliases in their profile; Drive sharing targets the Ella login email plus those aliases, normalized and deduped. Existing client folders reconcile staff/admin ACLs when managers, staff Drive email aliases, roles, or active access change. Client folder creation runs through Inngest after the API marks the Drive row `CREATING`, so production deploys must expose and sync `/api/inngest` before staff use the create/retry button. Once the folder is `READY`, Ella sends the client one English SMS with the `AM WORK/SHARED TO CLIENT` Drive link through the normal message history; SMS-disabled environments skip without marking Drive creation failed. Client profile status checks also verify the root folder: a confirmed missing or trashed root clears the Ella connection and restores the create action, while an unavailable/disconnected Drive or transient provider error preserves the existing record.

Drive structures keep the existing root client folder naming pattern and create `AM WORK`, `AM WORK/SHARED TO CLIENT`, current-year shared folders, one folder per linked business with its current-year children, and `OFFICE - ADMIN ONLY` with `ADMIN Docs` and `LLC Docs`. When a client moves from one business to multiple businesses, sync renames the existing root folder from the single business name to `Multi`. Existing structures with the old admin folder name reconcile forward on create/retry/status-linked flows when possible. The API uses the runtime calendar year for year-prefixed folders.

For Drive rollout, apply the committed migration after backup/approval, configure the OAuth variables in the API process, connect the firm account, save/test the root folder and admin group, then create one fake-client folder structure for an individual with one business. Add a second business and verify the root folder is renamed to `Multi` and a new peer business folder appears. Verify Drive permissions manually: active admins can write `OFFICE - ADMIN ONLY`, active admins and managers can write `AM WORK`, configured admin group access still works where used, and the client email can write `AM WORK/SHARED TO CLIENT`. The accepted MVP risk is that client `writer` access allows uploads, edits, and deletes inside the shared client folder. Roll back before migration by restoring the old app; after migration, roll forward with corrective code or a new migration.


**Required for payment links:**
```
PUBLIC_API_URL=http://localhost:3002
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:4321/payment/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=http://localhost:4321/payment/cancel
STRIPE_CURRENCY=usd
```
For local payment-link testing, place `STRIPE_*` in `apps/api/.env` and `PUBLIC_API_URL` in `apps/landing/.env`, or export them in the process running each app. The Stripe return URLs above target the landing dev server on port `4321`.

When Stripe CLI is installed and both `STRIPE_SECRET_KEY` and the matching local `STRIPE_WEBHOOK_SECRET` are present, `pnpm dev` starts a local Stripe webhook listener automatically for `localhost:3002/webhooks/stripe`. To bootstrap a local `whsec_...`, run `stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,invoice.paid,invoice.payment_failed,customer.subscription.deleted,charge.refunded --forward-to localhost:3002/webhooks/stripe` once with the same test account/key, copy the printed signing secret into `apps/api/.env`, then restart `pnpm dev`. Configure the same event set on each deployed Stripe endpoint, using that endpoint's own test/live signing secret. Do not reuse the live Dashboard webhook secret for local CLI forwarding. If any prerequisite is missing, the listener is skipped and the rest of dev mode still starts.

Stripe-hosted email receipts depend on the Stripe Dashboard email setting for successful payments. Ella still stores available receipt and invoice URLs from webhooks for staff use in the client Payments tab.

ACH/bank payment links settle asynchronously. After a client submits ACH, the public quote page shows a bank-processing state for 3-5 business days and disables public retry/pay actions until Stripe reports success or failure. Workspace Payments shows quote monitoring labels for bank processing, failed retryable payments, duplicate-payment review before refunding, and subscriptions canceled after money was collected. Staff should not send another payment link while a bank payment is processing; check Stripe before contacting the client when ACH remains pending after 5 business days.

Stripe documents [ACH Direct Debit](https://docs.stripe.com/payments/ach-direct-debit) as USD-presentment and delayed-notification. Ella's shared quote Checkout builder explicitly requests `card`, `link`, and `us_bank_account`, disables [Adaptive Pricing](https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing) so quote Checkout stays in USD, and rejects non-USD `STRIPE_CURRENCY` with `CheckoutQuoteError`. This applies to signed/client-linked quotes, direct Calculator quotes, and Custom quote builder paths. The test account supports ACH: explicit `us_bank_account` sessions worked. The earlier missing ACH option came from Adaptive Pricing localizing USD Checkout to VND in the current locale, which suppressed USD-only ACH. Production must retain `STRIPE_CURRENCY=usd` and enable/verify ACH in each Stripe environment.

Authenticated ADMIN smoke on 2026-07-16 verified that a signed Calculator card checkout appeared once, a linked Custom Link card settlement appeared once, recurring failure/recovery/cancellation mapped Past Due → Active → Ended without duplicate service rows, a full refund remained Refunded, and admin Payments retained financial detail. Signed Calculator ACH smoke then displayed US bank account; a verified `checkout.session.completed` replay with `payment_status=unpaid` returned 200 and kept the linked payment count at zero; the verified `checkout.session.async_payment_succeeded` replay returned 200 and produced exactly one PAID Payment plus one new Active service group. Direct, anonymous, unpaid, and historical pre-release quotes must remain absent. The exact non-financial Services DTO is `success`, `data`, and `meta { isTruncated, limit }`; each group contains `id`, `source`, `paidAt`, nullable safe `agreement { id, title, signedAt }`, and `items`, whose fields are `id`, `label`, nullable `description`, `category`, `cadence`, and `status`. Structured amounts, receipts, payment identifiers, and Stripe data remain in admin Payments. Admin-authored labels, descriptions, and agreement titles can still mention pricing, so operational teams must keep that free text suitable for staff visibility.

### Paid Services Release Gate

Phase 6 and the release-readiness rollout are complete. Final focused validation passes API 68/68, Workspace 50/50, both package type-checks, and `git diff --check`; final reviewer score is 10/10 with no findings or warnings. Earlier Phase 6 evidence remains preserved: 106 migrations current; targeted API 95/95; targeted Workspace 59/59; full suite 3,866/3,866; lint 0 errors/35 known warnings; root type-check 8/8; build 4/4; post-fix API 65/65; simplifier 27/27; independent focused tests 191/191; and USD hardening 97/97. The final auth warning is resolved: protected API requests require an active Clerk organization before Staff lookup, then cross-check the linked Staff organization's Clerk ID before accepting tenant context; automated regressions protect both missing and mismatched organization paths. Services keyset-pages by the aggregate first-settlement key (`MIN(Payment.paidAt)`, quote ID), skips invalid projections, and returns the newest 100 valid groups with explicit truncation metadata. Workspace warns that older history remains in Payments; the API no longer replaces the full view with 422.

The authenticated ADMIN smoke covered card settlement, lifecycle transitions, and the signed Calculator ACH delayed-settlement path. The first Custom Link settlement exposed Prisma `P2010`: `$queryRaw` tried to deserialize PostgreSQL `void` from `pg_advisory_xact_lock`. The lock now uses `$executeRaw`; the exact failed signed webhook request was replayed and processed successfully once. ACH investigation later corrected the earlier configuration diagnosis: the direct Stripe test account supports ACH, while Adaptive Pricing had localized presentment to VND and suppressed USD-only `us_bank_account`. The shared Checkout builder now fixes quote presentment to USD and explicitly requests all supported methods.

Final authenticated STAFF smoke used a legitimate same-org role. The client list exposed exactly one assigned client; that client's Services UI/API rendered three groups and only the fixed safe DTO, with no structured financial or Stripe keys. The unassigned paid-services API returned the same uniform 404, while direct navigation to the unassigned client page showed `Client not found` without client data. Manual browser scope covered assigned/unassigned behavior; no separate cross-org fixture was exercised. Missing and mismatched Clerk organization paths remain covered by automated auth regressions.

Use a coordinated, forward-only rollout in every environment where the migrations are not yet applied:

1. Confirm a verified full database backup or confirm all legacy `ClientServiceLog` rows are disposable, then obtain explicit approval for the destructive migration in that environment.
2. Keep `STRIPE_CURRENCY=usd`, then enable and verify required payment methods, including ACH/`us_bank_account`, in that Stripe environment's Payment Method Configuration.
3. Configure `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, and `charge.refunded` on that environment's Stripe endpoint.
4. Enter maintenance and stop the old API/Workspace before migrating; the first feature migration removes the legacy service-log schema while adding payment provenance.
5. Apply the feature migrations in order, deploy API, deploy Workspace, then resume traffic.
6. Pay one newly created eligible test quote and verify Services with ADMIN and an assigned/non-assigned STAFF/CPA account. Historical quotes are intentionally not backfilled.

Before the destructive migration, the old deployment can still be restored. After it is applied, do not deploy the old application or edit/recreate applied migrations; roll forward with a corrective application release and, when needed, a new migration. Use a verified full database backup only for disaster recovery. Phase 6 completion did not perform a destructive migration, deployment, or Stripe production operation; every environment rollout action above remains separately authorized.

## Architecture

### Monorepo Structure
```
ella/
├── apps/
│   ├── api/              # Backend API (Hono)
│   ├── workspace/        # Staff dashboard (React)
│   └── portal/           # Client portal (React)
├── packages/
│   ├── db/              # Database & Prisma
│   ├── shared/          # Types & validation
│   └── ui/              # Component library
├── docs/                # Documentation
└── .claude/             # Development workflows
```

### Data Flow
1. **Frontend** (Clerk auth) → Bearer JWT token
2. **API** (Org verification) → Org-scoped queries
3. **Database** (Prisma) → Multi-tenant data isolation
4. **AI Services** (Gemini) → Document processing
5. **External** (Twilio, R2) → Communication & storage
6. **Web Push** → Generic Workspace PWA notifications for inbound client SMS messages
7. **ActivityLog** → Server-confirmed action timeline for dashboard/client overview

## Project Phases

### Phase 1: Foundation ✅
- Monorepo setup, database schema, core API (26 endpoints)
- Frontend foundation (UI tokens, layout, components)
- Magic link portal for passwordless access

### Phase 2: AI & Automation ✅
- Google Gemini integration
- Document classification & OCR (11+ document types)
- Dynamic checklist generation

### Phase 3: Multi-Tenancy & Permissions ✅
- Organization model with Clerk sync
- Team management API (12 endpoints)
- Role-based access control
- Client assignment workflows

### Phase 3.5: TaxBandits API Integration ✅
- 1099-NEC form modeling (Form1099NEC + FilingBatch)
- TaxBandits API client (create, fetch PDFs, transmit)
- OAuth 2.0 JWT authentication with token caching
- 8 REST endpoints for form creation, PDF retrieval, IRS e-filing
- Business client support with contractor tracking

### Phase 4: Schedule C Expense Collection ✅
- Self-employed expense form (28 IRS categories)
- 1099-NEC income integration
- Workspace Schedule C tab (in progress)

### Phase 5: Voice Integration ✅
- Browser-based calling (Twilio WebRTC)
- Incoming call routing
- Voicemail recording & transcription
- Presence tracking (staff online/offline)

## API Documentation

REST API with 85+ endpoints organized by feature:

- **Team** - Members, invitations, assignments
- **Clients** - CRUD, profiles, assignments
- **Cases** - Tax cases, engagements, checklist
- **Documents** - Upload, classify, verify, extract
- **Tax Forms** - 1099-NEC validation, import, PDF retrieval
- **Messages** - Conversations, SMS, voice calls
- **Voice** - Token generation, presence, recordings
- **Push** - Workspace PWA Web Push subscriptions and test notifications
- **Webhooks** - Twilio callbacks (calls, SMS)

See OpenAPI docs at `/api/docs` when running backend.

## Testing

```bash
# Run all tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint

# Build
pnpm build
```

**Test Coverage:**
- 578+ portal & schedule C tests
- 26+ API team/org tests
- 464+ engagement tests
- 54+ voice tests

## Documentation

- `docs/project-overview-pdr.md` - Project vision & requirements
- `docs/codebase-summary.md` - Current status overview
- `docs/code-standards.md` - Development guidelines
- `docs/system-architecture.md` - Technical architecture
- `docs/design-guidelines.md` - UI/UX standards
- `docs/project-roadmap.md` - Future planning

## Development

### Branch Strategy
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation
- All PRs require code review


## Deployment

### Development
```bash
pnpm dev
```

### Production
- Frontend: Vercel (automatic from Git)
- Backend: Railway or Fly.io
- Database: PostgreSQL (Supabase or cloud)
- File Storage: Cloudflare R2

## Security

- **Authentication:** Clerk OAuth with JWT
- **Data Isolation:** Org-scoped queries with ClientManager staff access enforcement
- **Validation:** Zod schemas for all inputs
- **Encryption:** HTTPS only, sensitive fields encrypted at-rest
- **Audit Logging:** Complete change trail for compliance

## Performance Targets

- **API Response Time:** < 200ms (95th percentile)
- **Frontend Load Time:** < 3s (including assets)
- **Database Query Time:** < 50ms average
- **Core Web Vitals:** All green

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test: `pnpm test`
3. Commit with convention: `[Add] Your feature`
4. Push and create PR with description
5. Get code review approval
6. Merge to main

## Support

- **Bugs:** [GitHub Issues](https://github.com/your-org/ella/issues)
- **Questions:** Team Slack or email
- **Docs:** `/docs` directory

## License

[License information]

---

**Last Updated:** 2026-07-18
**Version:** 2.0.0
**Maintainers:** Development Team

**Key Resources:**
- [API Documentation](./docs/system-architecture.md#backend-layer)
- [Code Standards](./docs/code-standards.md)
- [Design Guidelines](./docs/design-guidelines.md)
- [Project Roadmap](./docs/project-roadmap.md)
