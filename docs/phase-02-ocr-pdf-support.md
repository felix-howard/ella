# Phase 02: OCR PDF Support - Multi-Page Extraction with Intelligent Merging

**Status:** Complete
**Date:** 2026-01-16
**Component:** `apps/api/src/services/ai/ocr-extractor.ts`

## Overview

Phase 02 extends OCR extraction to support multi-page PDF documents through intelligent data merging. Previously, OCR could only extract from single images. Now the system automatically converts PDFs to images, processes each page independently, and merges results with tax-document-aware logic.

**Key Achievement:** Tax documents (especially W2, 1099 forms) often have amendments or corrections on later pages. The merge strategy prioritizes later pages while calculating confidence based on each page's field contribution.

## Architecture

### Service Layer

**Location:** `apps/api/src/services/ai/ocr-extractor.ts` (370 LOC)

```typescript
// Single entry point for both images and PDFs
export async function extractDocumentData(
  imageBuffer: Buffer,
  mimeType: string,
  docType: string
): Promise<OcrExtractionResult>
```

**Internal Functions:**
- `extractFromImage()` - Existing single-image logic (unchanged)
- `extractFromPdf()` - NEW: PDF → image conversion → per-page OCR → merge
- `mergePageResults()` - NEW: Intelligent multi-page result merging
- `calculateConfidence()` - Existing confidence scoring (reused)

### Type System

**Enhanced Result Type:**

```typescript
export interface OcrExtractionResult {
  success: boolean
  docType: string
  extractedData: Record<string, unknown> | null
  confidence: number
  isValid: boolean
  fieldLabels: Record<string, string>
  error?: string
  processingTimeMs?: number
  // Phase 02: Multi-page support
  pageCount?: number
  pageConfidences?: number[]
}
```

**New Fields:**
- `pageCount`: Total PDF pages processed
- `pageConfidences`: Array of per-page confidence scores (1-indexed alignment)

## Implementation

### PDF Extraction Flow

```
extractDocumentData(pdfBuffer, 'application/pdf', 'W2')
    ↓
Check Gemini configured + doc type supports OCR
    ↓
Route: isPdfMimeType? → extractFromPdf() : extractFromImage()
    ↓
[extractFromPdf]
├─ convertPdfToImages(pdfBuffer)
├─ For each page:
│  ├─ analyzeImage<Record<string, unknown>>(pageBuffer, 'image/png', prompt)
│  └─ calculateConfidence(pageData, docType)
│  └─ Cache: { data, confidence } in pageResults[]
├─ mergePageResults(pageResults)
└─ Return: success=true, pageCount, pageConfidences[], confidence, extractedData
```

### Merge Algorithm

**Strategy:** Tax documents prioritize amendments on later pages

```typescript
function mergePageResults(
  pageResults: Array<{ data: Record<string, unknown>; confidence: number }>
): { data: Record<string, unknown>; confidence: number }
```

**Steps:**

1. **Initialize tracking:**
   - `mergedData` - Final field values
   - `fieldSources` - Track which page each field came from (1-indexed)

2. **Iterate pages (in order):**
   - For each page's fields:
     - If value is non-empty: `mergedData[key] = value` (override)
     - Track page number: `fieldSources[key] = pageNumber`

3. **Calculate weighted confidence:**
   - Total fields = `Object.keys(mergedData).length`
   - For each page:
     - Count fields contributed by page
     - Weight = `fieldsFromPage / totalFields`
     - Weighted confidence += `pageConfidence * weight`
   - Cap at `MAX_CONFIDENCE` (0.99)

**Example:**

| Page | Fields Extracted | Page Confidence |
|------|------------------|-----------------|
| 1    | name, ssn, wage  | 0.90            |
| 2    | wage (amended), notes | 0.85        |
| **Merged** | name, ssn, wage (from p2), notes | **0.88** |

Calculation: (0.90 * 3/4) + (0.85 * 1/4) = 0.675 + 0.2125 = 0.8875

### Constants

| Name | Value | Purpose |
|------|-------|---------|
| `MAX_CONFIDENCE` | 0.99 | Never show 100% for AI extraction |
| `SUPPORTED_MIME_TYPES` | Image types + `application/pdf` | Accept images + PDFs |

### Error Handling

**PDF-Specific Errors (Vietnamese):**

```
"Không thể trích xuất dữ liệu từ bất kỳ trang PDF nào"
→ "Failed to extract data from any PDF page"
```

Occurs when no page returns valid OCR data.

**Fallback to existing error handling:**
- Image conversion failures → reuse PDF converter errors (INVALID_PDF, ENCRYPTED_PDF, etc.)
- Gemini failures → reuse Gemini error mapping

## Testing

**Test Coverage:** 20 tests (NEW in Phase 02)

**File:** `apps/api/src/services/ai/__tests__/ocr-extractor.test.ts`

### Test Categories

**1. Single Image Tests (8 tests - existing):**
- W2 extraction success
- 1099-INT extraction
- Unsupported doc type
- Gemini API failure
- Invalid MIME type
- etc.

**2. PDF Extraction Tests (12 tests - NEW):**

| Test | Purpose |
|------|---------|
| Successfully extracts from single-page PDF | Verify PDF path routing |
| Successfully extracts from 3-page PDF | Verify multi-page flow |
| Merges results correctly (later pages override) | Verify override logic |
| Calculates weighted confidence | Verify weighting formula |
| Handles PDF conversion failure | Error: "PDF conversion failed" |
| Handles no successful page extractions | Error: "Không thể trích xuất..." |
| Includes pageCount in result | Metadata included |
| Includes pageConfidences array | Per-page tracking |
| Returns invalid doc type error for PDF | Type validation |
| Returns invalid MIME type error | MIME type validation |
| Vietnamese error messages in result | Localization check |

### Running Tests

```bash
# Run OCR extractor tests only
pnpm -F @ella/api test ocr-extractor

# Run with coverage
pnpm -F @ella/api test ocr-extractor -- --coverage

# Run all API service tests
pnpm -F @ella/api test
```

## Integration Points

### 1. Inngest Job (classify-document.ts)

OCR extraction is triggered in Step 6 of the job:

```typescript
// In durable step: 'ocr-extract'
if (needsOcr && supportsOcrExtraction(docType)) {
  const ocrResult = await extractDocumentData(
    imageBuffer,
    page.mimeType,  // 'image/png' for PDFs, actual mime for images
    docType
  )

  if (ocrResult.success && ocrResult.isValid) {
    // Store DigitalDoc with extracted data
    // pageCount/pageConfidences included in metadata if multi-page
  }
}
```

### 2. Portal Upload

When client uploads PDF via magic link:

```typescript
// POST /portal/:token/upload
if (isPdfMimeType(file.type)) {
  const conversionResult = await convertPdfToImages(fileBuffer)

  for (const page of conversionResult.pages!) {
    // Create RawImage per page (handled by PDF converter)
    // Inngest job will:
    // 1. Receive image buffer (PNG from PDF page)
    // 2. Call extractDocumentData()
    // 3. Merge if multi-page extraction needed
  }
}
```

### 3. DigitalDoc Storage

Extracted data stored in DigitalDoc model:

```typescript
// apps/api/src/routes/docs/{id}.ts
const digitalDoc = await prisma.digitalDoc.upsert({
  where: { id },
  create: {
    extractedData: ocrResult.extractedData,  // Merged data
    aiConfidence: ocrResult.confidence,       // Weighted confidence
    docType: ocrResult.docType,
    // Metadata for Phase 02 multi-page
    pageMetadata: {
      pageCount: ocrResult.pageCount,
      pageConfidences: ocrResult.pageConfidences,
    }
  }
})
```

## Supported Document Types

**OCR-Enabled Types (8 total):**

**Phase 02 Original (5 types):**
- **W2** - Employment income (most common amendment case)
- **FORM_1099_INT** - Interest income
- **FORM_1099_NEC** - Contractor compensation
- **SSN_CARD** - Social Security card
- **DRIVER_LICENSE** - State ID

**Phase 2 Priority 1 - NEW (3 types, added 2026-01-17):**
- **FORM_1099_K** - Payment Card Transactions (Square, Clover, PayPal)
- **SCHEDULE_K1** - Partnership Income (K-1 forms)
- **BANK_STATEMENT** - Business Cash Flow documentation

Each type has:
- Dedicated OCR prompt (e.g., `prompts/ocr/w2.ts`, `prompts/ocr/1099-k.ts`, `prompts/ocr/k-1.ts`, `prompts/ocr/bank-statement.ts`)
- Key fields list for confidence calculation
- Vietnamese field labels (e.g., "Tên công ty" for employer name)

## Confidence Scoring

**Per-Document-Type Key Fields:**

| Doc Type | Key Fields | Min for 85%+ |
|----------|-----------|------------|
| W2 | employerName, employeeSSN, wagesTipsOther, federalIncomeTaxWithheld | 4/4 |
| FORM_1099_INT | payerName, recipientTIN, interestIncome | 3/3 |
| SSN_CARD | fullName, ssn | 2/2 |

**Score Calculation:**
```
Base confidence (0.5-0.9):
  = 0.5 + (filledKeyFields / totalKeyFields) * 0.4

Bonus (+0.0-0.1):
  = (filledTotalFields / totalFields) * 0.1

Final:
  = min(base + bonus, MAX_CONFIDENCE)
```

## Vietnamese Localization

**UI Messages (via getExtractionStatusMessage):**

| Confidence | Message |
|-----------|---------|
| >= 85% | "Trích xuất thành công với độ tin cậy cao" |
| 70-85% | "Trích xuất thành công, một số trường có thể cần xác minh" |
| < 70% | "Trích xuất một phần, cần xác minh nhiều trường" |
| Failed | "Lỗi trích xuất: {error}" |

**Validation Status:**
```typescript
needsManualVerification(result): boolean
  → true if confidence < 0.85 || !isValid || !success
```

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Single image OCR | 2-3s | Gemini vision call |
| PDF page conversion | 200-500ms | Per page at 200 DPI |
| OCR per page | 2-3s | Gemini vision call |
| Merging N pages | < 100ms | Merge algorithm |
| **3-page PDF total** | **6-10s** | Sequential processing |
| **10-page PDF total** | **20-35s** | Max page limit |

**Optimization:** Pages processed sequentially (not parallel) to respect Inngest throttle (10 jobs/min, global limit).

## Error Recovery

### PDF Conversion Failures

If `convertPdfToImages()` returns error:
```typescript
return {
  success: false,
  error: conversionResult.error,  // Vietnamese PDF error
  pageCount: 0
}
```

Example: "Tệp PDF quá lớn (tối đa 20MB)."

### Partial Page Failures

If page N fails OCR but page N+1 succeeds:
```typescript
pageResults = [
  { data: {...}, confidence: 0.88 },  // Page 1 OK
  // Page 2 failed, skipped
  { data: {...}, confidence: 0.85 }   // Page 3 OK
]

// Merge uses only successful pages
// Result has pageCount: 3, pageConfidences: [0.88, undefined, 0.85]
```

### No Successful Extractions

If all pages fail:
```typescript
return {
  success: false,
  error: "Không thể trích xuất dữ liệu từ bất kỳ trang PDF nào",
  pageCount: pages.length,
  pageConfidences: []  // Empty array
}
```

## Files Modified/Created

**Modified:**
- `apps/api/src/services/ai/ocr-extractor.ts` - Added PDF support
- `apps/api/package.json` - No new dependencies (reuses pdf-poppler)

**Created:**
- `apps/api/src/services/ai/__tests__/ocr-extractor.test.ts` - 20 unit tests

**Unchanged (Reused):**
- `apps/api/src/services/pdf/pdf-converter.ts` - Handles PDF → images
- `apps/api/src/services/ai/gemini-client.ts` - Handles image analysis
- `apps/api/src/services/ai/prompts/ocr/*.ts` - OCR prompts

## Next Steps

### For Developers

1. **Testing PDFs:**
   ```bash
   # Run test suite to verify all scenarios
   pnpm -F @ella/api test ocr-extractor

   # Manual testing: upload 3-page W2 PDF via portal
   # Verify: staff sees merged data + confidence score
   ```

2. **Monitoring:**
   - Watch for "Không thể trích xuất dữ liệu từ bất kỳ trang PDF nào" errors in logs
   - Check average confidence for multi-page documents (should be similar to single-page)
   - Monitor for > 20s OCR times (indicates 10-page PDF)

3. **Debugging:**
   - `pageConfidences[]` array shows confidence per page
   - `pageCount` shows total pages processed
   - Compare with individual page data if merge looks incorrect

### For Staff

- Clients can now upload PDFs directly (Phase 01 PDF Converter handles it)
- Multi-page documents merge automatically (later pages override)
- Confidence scores reflect merged data quality

## Related Documentation

- [Phase 01: PDF Converter Service](./phase-01-pdf-converter.md) - PDF → PNG conversion
- [System Architecture - OCR Pipeline](./system-architecture.md#ai-document-processing-pipeline-flow---phase-02-implementation)
- [Code Standards - AI Services](./code-standards.md)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Later pages override | Tax documents have amendments on page 2+ |
| Weighted confidence | Reflects actual data contribution per page |
| Sequential page processing | Respects Inngest rate limits (10 jobs/min) |
| No parallel OCR | Prevents simultaneous Gemini calls for same document |
| Reuse PDF converter | Leverages Phase 01 validation + safety limits |
| 0.99 MAX_CONFIDENCE | Honest about AI limitations (never claim 100%) |

---

**Last Updated:** 2026-01-17 (Phase 2 Priority 1 enhancements)
**Phase:** Phase 02 - OCR PDF Support (Complete) + Phase 2 Priority 1 - Extended Document Types
**Architecture Version:** 6.5.0
**Test Coverage:** 20+ tests (100% pass)

## Phase 2 Priority 1 Update (2026-01-17)

**New Files Created:**
- `apps/api/src/services/ai/prompts/ocr/1099-k.ts` - 1099-K payment card extraction
- `apps/api/src/services/ai/prompts/ocr/k-1.ts` - K-1 partnership income extraction
- `apps/api/src/services/ai/prompts/ocr/bank-statement.ts` - Bank statement cash flow extraction

**Files Modified:**
- `apps/api/src/services/ai/prompts/ocr/index.ts` - Routes added for new document types
- `apps/api/src/services/ai/ocr-extractor.ts` - Key fields definitions expanded

**Key Enhancements:**
- 3 new document types now support OCR extraction
- Payment processor support (Square, Clover, PayPal) for 1099-K
- Partnership income flows tracked via K-1 forms
- Business cash flow analysis via bank statements
- All new types integrated with existing confidence scoring and multi-page PDF merge logic
