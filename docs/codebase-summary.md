# Ella - Codebase Summary (Quick Reference)

**Current Date:** 2026-01-18
**Current Branch:** feature/more-enhancement

## Project Status Overview

| Phase | Status | Completed |
|-------|--------|-----------|
| **Client Message UX** | **Header "Tin nhắn" button with unread badge + `/messages/:caseId/unread` endpoint** | **2026-01-18** |
| **Phase 04 Priority 3** | **OCR Expansion - 1098-T, 1099-G, 1099-MISC (16 document types total)** | **2026-01-17** |
| **Phase 01 Classification** | **Classification Enhancement - Few-shot examples, Vietnamese names, confidence calibration** | **2026-01-16** |
| **Phase 02 OCR** | **PDF OCR Support - Multi-page extraction with intelligent merging** | **2026-01-16** |
| **Phase 01** | **PDF Converter Service (200 DPI, 20MB, 10-page limits)** | **2026-01-16** |
| **Phase 04 Tabs** | **Tab Layout Refactor (3-Tab Workflow: Uploads, Review, Verified)** | **2026-01-15** |
| **Phase 03 Shared** | **Shared Components (Field Verification, Copy Tracking)** | **2026-01-15** |
| **Phase 06** | **Testing Infrastructure & Edge Case Handling** | **2026-01-15** |
| **Phase 05** | **Real-time Updates (Polling & Notifications)** | **2026-01-14** |
| **Phase 04** | **Frontend Review UX (Confidence Badges & Classification Modal)** | **2026-01-14** |
| **Phase 3.3** | **Duplicate Detection & Grouping** | **2026-01-14** |
| **Phase 3** | **Production Ready (JWT Auth + RBAC)** | **2026-01-14** |
| Phase 4.2 | Side-by-Side Document Viewer (Pan/Zoom/Field Highlighting) | **2026-01-14** |
| Phase 4.1 | Copy-to-Clipboard Workflow (Data Entry Optimization) | 2026-01-14 |
| Phase 3.2 | Unified Inbox & Conversation Management | 2026-01-14 |
| Phase 3.1 | Twilio SMS Integration (Complete: First Half + Second Half) | 2026-01-13 |
| **Phase 2** | **Make It Usable (Core Workflow)** | **2026-01-14** |
| Phase 2.2 | Dynamic Checklist System (Atomic Transactions) | 2026-01-13 |
| Phase 2.1 | AI Document Processing | 2026-01-13 |
| Phase 5 | Verification | 2026-01-12 |
| Phase 4 | Tooling (ESLint, Prettier) | 2026-01-11 |
| Phase 3 (Old) | Apps Setup (API, Portal, Workspace) | Complete |
| Phase 2 Infrastructure | Packages Setup (DB, Shared, UI) | Complete |
| Phase 1.5 | Shared UI Components | 2026-01-13 |
| Phase 1.4 | Client Portal | 2026-01-13 |
| Phase 1.3 | Workspace UI Foundation | 2026-01-13 |
| Phase 1.2 | Backend API Endpoints | 2026-01-13 |
| Phase 1.1 | Database Schema | 2026-01-12 |

## Architecture at a Glance

```
ella/ (Monorepo - pnpm workspaces)
├── apps/
│   ├── api/          # Hono backend (PORT 3002)
│   ├── portal/       # Client upload portal (PORT 5174)
│   └── workspace/    # Staff management UI (PORT 5173)
├── packages/
│   ├── db/           # Prisma client + schema
│   ├── shared/       # Zod schemas + TypeScript types
│   └── ui/           # 11 shared components library
└── .claude/          # Documentation & workflows
```

## Key Technologies

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 6, TanStack Router, Tailwind CSS 4 |
| **Backend** | Hono, Node.js, TypeScript |
| **Database** | PostgreSQL, Prisma ORM |
| **UI Components** | shadcn/ui, Radix UI, class-variance-authority, lucide-react |
| **Validation** | Zod |
| **Package Manager** | pnpm |
| **Orchestration** | Turbo |

## Core Packages

See [phase-1.5-ui-components.md](./phase-1.5-ui-components.md) for detailed UI library docs.

**@ella/db** - Database layer with 13 models, 12 enums, singleton connection pooling.
**@ella/shared** - Validation schemas + TypeScript types via Zod.
**@ella/ui** - 11-component shared library + Phase 03 shared components (FieldVerificationItem, ImageViewer, etc).

## Core Applications

### @ella/api
**REST API (Hono framework, PORT 3002)** - 42+ endpoints across 8 modules with Zod validation, global error handling, OpenAPI docs.

### @ella/portal
**Client-facing upload portal (React, PORT 5174)** - Passwordless magic link auth, mobile-optimized (max 448px), file validation, real-time progress.

### @ella/workspace
**Staff management dashboard (React, PORT 5173)** - Vietnamese-first UI, Zustand state, 20+ components, real-time polling.

**Pages:**
- `/clients/$clientId` - Client detail (2 tabs: Overview, Documents + Header "Tin nhắn" button with unread badge)

**Features:**
- 10s polling: active conversation
- Copy-to-clipboard workflow (Phase 4.1)
- 3-tab document workflow (Phase 04 Tabs)
- 5s polling: classification updates on Documents tab (real-time status tracking)
- Efficient unread count fetching via `/messages/:caseId/unread` endpoint (30s cache)

See [detailed architecture guide](./system-architecture.md) for full API/data flow docs.

## Backend Services

### AI Classification & Document Processing

**Locations:**
- Classification Prompt: `apps/api/src/services/ai/prompts/classify.ts`
- Classifier Service: `apps/api/src/services/ai/document-classifier.ts`
- OCR Extraction: `apps/api/src/services/ai/ocr-extractor.ts`
- PDF Conversion: `apps/api/src/services/pdf/pdf-converter.ts`

### Document Classification (Phase 01 - Enhanced)

**Function:** `classifyDocument(imageBuffer, mimeType): Promise<DocumentClassificationResult>`

**Classification Enhancements (2026-01-16):**
- **6 Few-Shot Examples:** W-2, SSN Card, 1099-K, 1099-INT, 1099-NEC, Driver's License with confidence scores
- **Vietnamese Name Handling:** Family name FIRST, common surnames, ALL CAPS format, middle names
- **Confidence Calibration:** HIGH (0.85-0.95), MEDIUM (0.60-0.84), LOW (<0.60), UNKNOWN (<0.30)
- **Alternativeypes:** Included when confidence <0.80 to help reviewers

**Supported Document Types (24 + UNKNOWN):**
- **ID:** SSN_CARD, DRIVER_LICENSE, PASSPORT
- **Tax Income (10):** W2, FORM_1099_INT, FORM_1099_DIV, FORM_1099_NEC, FORM_1099_MISC, FORM_1099_K, FORM_1099_R, FORM_1099_G, FORM_1099_SSA, SCHEDULE_K1
- **Tax Credits (3):** FORM_1098, FORM_1098_T, FORM_1095_A
- **Business (4):** BANK_STATEMENT, PROFIT_LOSS_STATEMENT, BUSINESS_LICENSE, EIN_LETTER
- **Other (4):** RECEIPT, BIRTH_CERTIFICATE, DAYCARE_RECEIPT, OTHER

**Performance:** 2-5s per image

### PDF Converter Service (Phase 01 - Enhanced Phase 3)

**Function:** `convertPdfToImages(pdfBuffer): Promise<PdfConversionResult>`
- 200 DPI PNG rendering for optimal OCR & classification accuracy
- Magic bytes validation + encryption detection
- 20MB size limit, 10-page maximum, auto temp cleanup
- Vietnamese error messages (INVALID_PDF, ENCRYPTED_PDF, TOO_LARGE, TOO_MANY_PAGES)

**Phase 3 Enhancement (2026-01-17):**
- Now used in classification pipeline (Step 2: fetch-image)
- PDF first page converted to PNG before Gemini classification
- Solves API compatibility - Gemini may reject raw PDF input
- Matches OCR extractor behavior for consistency

### OCR Extraction Service (Phase 02 - Enhanced Phase 2 Priority 1)

**Function:** `extractDocumentData(buffer, mimeType, docType): Promise<OcrExtractionResult>`
- **Single Images:** Direct Gemini vision → JSON data + confidence score
- **Multi-Page PDFs:**
  - Auto-converts each page to PNG
  - Processes each page independently through OCR
  - **Intelligent Merge:** Later pages override earlier values (handles amendments)
  - **Weighted Confidence:** Confidence weighted by field contribution across pages
  - Returns: `pageCount`, `pageConfidences[]`, merged `extractedData`

**OCR Extraction Strategy (Exclusion-Based):**
Excludes 9 types: PASSPORT, PROFIT_LOSS_STATEMENT, BUSINESS_LICENSE, EIN_LETTER, RECEIPT, BIRTH_CERTIFICATE, DAYCARE_RECEIPT, OTHER, UNKNOWN. All other types require OCR.

**Phase 2 Priority 1 - New Document Types (2026-01-17):**
- **FORM_1099_K** - Payment Card Transactions (Square, Clover, PayPal)
- **SCHEDULE_K1** - Partnership Income (K-1 forms)
- **BANK_STATEMENT** - Business Cash Flow documentation

**Phase 3 - Extended OCR Support (2026-01-17):**
- **FORM_1099_DIV** - Dividends and distributions
- **FORM_1099_R** - Retirement distributions (IRAs, pensions, annuities)
- **FORM_1099_SSA** - Social Security benefits
- **FORM_1098** - Mortgage interest and property taxes
- **FORM_1095_A** - Health insurance marketplace coverage

**Phase 4 Priority 3 - OCR Expansion (2026-01-17 NEW):**
- **FORM_1098_T** - Tuition statements, education credits
- **FORM_1099_G** - Government payments, unemployment compensation
- **FORM_1099_MISC** - Miscellaneous income (rents, royalties, other)

**Supported OCR Prompts (16 total):**
- `prompts/ocr/w2.ts` - W-2 employment income
- `prompts/ocr/1099-int.ts` - Interest income
- `prompts/ocr/1099-nec.ts` - Contractor compensation
- `prompts/ocr/1099-k.ts` - Payment card transactions
- `prompts/ocr/k-1.ts` - Partnership income
- `prompts/ocr/bank-statement.ts` - Business cash flow
- `prompts/ocr/1099-div.ts` - Dividends
- `prompts/ocr/1099-r.ts` - Retirement distributions
- `prompts/ocr/1099-ssa.ts` - Social Security benefits
- `prompts/ocr/1098.ts` - Mortgage interest
- `prompts/ocr/1095-a.ts` - Health insurance marketplace
- `prompts/ocr/1098-t.ts` (NEW Phase 4 P3) - Education credits
- `prompts/ocr/1099-g.ts` (NEW Phase 4 P3) - Government payments
- `prompts/ocr/1099-misc.ts` (NEW Phase 4 P3) - Miscellaneous income
- `prompts/ocr/ssn-dl.ts` - SSN card & driver's license

**Performance:** +500ms per page for PDFs

**Testing:** 20+ unit tests covering single/multi-page, merging, confidence weighting

See [Phase 01 PDF Converter documentation](./phase-01-pdf-converter.md) for full details.

## Development Quick Start

```bash
pnpm install
pnpm -F @ella/db generate && pnpm -F @ella/db push && pnpm -F @ella/db seed
turbo run dev    # All apps in parallel
turbo lint       # ESLint
pnpm format      # Prettier
pnpm type-check  # TypeScript
```

## Environment Variables

**Required:** `DATABASE_URL=postgresql://...`

**Auth (Phase 3):** `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_DAYS`

**AI (Phase 2.1):** `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_BATCH_CONCURRENCY`
- Health endpoint reports model availability (Phase 02)
- Startup validation runs non-blocking on server start
- Cached status accessible via `GET /health` → `gemini` field

**SMS (Phase 3.1):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

See [phase-02-api-endpoints.md](./phase-02-api-endpoints.md) for full environment reference.

## Field Reference System (Phase 05 - Updated 2026-01-17)

**Purpose:** Centralized field mappings and Vietnamese labels for document type verification workflow.

**Files:**
- `apps/workspace/src/lib/doc-type-fields.ts` - Field arrays for each document type (18 types)
- `apps/workspace/src/lib/field-labels.ts` - Vietnamese labels for 200+ extracted data fields

**1099-NEC Field Update (Phase 3 - 2026-01-17):**
- Expanded from 6 to 18 fields
- Added payer/recipient full info (address, phone, TIN/SSN)
- Flattened state tax array (state, statePayerStateNo, stateIncome)
- Updated field casing to match OCR schema (payerTIN, recipientTIN)

**Verification Modal Integration:**
- Uses `getFieldLabel(docType, fieldKey)` for display
- Flattens nested `stateTaxInfo` arrays automatically
- Supports 24+ document types with type-safe field references

See [phase-05-verification-modal.md](./phase-05-verification-modal.md) for detailed field mappings and verification workflow.

## Recent Feature: Client Messages Tab (NEW - 2026-01-15)

**Location:** `apps/workspace/src/components/client-detail/`

**Component:** `ClientMessagesTab` (~210 LOC)
- SMS-only messaging within client detail page
- 10s polling (only when tab active)
- Race condition protection via fetch ID tracking
- Reuses MessageThread + QuickActionsBar
- Error handling + retry button
- Vietnamese UI

See [Client Messages Tab Feature](./client-messages-tab-feature.md) for full details.

## Design System

**Colors:** Mint #10b981, Coral #f97316, Success #22c55e, Error #ef4444
**Typography:** System font stack, 10-24px sizes
**Spacing:** 4-32px scale, rounded 6-full

## Documentation Structure

| File | Purpose |
|------|---------|
| [codebase-summary.md](./codebase-summary.md) | This file - quick reference |
| [phase-1.5-ui-components.md](./phase-1.5-ui-components.md) | UI library detailed reference |
| [client-messages-tab-feature.md](./client-messages-tab-feature.md) | Client Messages Tab implementation |
| [system-architecture.md](./system-architecture.md) | System design & data flow |
| [code-standards.md](./code-standards.md) | Coding standards & patterns |
| [project-overview-pdr.md](./project-overview-pdr.md) | Project vision & requirements |

---

**Last Updated:** 2026-01-17
**Status:** Phase 04 Priority 3 OCR (16 document types) + Phase 03 OCR Extended (13) + Phase 01 Classification Enhancement + Phase 02 OCR (PDF Multi-page) + Phase 01 PDF Converter + Phase 04 Tabs + Phase 03 Shared + Phase 06 Testing
**Branch:** feature/enhancement
**Architecture Version:** 6.7.0

For detailed phase documentation, see [PHASE-04-INDEX.md](./PHASE-04-INDEX.md) or [PHASE-06-INDEX.md](./PHASE-06-INDEX.md).
