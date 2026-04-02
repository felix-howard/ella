# Project Changelog

> **Last Updated:** 2026-04-02 ICT
> **Format:** Semantic versioning + dated entries. Most recent first.

---

## 2026-04-02

### Feature: Tax1099 API Integration - Phase 3 ✅ COMPLETE
**Status:** Production Ready
**Branch:** feature/more-ella-polish
**Effort:** 8h
**Completion Date:** 2026-04-02

**What Changed:**
- Added `Form1099NEC` model for individual 1099-NEC form tracking with status workflow
- Added `FilingBatch` model to group multiple 1099-NECs by client + tax year for batch submission
- Added `Form1099Status` enum: DRAFT, VALIDATED, IMPORTED, PDF_READY, SUBMITTED, ACCEPTED, REJECTED
- Added `Contractor` model for business client contractor tracking
- Implemented Tax1099 API client singleton service (`tax1099-client.ts`)
- Created 5 new API endpoints for form validation, import, and PDF retrieval

**Database Changes:**
- Migration: `packages/db/prisma/migrations/20260402120000_add_form_1099_nec_and_filing_batch`
- Schema: Form1099NEC model with taxYear, amountBox1/4, pdfStorageKey, validation tracking
- Schema: FilingBatch model grouping forms by client + tax year
- Schema: Contractor model linking to Client + Tax1099FormId

**API Changes (5 new endpoints):**
- `GET /clients/:clientId/1099-nec/status` - Get form status counts (DRAFT, VALIDATED, IMPORTED, PDF_READY, SUBMITTED, ACCEPTED, REJECTED). Business clients only. Org-scoped.
- `POST /clients/:clientId/1099-nec/validate` - Validate all DRAFT forms via Tax1099 API, transition to VALIDATED or error state. Org admin required.
- `POST /clients/:clientId/1099-nec/import` - Import form data from Tax1099 into DB, decrypt SSN, validate data, transition to IMPORTED. Org admin required.
- `POST /clients/:clientId/1099-nec/fetch-pdfs` - Fetch generated PDFs from Tax1099 API, upload to R2, transition forms to PDF_READY. Org admin required.
- `GET /clients/:clientId/1099-nec/:formId/pdf` - Download signed PDF URL with 24-hour TTL. Read-only endpoint.

**Backend Changes:**
- New service: `apps/api/src/services/tax1099-client.ts` - Tax1099 API client with auth, configuration validation
- New routes: `apps/api/src/routes/form-1099-nec/index.ts` - All 5 endpoints with org-scoped queries
- Config addition: `apps/api/src/lib/config.ts` - Tax1099 configuration section with endpoint detection
- Route registration: Updated `apps/api/src/app.ts` to include 1099-NEC routes

**Frontend Changes:**
- New component: `form-actions-panel.tsx` - Actions UI for form validation/import/PDF fetch
- New integration: `form-1099-nec-tab/index.tsx` - Tab for business client 1099-NEC management
- New API client methods: `apps/workspace/src/lib/api-client.ts` - Methods + types for all 5 endpoints
- Tab support: Added 1099-NEC tab to `/clients/:id` page for BUSINESS clients only

**Environment Variables:**
- `TAX1099_LOGIN` - Tax1099 API username
- `TAX1099_PASSWORD` - Tax1099 API password
- `TAX1099_APP_KEY` - Tax1099 application key
- `TAX1099_SANDBOX` - Sandbox environment flag (true/false)

**Validation & Safety:**
- Org-scoped queries: All endpoints verify org access via `buildClientScopeFilter()`
- Business client check: Endpoints return 404 for non-BUSINESS clients
- SSN decryption: Contractor SSN decrypted on import via crypto service
- Validation errors tracked in Form1099NEC.validationErrors array for audit
- eFile tracking: efileSubmittedAt + efileStatus fields for IRS submission status

**Testing:**
- type-check: All TypeScript errors resolved
- lint: No linting issues (React dependencies verified)
- build: Successful compilation
- Code review: All endpoints org-scoped, business client verified, error handling complete

---

## 2026-03-30

### Feature: Tag-Based Lead & Client Categorization ✅ COMPLETE
**Status:** Production Ready
**Branch:** feature/lead
**Effort:** 6h
**Completion Date:** 2026-03-30

**What Changed:**
- Added `tags: String[]` array field to both Lead and Client models for free-form categorization
- Renamed `Lead.source` → `Lead.campaignTag` for clarity on campaign-sourced leads
- Expanded `ClientSource` enum with new values:
  - `GENERIC_FORM`: Form submission (generic)
  - `STAFF_FORM`: Form submission (staff-specific)
  - `CONVERTED`: Lead converted to client
  - `MANUAL`: Manual creation (existing, retained)
- Auto-tagging: Leads created from campaign URLs auto-tagged with campaign slug
- Tag carry-over: Lead→Client conversion copies tags to new client
- Tag-based filtering on Lead list page (dropdown filter in toolbar)
- Tag-based filtering on Client list page (dropdown filter in controls bar)
- New API endpoints: `GET /leads/tags`, `GET /clients/tags` (returns distinct org-scoped tags)
- Tag management UI in Lead detail drawer (add/remove tag chips)
- Tag management UI in Client detail page (add/remove tag chips)
- Tag display: Badges shown in list table rows

**Database Changes:**
- Migration: `packages/db/prisma/migrations/*_add_tags_and_expand_client_source`
- Schema: Lead model + campaignTag (renamed from source), added tags
- Schema: Client model + tags field
- Schema: ClientSource enum expanded (additive, backward compatible)
- Data migration: Existing Lead.source values copied to tags array for continuity

**API Changes:**
- Lead creation (POST /leads): `campaignTag` + auto-populated `tags` from campaign slug
- Lead list (GET /leads): `tag` query param for filtering (OR logic across tags)
- Lead update (PATCH /leads/:id): `tags` field for full replacement
- Lead detail (GET /leads/:id): Returns `campaignTag` + `tags`
- Lead convert (POST /leads/:id/convert): Copies tags to client, sets source=CONVERTED
- Form submit (POST /form/:orgSlug/submit): Sets source=GENERIC_FORM or STAFF_FORM based on staffSlug
- New: GET /leads/tags — returns distinct tags for filtering dropdown
- New: GET /clients/tags — returns distinct tags for filtering dropdown
- Client list (GET /clients): `tag` query param for filtering
- Client update (PATCH /clients/:id): `tags` field for full replacement

**Frontend Changes:**
- Lead interface: `source` → `campaignTag`, added `tags: string[]`
- Lead list table: Replaced "Source" column with "Tags" column showing tag badges
- Lead list toolbar: Added tag filter dropdown
- Lead detail drawer: Added tag management (add/remove tag chips, text input)
- Client interface: Added `tags: string[]`
- Client list table: Added "Tags" column with badge display
- Client list controls: Added tag filter dropdown
- Client detail page: Added tag management UI
- i18n: New translation keys for "Tags", "Add tag", "Remove tag", "No tags", "Tag" (filter label)

**Validation & Safety:**
- Tag format: lowercase alphanumeric + hyphens, max 50 chars per tag, max 10 tags per record
- Client-side validation before API submission (regex)
- Tags org-scoped: All queries filtered by organizationId
- No data loss: Migration uses non-destructive column additions + data copy

**Testing:**
- type-check: All TypeScript errors resolved
- lint: No linting issues
- build: Successful compilation
- Manual flows validated:
  - Lead creation with campaign tag auto-tags correctly
  - Lead tag filter works end-to-end
  - Lead→Client conversion carries tags + sets CONVERTED source
  - Form submissions distinguish GENERIC_FORM vs STAFF_FORM
  - Client tag filter works correctly
  - /leads/tags and /clients/tags return correct distinct values

**Files Modified:**
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/[timestamp]_add_tags_and_expand_client_source/migration.sql`
- `apps/api/src/routes/leads/index.ts`
- `apps/api/src/routes/leads/schemas.ts`
- `apps/api/src/routes/clients/index.ts`
- `apps/api/src/routes/clients/schemas.ts`
- `apps/api/src/routes/form/index.ts`
- `apps/workspace/src/lib/api-client.ts`
- `apps/workspace/src/routes/leads/index.tsx`
- `apps/workspace/src/components/leads/leads-toolbar.tsx`
- `apps/workspace/src/components/leads/lead-list-table.tsx`
- `apps/workspace/src/components/leads/lead-detail-drawer.tsx`
- `apps/workspace/src/routes/clients/index.tsx`
- `apps/workspace/src/components/clients/client-list-table.tsx`
- `apps/workspace/src/locales/en.json`
- `apps/workspace/src/locales/vi.json`

**Benefits:**
- Free-form lead/client grouping without rigid enum constraints
- Campaign source tracking at ingestion time (auto-tag from URL)
- Source origin clarity: Distinguish generic vs staff form submissions vs converted leads
- Better filtering: Find leads/clients by category without table scans
- Quick search/discovery: Tag dropdown populated from real org data

**Backward Compatibility:**
- Existing `Lead.source` values migrated to `campaignTag` + `tags` — no data loss
- Existing `Client.source = 'FORM'` unchanged (additive enum values only)
- Old API clients still work (new fields optional)
- Migration idempotent, rollback-safe

**Risk Mitigation:**
- Postgres `text[]` with GIN indexing for fast tag queries
- Tag validation prevents injection/abuse
- Org-scoped filtering prevents cross-org data leaks
- All tests passing, no regressions

**Next Steps:**
- Merge feature/lead → main
- Deploy to production
- Monitor /leads/tags and /clients/tags endpoint performance (raw SQL)
- Gather user feedback on tag UX

---

## Previous Releases
[See git history for prior versions before 2026-03-30]
