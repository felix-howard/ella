# Ella - Tax Document Management SaaS

Modern tax document management and compliance platform built with TypeScript, React, Hono, and PostgreSQL.

## Overview

Ella streamlines tax preparation workflows by automating document collection, classification, data extraction, and team collaboration. Built as a multi-tenant SaaS with organization-based access control and role-based permissions.

**Status:** MVP complete with multi-tenancy, voice integration, and schedule C expense collection.

## Key Features

### Document Management
- Client magic link upload portal (passwordless access)
- AI-powered document classification (180+ tax document types)
- OCR data extraction (W2, 1099s, K-1, bank statements)
- Document verification workflow with staff review
- Duplicate detection and auto-categorization

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
cp .env.example .env.local
# Edit .env.local with your credentials

# Database setup
pnpm -F @ella/db migrate

# Start development servers
pnpm dev
# Frontend: http://localhost:5174
# Backend: http://localhost:3002
```

### Environment Variables

**Required:**
```
DATABASE_URL=postgresql://user:password@localhost:5432/ella
CLERK_SECRET_KEY=sk_test_...
GEMINI_API_KEY=AIzaSy...
PORTAL_URL=http://localhost:5174
```

**Optional:**
```
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
```

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

REST API with 60+ endpoints organized by feature:

- **Team** - Members, invitations, assignments
- **Clients** - CRUD, profiles, assignments
- **Cases** - Tax cases, engagements, checklist
- **Documents** - Upload, classify, verify, extract
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

### Commit Convention
- `[Add] New feature` - New functionality
- `[Update] Enhancement` - Improvements
- `[Fix] Bug fix` - Bug resolution
- `[Refactor] Code restructuring` - Refactoring
- `[Docs] Documentation update` - Documentation

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
- **Data Isolation:** Org-scoped queries, ClientAssignment enforcement
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
