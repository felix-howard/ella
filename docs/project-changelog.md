# Project Changelog

> **Last Updated:** 2026-04-02 ICT
> **Format:** Semantic versioning + dated entries. Most recent first.

---

## 2026-04-02

### Feature: TaxBandits API Client Migration - Phase 1 ✅ COMPLETE
**Status:** Integration Ready
**Branch:** feature/more-ella-polish
**Effort:** 1h
**Completion Date:** 2026-04-02

**What Changed:**
- Created TaxBandits API client singleton service with OAuth 2.0 JWT authentication
- Implemented token caching, expiry management, and automatic refresh on 401
- Added retry logic with exponential backoff (3 attempts default, 30s timeout per request)
- Configured environment variables for sandbox/production endpoints

**Configuration:**
- New service: `apps/api/src/services/taxbandits-client.ts`
  - Methods: `createForm1099NEC()`, `getStatus()`, `requestDraftPdf()`, `transmit()`
  - OAuth JWT: Header+Payload+Signature (HS256) with client credentials
  - Token caching: 55-min default expiry (60-min API token - 5-min buffer)
  - Auth cooldown: 60s between failed login attempts
  - Request timeout: 30s with AbortController
- Config addition: `apps/api/src/lib/config.ts`
  - `config.taxbandits.clientId/clientSecret/userToken` from env vars
  - Sandbox/production URLs auto-selected based on `TAXBANDITS_SANDBOX` env

**Environment Variables:**
- `TAXBANDITS_CLIENT_ID` - OAuth client ID for API authentication
- `TAXBANDITS_CLIENT_SECRET` - OAuth client secret (HMAC key for JWT signing)
- `TAXBANDITS_USER_TOKEN` - User token for JWT audience claim
- `TAXBANDITS_SANDBOX` - Boolean flag to use test API (default: true)

**Types Exported:**
- Request/response types for 1099-NEC creation, status checks, PDF requests, transmission
- Payer and recipient data interfaces with required address/TIN fields
- Success/error record structures for batch submissions

**Benefits:**
- Stateless token management: No DB writes, all in-memory caching
- Resilient to transient failures: Auto-retry with exponential backoff
- Production-ready: Sandbox endpoint testing + gradual migration
- No external dependencies beyond Node.js fetch/crypto (native modules)

**Testing:**
- Manual OAuth flow verification against TaxBandits sandbox
- Token refresh on 401 response confirmed
- Timeout handling (30s AbortController) verified
- Type safety: All request/response types exported + validated

---

### Feature: AI-Powered Address Parsing Fallback ✅ COMPLETE
**Status:** Production Ready
**Branch:** feature/more-ella-polish
**Effort:** 2h
**Completion Date:** 2026-04-02

**What Changed:**
- Added AI-powered address parsing fallback using Gemini for addresses without comma delimiters
- Handles US addresses in formats like `6424 NW 53 RD ST LAUDERHILL, FL 33319` and `7610 STIRLING RD APT D105 HOLLYWOOD FL 33024`
- Batch processing with 50 address limit prevents context overflow
- Graceful degradation when Gemini unavailable (original behavior preserved)
- Input sanitization for prompt injection prevention

**API Changes:**
- `excel-parser.ts`: `parseNailSalonExcel()` now async with AI fallback for empty city fields
- New service: `apps/api/src/services/ai/prompts/address-parser.ts` - Batched US address parsing prompt
- New function: `parseAddressesWithAI()` in excel-parser for Gemini integration
- Route handler: `apps/api/src/routes/contractors/index.ts` updated with await for async parser

**Implementation Details:**
- Regex parser remains primary for reliable fields (SSN, amount, name, state, zip)
- Gemini called only when city extraction fails (empty city field)
- AI responses validated with type guards to prevent hallucination
- Results merged back into contractor records with updated warning message
- Max batch size: 50 addresses per AI call

**Backend Changes:**
- New prompt file: `apps/api/src/services/ai/prompts/address-parser.ts`
  - `AddressParseInput` / `AddressParseResult` / `AddressParseResponse` types
  - `getAddressParsePrompt()` - Generates batched address parsing prompt with few-shot examples
  - `validateAddressParseResponse()` - Type guard validation
- Modified: `apps/api/src/services/excel-parser.ts`
  - Made `parseNailSalonExcel()` async
  - Added `parseAddressesWithAI()` for Gemini batch calls
  - Collect failed addresses and merge AI results
  - Warning text: "City/address split may need review" → "City extracted by AI"
- Modified: `apps/api/src/routes/contractors/index.ts`
  - Added await to parser call (line 299)

**No Changes Required:**
- Frontend (city field populated instead of empty)
- Database schema
- npm dependencies

**Testing:**
- Compilation: `pnpm -F api build` passes
- Regex parser: Still handles addresses with comma delimiters
- AI fallback: Extracts city from problematic addresses
- Graceful degradation: Empty city + original warning when Gemini unavailable
- Batch processing: 50-address limit prevents context overflow
- Prompt injection: Input sanitized before Gemini submission

---

## 2026-04-02

### Feature: TaxBandits API Migration - Phase 3 ✅ COMPLETE
**Status:** Production Ready
**Branch:** feature/more-ella-polish
**Effort:** 8h
**Completion Date:** 2026-04-02

**Summary:** Migrated from Tax1099 API to TaxBandits API with OAuth 2.0 JWT authentication. Implements 3-step workflow: create forms → fetch PDFs → transmit to IRS. Deprecated old Tax1099 client service.

**What Changed:**
- Replaced Tax1099 API client with TaxBandits OAuth 2.0 JWT implementation (`taxbandits-client.ts`)
- Rewrote 1099-NEC routes: 3-step process (create → fetch-pdfs → transmit) replaces old 4-step Tax1099 workflow
- Added schema fields: `Form1099NEC.taxbanditsRecordId`, `FilingBatch.taxbanditsSubmissionId` (alongside old fields for Phase 4 cleanup)
- Simplified form status workflow: DRAFT → IMPORTED → PDF_READY → SUBMITTED → ACCEPTED/REJECTED
- Form action panel UI updated for new 3-step workflow

**Database Changes:**
- Migration: `packages/db/prisma/migrations/20260402140000_add_taxbandits_fields`
- Schema additions: `Form1099NEC.taxbanditsRecordId`, `FilingBatch.taxbanditsSubmissionId` (nullable, indexed)
- Old Tax1099 fields retained for Phase 4 cleanup (backward compatibility)

**API Changes (8 endpoints - 3 core + 5 supporting):**
- **Core 3-Step Workflow:**
  - `POST /clients/:clientId/1099-nec/create` - Create all DRAFT forms in TaxBandits, store RecordIds + SubmissionId. Returns batchId + error list.
  - `POST /clients/:clientId/1099-nec/fetch-pdfs` - Request & download draft PDFs from TaxBandits, upload to R2. Updates forms to PDF_READY.
  - `POST /clients/:clientId/1099-nec/transmit` - Transmit accepted forms to IRS via TaxBandits. Updates batch status + form status to SUBMITTED.
- **Status & Management:**
  - `GET /clients/:clientId/1099-nec/status` - Status counts (DRAFT, IMPORTED, PDF_READY, SUBMITTED, ACCEPTED, REJECTED)
  - `GET /clients/:clientId/1099-nec/:formId/pdf` - Download signed PDF URL (24-hour TTL)
  - `GET /clients/:clientId/1099-nec/batches` - List all filing batches for client
  - `GET /clients/:clientId/1099-nec/batches/:batchId` - Get batch details with form breakdown
  - `POST /clients/:clientId/1099-nec/batches/:batchId/refresh` - Refresh batch status from TaxBandits

**Backend Changes:**
- Deprecated: `apps/api/src/services/tax1099-client.ts` - Old Tax1099 API client (kept for now)
- New service: `apps/api/src/services/taxbandits-client.ts` - TaxBandits OAuth 2.0 JWT client singleton
  - Token caching: 55-min expiry (auto-refresh on 401)
  - Retry logic: 3 attempts with exponential backoff
  - Methods: `createForm1099NEC()`, `requestDraftPdf()`, `transmitBatch()`, `getBatchStatus()`
- Rewritten routes: `apps/api/src/routes/form-1099-nec/index.ts` - 8 endpoints with TaxBandits integration
- Config: `apps/api/src/lib/config.ts` - TaxBandits section with OAuth client ID/secret + user token
- Route registration: Updated `apps/api/src/app.ts` to use new TaxBandits routes

**Frontend Changes:**
- Updated: `form-actions-panel.tsx` - 3-step UI (Create → Fetch PDFs → Transmit)
- Updated: `form-1099-nec-tab/index.tsx` - Integrated with TaxBandits endpoints
- Updated: `apps/workspace/src/lib/api-client.ts` - New TaxBandits endpoint methods + types
- No schema migration required on frontend

**Environment Variables:**
- `TAXBANDITS_CLIENT_ID` - OAuth client ID (required)
- `TAXBANDITS_CLIENT_SECRET` - OAuth client secret / JWT signing key (required)
- `TAXBANDITS_USER_TOKEN` - User token for JWT audience (required)
- `TAXBANDITS_SANDBOX` - Boolean flag to use sandbox API (default: true)

**Validation & Safety:**
- Org-scoped: All endpoints verify org access via `buildClientScopeFilter()`
- Business client only: Non-BUSINESS clients return 404
- Complete payer info validation: Business name, EIN, address required before create
- Sequence correlation: Forms mapped to TaxBandits records via Sequence index
- Batch grouping: Forms must be same tax year for single submission
- Auth pre-flight: TaxBandits auth checked before processing
- SSN handling: Contractor SSN decrypted for form submission, not stored in API response

**Testing:**
- type-check: All TypeScript errors resolved
- lint: No linting issues
- build: Successful compilation
- Verified: OAuth token flow, 401 retry, timeout handling, error responses

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
