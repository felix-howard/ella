# Ella - Tax Document Management SaaS

Modern tax document management and compliance platform built with TypeScript, React, Hono, and PostgreSQL.

## Overview

Ella streamlines tax preparation workflows by automating document collection, classification, data extraction, and team collaboration. Built as a multi-tenant SaaS with organization-based access control and role-based permissions.

**Status:** MVP complete with multi-tenancy, voice integration, and schedule C expense collection.

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
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
MAGIC_LINK_EXPIRY_DAYS=60
IDENTITY_DOC_RETENTION_DAYS=90
TRUST_PROXY_HEADERS=false
VITE_LANDING_URL=http://localhost:4321
```

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

When Stripe CLI is installed and both `STRIPE_SECRET_KEY` and the matching local `STRIPE_WEBHOOK_SECRET` are present, `pnpm dev` starts a local Stripe webhook listener automatically for `localhost:3002/webhooks/stripe`. To bootstrap a local `whsec_...`, run `stripe listen --events checkout.session.completed --forward-to localhost:3002/webhooks/stripe` once with the same test account/key, copy the printed signing secret into `apps/api/.env`, then restart `pnpm dev`. Do not reuse the live Dashboard webhook secret for local CLI forwarding. If any prerequisite is missing, the listener is skipped and the rest of dev mode still starts.

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
6. **ActivityLog** → Server-confirmed action timeline for dashboard/client overview

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

**Last Updated:** 2026-02-04
**Version:** 2.0.0
**Maintainers:** Development Team

**Key Resources:**
- [API Documentation](./docs/system-architecture.md#backend-layer)
- [Code Standards](./docs/code-standards.md)
- [Design Guidelines](./docs/design-guidelines.md)
- [Project Roadmap](./docs/project-roadmap.md)
