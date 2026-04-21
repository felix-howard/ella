PORTAL APP - COMPLETE FILE MAP

Date: April 5, 2026
Status: Complete codebase structure identified

EXECUTIVE SUMMARY

The Ella portal is a token-based client-facing application with React + Vite frontend and Hono backend.

Features:
1. Magic Link Portal (/u/:token) - Document upload
2. Draft Viewer (/draft/:token) - PDF viewing
3. Schedule C/E Forms (/expense/:token, /rental/:token)
4. Public Intake Forms (/form/:orgSlug, /register/:orgSlug)
5. Landing Site (apps/landing/)

PORTAL FRONTEND ROUTES (10 total)

/                                      -> src/routes/index.tsx
/u/:token                              -> src/routes/u/$token/index.tsx
/draft/:token                          -> src/routes/draft/$token/index.tsx
/expense/:token                        -> src/routes/expense/$token/index.tsx
/rental/:token                         -> src/routes/rental/$token/index.tsx
/form/:orgSlug                         -> src/routes/form/$orgSlug/index.tsx
/form/:orgSlug/:staffSlug              -> src/routes/form/$orgSlug/$staffSlug/index.tsx
/register/:orgSlug                     -> src/routes/register/$orgSlug/index.tsx
/register/:orgSlug/:eventSlug          -> src/routes/register/$orgSlug/$eventSlug/index.tsx
/__root                                -> src/routes/__root.tsx (root layout)

CORE COMPONENTS (13)

Layout:
- src/components/error-boundary.tsx
- src/components/toast-container.tsx
- src/routes/__root.tsx

Upload:
- src/components/simple-uploader.tsx
- src/components/missing-docs-list.tsx

Landing:
- src/components/landing/welcome-header.tsx

PDF Viewer (5):
- src/components/pdf-viewer/index.tsx
- src/components/pdf-viewer/pdf-controls.tsx
- src/components/pdf-viewer/pdf-document.tsx
- src/components/pdf-viewer/use-auto-hide.ts
- src/components/pdf-viewer/use-pdf-gestures.ts

Forms (5):
- src/components/form/intake-form.tsx
- src/components/form/form-header.tsx
- src/components/form/success-view.tsx
- src/components/register/registration-form.tsx
- src/components/register/registration-success.tsx

FEATURE MODULES (28 files)

Expense (Schedule C) - 14 files

Components:
- src/features/expense/components/expense-form.tsx
- src/features/expense/components/expense-section.tsx
- src/features/expense/components/car-expense-section.tsx
- src/features/expense/components/income-section.tsx
- src/features/expense/components/other-expense-list.tsx
- src/features/expense/components/expense-field.tsx
- src/features/expense/components/progress-indicator.tsx
- src/features/expense/components/success-message.tsx
- src/features/expense/components/auto-save-indicator.tsx

Hooks:
- src/features/expense/hooks/use-expense-form.ts
- src/features/expense/hooks/use-auto-save.ts

Lib:
- src/features/expense/lib/expense-api.ts
- src/features/expense/lib/expense-categories.ts
- src/features/expense/lib/form-utils.ts

Rental (Schedule E) - 14 files

Components:
- src/features/rental/components/rental-form.tsx
- src/features/rental/components/property-count-step.tsx
- src/features/rental/components/property-details-step.tsx
- src/features/rental/components/property-expenses-step.tsx
- src/features/rental/components/review-step.tsx
- src/features/rental/components/property-summary-card.tsx
- src/features/rental/components/state-combobox.tsx
- src/features/rental/components/rental-progress-indicator.tsx
- src/features/rental/components/rental-success-message.tsx
- src/features/rental/components/rental-auto-save-indicator.tsx

Hooks:
- src/features/rental/hooks/use-rental-form.ts
- src/features/rental/hooks/use-rental-auto-save.ts

Lib:
- src/features/rental/lib/rental-api.ts
- src/features/rental/lib/rental-constants.ts

LIBRARIES (8)

- src/lib/api-client.ts
- src/lib/form-api.ts
- src/lib/use-form-page.ts
- src/lib/use-registration-page.ts
- src/lib/i18n.ts
- src/locales/en.json
- src/locales/vi.json
- src/main.tsx

CONFIGURATION (4)

- package.json
- vite.config.ts
- tsconfig.json
- vercel.json

BACKEND API ROUTES

Portal Routes (apps/api/src/routes/portal/)

GET /portal/:token
  Get portal data (checklist, stats)
  Auth: Magic link

POST /portal/:token/upload
  Upload documents
  Auth: Magic link
  Input: multipart files
  Limit: 10MB per file, max 50 files

GET /portal/draft/:token
  Get draft PDF URL
  Auth: Magic link

POST /portal/draft/:token/viewed
  Track PDF view
  Auth: Magic link

Form Routes (apps/api/src/routes/form/)

GET /form/:orgSlug
  Get org info

GET /form/:orgSlug/:staffSlug
  Get org + staff info

GET /form/:orgSlug/campaign/:campaignSlug
  Validate campaign

POST /form/:orgSlug/submit
  Submit intake form

Leads Routes (apps/api/src/routes/leads/)

POST /leads
  Create new lead

SUPPORTING SERVICES

- apps/api/src/services/magic-link.ts
  Functions: createMagicLink, createMagicLinkWithDeactivation, validateMagicLink
  
- apps/api/src/services/sms/
  Message sending, notifications
  
- apps/api/src/lib/validation.ts
  File & input validation
  
- apps/api/src/services/storage.ts
  R2 upload, signed URLs

AUTHENTICATION & SECURITY

Magic Link:
- Token: Random 12-char alphanumeric
- Types: PORTAL, SCHEDULE_C, SCHEDULE_E, DRAFT_RETURN
- Expiry: Never (null) by default
- Validation: Token exists, active, not expired

Public Forms:
- No user auth required
- Rate limiting: 30/min GET, 10/min POST
- SMS confirmation after registration

Upload Security:
- File types: JPEG, PNG, WebP, HEIC, PDF
- Size: 10MB max per file, 50 files max
- Storage: Cloudflare R2
- Classification: Gemini AI or manual review

INTERNATIONALIZATION

Languages: English (en), Vietnamese (vi)
Detection: localStorage + browser language
Toggle: Top-right button in root layout

SUMMARY

Portal routes: 9
API endpoints: 8
Frontend components: 35+
Feature modules: 2
Languages: 2
Magic link types: 4

Total portal-related files: 80+

