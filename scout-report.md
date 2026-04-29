# AI/OCR Document Classification Scout Report

**Date:** 2026-04-10
**Scope:** apps/api/src - Gemini AI, classification, OCR

## Key Files

### Core AI Services
- `apps/api/src/services/ai/gemini-client.ts` (596 lines) - Gemini wrapper + retry logic
- `apps/api/src/services/ai/document-classifier.ts` (658 lines) - Classification logic
- `apps/api/src/jobs/classify-document.ts` (917 lines) - Main Inngest job pipeline
- `apps/api/src/services/ai/ocr-extractor.ts` - OCR extraction
- `apps/api/src/services/ai/prompts/classify.ts` - 200+ doc types + prompt
- `apps/api/src/services/ai/prompts/ocr/*.ts` - 100+ doc-specific OCR prompts

### API Routes
- `apps/api/src/routes/docs/index.ts` (737 lines) - Classify/verify endpoints
- `apps/api/src/routes/portal/index.ts` - Client upload portal

## Classification Pipeline (5 Steps)

1. **Idempotency Check** - Atomic UPLOADED→PROCESSING, prevents duplicates
2. **Fetch Image** - Download from R2, auto-resize >4MB, PDFs to Gemini directly
3. **Duplicate Detection** - pHash check, skip AI if duplicate
4. **Gemini Classification** - Vision API call, returns docType + confidence (0-1)
5. **OCR Extraction** - If confidence ≥60% and docType supports OCR
6. **File Rename** - Convention-based naming, sync R2 key to messages

## Confidence Routing

- **≥85%** - Auto-linked (no action)
- **60-85%** - Linked + VERIFY_DOCS action for CPA review
- **<60%** - Smart rename fallback, moved to OTHER if fails

## Document Type System

**200+ DocType values** in schema.prisma:
- Personal/Identity: SSN_CARD, DRIVER_LICENSE, PASSPORT, GREEN_CARD, WORK_VISA, etc.
- Employment: W2, W2G, PAY_STUB, RSU_STATEMENT, ESPP_STATEMENT
- 1099 Series: 27 variants (INT, DIV, NEC, MISC, K, R, G, SSA, B, C, etc.)
- K-1 Forms: SCHEDULE_K1 + 1065/1120S/1041 variants
- Tax Returns: FORM_1040 family + all schedules (A-E, F-J, etc.)
- Business: BANK_STATEMENT, PROFIT_LOSS, BALANCE_SHEET, PAYROLL, etc. (18 types)
- IRS Forms: 42+ forms (2210, 2441, 2555, 4562, 8829, 8863, etc.)
- Other: CRYPTO_STATEMENT, FOREIGN_BANK_STATEMENT, CLOSING_DISCLOSURE, etc.

**DocCategory (6 values):** IDENTITY, INCOME, TAX_RETURNS, EXPENSE, ASSET, OTHER

## Gemini API Integration

**Model Configuration:**
- Primary: gemini-2.5-flash-latest
- Fallbacks: gemini-2.0-flash, gemini-pro-vision (on 404)
- Retries: 3 max, exponential backoff (1000ms base)

**Supported Formats:**
- Images: JPEG, PNG, WebP, HEIC, HEIF (10MB max)
- PDFs: Native support, 20MB max, multi-page with per-page confidence

## Upload API (Portal)

**POST /portal/{magicLink}/upload**
- Auth: Magic link token (no API key)
- Validation: Images/PDF only, 10MB per file, 50 files max
- Flow: Upload to R2 → Create RawImage → Send Inngest event → Return status

## Features Implemented

✓ 200+ doc type classification
✓ Gemini Vision (images + PDFs)
✓ Confidence-based routing
✓ 100+ doc-specific OCR prompts
✓ Multi-page PDF support
✓ Continuation page detection
✓ Smart filename fallback
✓ Error recovery (service unavailability)
✓ Field-level verification tracking
✓ Atomic DB + R2 transactions

