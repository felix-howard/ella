# Phase 2.1 - AI Document Processing Services

**Status:** Complete (First Half + Second Half)
**Date:** 2026-01-13
**Branch:** `feature/phase-2.1-ai-document-processing`

## Overview

Phase 2.1 implements Gemini AI-powered document processing pipeline for automatic tax form recognition, validation, and data extraction. Transforms uploaded document images into structured, verified data via three-stage pipeline: Classification → Blur Detection → OCR Extraction.

## Architecture

### Pipeline Stages

```
Raw Image Upload
    ↓
1. Classification (Gemini Vision)
   ├─ Recognize document type (W2, 1099-NEC, SSN Card, etc.)
   ├─ Score confidence (0.0-1.0)
   └─ Handle unclassified documents
    ↓
2. Blur Detection (Gemini Vision)
   ├─ Assess image sharpness (0-100)
   ├─ Detect glare, shadows, rotation
   └─ Request resend if needed
    ↓
3. OCR Extraction (Gemini Vision + Document-Specific Prompts)
   ├─ Extract structured data
   ├─ Validate field completeness
   ├─ Score extraction confidence
   └─ Flag for manual verification if needed
    ↓
Database Updates + Action Creation
   ├─ Update RawImage status (CLASSIFIED, BLURRY, LINKED, etc.)
   ├─ Create DigitalDoc with extracted data
   ├─ Link to ChecklistItem
   └─ Create Action records for follow-ups
```

## Core Services

### 1. GeminiClient (`apps/api/src/services/ai/gemini-client.ts`)

Low-level Gemini API wrapper with robust error handling.

**Key Functions:**

```typescript
// Analyze image with Gemini vision model
analyzeImage<T>(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<{ success: boolean, data: T | null, error?: string }>

// Check if Gemini API is configured
isGeminiConfigured: boolean
```

**Features:**
- Auto-detects & validates supported formats: JPEG, PNG, WebP, HEIC, HEIF
- Size validation: ≤10MB per image
- Exponential backoff retry on transient errors (500, 502, 503, timeout, rate limit)
- Default: 3 retries, 1s base delay (1s → 2s → 4s)
- JSON parsing & type-safe response handling
- Works with model: `gemini-2.0-flash` (configurable via `GEMINI_MODEL` env var)
- Startup validation: `validateGeminiModel()` checks model availability on server start (non-blocking)
- Health status caching: `getGeminiStatus()` returns cached validation result for health checks

**Environment Variables:**
```env
GEMINI_API_KEY=<required>
GEMINI_MODEL=gemini-2.0-flash        # Default
GEMINI_MAX_RETRIES=3                  # Default
GEMINI_RETRY_DELAY_MS=1000            # Default
```

**Startup Validation (Phase 02 NEW):**
- Server calls `validateGeminiModel()` on startup (non-blocking)
- Validates model exists and API key works via token counting
- Caches result in memory for health endpoint
- Logs success/failure to console
- Does not block server startup on failure

**Health Status Check (Phase 02 NEW):**
- `getGeminiStatus()` returns cached validation result
- Used by `GET /health` endpoint to report AI availability
- Includes: configured flag, model name, available flag, check timestamp, error message
- No additional API calls needed (uses cached result)

### 2. DocumentClassifier (`apps/api/src/services/ai/document-classifier.ts`)

Recognizes document type from image.

**Key Functions:**

```typescript
// Classify image by document type
classifyDocument(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{
  success: boolean,
  docType?: string,
  confidence: number,
  error?: string
}>

// Check if document type needs OCR extraction
requiresOcrExtraction(docType: DocType): boolean
```

**Supported Types:**
- W2 (IRS employment income)
- 1099-INT (interest income)
- 1099-NEC (nonemployee compensation)
- 1099-DIV (dividend income) — future
- 1099-K (payment card transactions) — future
- 1099-R (retirement distributions) — future
- SSN_CARD (Social Security Card)
- DRIVER_LICENSE (state ID)

**Confidence Scoring:**
- 0.0-1.0 scale
- Considers primary document match + secondary indicators
- Returns 0 on error

**OCR Support Matrix:**
- W2, 1099-INT, 1099-NEC, SSN_CARD, DRIVER_LICENSE → OCR enabled
- 1099-DIV, 1099-K, 1099-R → Classification only (OCR coming Phase 3.1)

### 3. BlurDetector (`apps/api/src/services/ai/blur-detector.ts`)

Analyzes image quality & sharpness.

**Key Functions:**

```typescript
// Detect blur and quality issues
detectBlur(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{
  isBlurry: boolean,
  blurScore: number,        // 0-100
  issues?: string[],        // e.g., ["glare", "angle"]
  error?: string
}>

// Determine if client should resend image
shouldRequestResend(result: BlurDetectionResult): boolean

// Get user-friendly message (Vietnamese)
getResendMessage(result: BlurDetectionResult): string
```

**Sharpness Scale:**
- **0-49:** Sharp (✓ acceptable)
- **50-69:** Partially blurry (⚠ borderline)
- **70-100:** Blurry (✗ request resend)

**Issues Detected:**
- Excessive blur (motion, focus)
- Glare/reflections
- Poor lighting
- Rotation/skew
- Partial document visibility

### 4. OcrExtractor (`apps/api/src/services/ai/ocr-extractor.ts`)

Extracts structured data from document images.

**Key Functions:**

```typescript
// Extract data from document
extractDocumentData(
  imageBuffer: Buffer,
  mimeType: string,
  docType: string
): Promise<OcrExtractionResult>

// Check if extraction needs manual review
needsManualVerification(result: OcrExtractionResult): boolean

// Get user-friendly status message (Vietnamese)
getExtractionStatusMessage(result: OcrExtractionResult): string
```

**Result Structure:**
```typescript
interface OcrExtractionResult {
  success: boolean,
  docType: string,
  extractedData: Record<string, unknown> | null,
  confidence: number,           // 0.5-0.99 (0 if failed)
  isValid: boolean,             // Passes struct validation
  fieldLabels: Record<string, string>,  // Vietnamese labels
  error?: string,
  processingTimeMs?: number
}
```

**Confidence Calculation:**
- 50% base from key field completeness (50-90% range)
- 10% bonus from total field completeness (0-10% range)
- Cap at 0.99 (human review always option)

**Key Fields by Type:**
| Type | Key Fields |
|------|-----------|
| W2 | employerName, employeeSSN, wagesTipsOther, federalIncomeTaxWithheld |
| 1099-INT | payerName, recipientTIN, interestIncome |
| 1099-NEC | payerName, recipientTIN, nonemployeeCompensation |
| SSN_CARD | fullName, ssn |
| DRIVER_LICENSE | fullName, licenseNumber, expirationDate |

### 5. DocumentPipeline (`apps/api/src/services/ai/document-pipeline.ts`)

Orchestrates full processing pipeline.

**Key Functions:**

```typescript
// Process single image through pipeline
processImage(
  rawImageId: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<PipelineResult>

// Process multiple images with concurrency control
processImageBatch(
  images: BatchImageInput[],
  concurrency?: number
): Promise<PipelineResult[]>

// Get pipeline status & config
getPipelineStatus(): {
  aiConfigured: boolean,
  supportedDocTypes: string[],
  config: PipelineConfig
}
```

**Pipeline Configuration:**
```typescript
interface PipelineConfig {
  maxRetries: number,        // Default: 2
  retryDelayMs: number,      // Default: 1000
  batchConcurrency: number   // Default: 3
}
```

**Automatic Actions Created:**

| Condition | Action Type | Priority | Title |
|-----------|------------|----------|-------|
| Classification fails | AI_FAILED | HIGH | AI phân loại thất bại |
| Image is blurry | BLURRY_DETECTED | HIGH | Ảnh bị mờ - cần chụp lại |
| OCR confidence < 0.85 OR data invalid | VERIFY_DOCS | NORMAL | Xác minh dữ liệu OCR |
| Extraction fails | AI_FAILED | HIGH | Lỗi xử lý AI |

**Database Operations:**
- Update RawImage status & classification
- Create DigitalDoc with extracted data
- Link RawImage to ChecklistItem
- Increment ChecklistItem receivedCount
- Create Action records for follow-ups

### 6. PipelineHelpers (`apps/api/src/services/ai/pipeline-helpers.ts`)

Database access layer for pipeline operations.

**Key Functions:**
```typescript
// Update raw image status with classification
updateRawImageStatus(id, status, confidence, docType?)

// Get raw image case ID
getRawImageCaseId(rawImageId): Promise<string | null>

// Mark image processing
markImageProcessing(rawImageId)
markImageLinked(rawImageId)
markImageUnclassified(rawImageId)

// Link raw image to matching checklist item
linkToChecklistItem(rawImageId, caseId, docType): Promise<string | null>

// Create/update digital document
upsertDigitalDoc(rawImageId, caseId, docType, extractedData, status, confidence)

// Create action record
createAction(params: CreateActionParams): Promise<string>
```

## OCR Prompts

### 1. Classification Prompt (`prompts/classify.ts`)

Multi-class document type recognition.

**Input:** Document image
**Output:** JSON with recognized type & confidence

### 2. Blur Check Prompt (`prompts/blur-check.ts`)

Image quality assessment.

**Input:** Document image
**Output:** JSON with blur score (0-100) & issues list

### 3. OCR Router (`prompts/ocr/index.ts`)

Routes to document-specific extraction prompts.

**Supported Functions:**
```typescript
// Get form-specific prompt
getOcrPromptForDocType(docType): string | null

// Check OCR support
supportsOcrExtraction(docType): boolean

// Validate extracted data
validateExtractedData(docType, data): boolean

// Get Vietnamese field labels
getFieldLabels(docType): Record<string, string>
```

### 4. Form-Specific Prompts

#### W2 (`ocr/w2.ts`)
Employer income information.

**Extracted Fields:**
- employerName, employerAddress, employerEIN
- employeeName, employeeSSN, employeeAddress
- wagesTipsOther (Box 1) — main field
- federalIncomeTaxWithheld (Box 2)
- socialSecurityWages (Box 3), socialSecurityTax (Box 4)
- medicareWages (Box 5), medicareTax (Box 6)
- taxYear, corrected

**Vietnamese Labels:** ✓ All fields labeled

#### 1099-INT (`ocr/1099-int.ts`)
Interest income.

**Extracted Fields:**
- payerName, payerAddress, payerTIN
- recipientName, recipientAddress, recipientTIN
- interestIncome (Box 1) — main field
- federalIncomeTaxWithheld (Box 4)
- usSeriesBondInterest (Box 8)
- taxYear, corrected

**Vietnamese Labels:** ✓ All fields labeled

#### 1099-NEC (`ocr/1099-nec.ts`)
Nonemployee/contractor compensation.

**Extracted Fields:**
- payerName, payerAddress, payerTIN, payerPhone
- recipientName, recipientAddress, recipientTIN, accountNumber
- nonemployeeCompensation (Box 1) — main field
- payerMadeDirectSales (Box 2) — boolean
- federalIncomeTaxWithheld (Box 4)
- stateTaxInfo: [{ state, statePayerStateNo, stateIncome }]
- taxYear, corrected

**Vietnamese Labels:** ✓ All fields labeled
**Key Distinction:** Box 1 is contractor/freelance income (different from W2 employment)

#### SSN Card (`ocr/ssn-dl.ts` - SSN Card section)
Social Security Card.

**Extracted Fields:**
- fullName, firstName, middleName, lastName
- ssn (format: XXX-XX-XXXX)
- cardType: "REGULAR" | "NOT_VALID_FOR_EMPLOYMENT" | "VALID_FOR_WORK_WITH_DHS"
- issuedBy

**Vietnamese Labels:** ✓ All fields labeled
**Validation:** SSN must match pattern `^\d{3}-\d{2}-\d{4}$`

#### Driver's License (`ocr/ssn-dl.ts` - Driver's License section)
State-issued driver's license or ID.

**Extracted Fields:**
- fullName, firstName, middleName, lastName
- dateOfBirth (format: MM/DD/YYYY)
- address, city, state, zipCode
- licenseNumber, licenseClass (e.g., "C", "D", "CDL")
- issuedDate, expirationDate
- sex (M/F/X), height, weight, eyeColor
- restrictions, endorsements, documentDiscriminator
- issuingState

**Vietnamese Labels:** ✓ All fields labeled
**Validation:** Requires fullName, licenseNumber, expirationDate, issuingState

## Portal Integration

### File Upload Flow

**Endpoint:** `POST /portal/:token/upload`

1. Validate magic link token
2. Parse multipart form (up to 20 files)
3. Validate files: type (JPEG, PNG, WebP, HEIC, PDF), size (≤10MB each)
4. For each file:
   - Upload to R2 storage
   - Create RawImage record (status: UPLOADED)
   - **Trigger:** `processImage()` if Gemini configured
5. Return: Created images + AI results

**Response Example:**
```json
{
  "created": [
    {
      "id": "raw_xxx",
      "filename": "w2_2024.jpg",
      "status": "UPLOADED",
      "createdAt": "2026-01-13T21:15:00Z"
    }
  ],
  "aiResults": [
    {
      "imageId": "raw_xxx",
      "success": true,
      "docType": "W2",
      "isBlurry": false
    }
  ]
}
```

## Database Schema

### RawImage Updates
- `status`: UPLOADED → PROCESSING → CLASSIFIED/UNCLASSIFIED → BLURRY/LINKED
- `classifiedType`: Populated by classification stage
- `aiConfidence`: Classification confidence score (0.0-1.0)

### DigitalDoc Creation
- Created after successful OCR extraction
- `docType`: From classification
- `status`: EXTRACTED (all key fields) | PARTIAL (missing some) | FAILED
- `extractedData`: JSON object with form fields
- `aiConfidence`: OCR extraction confidence (0.5-0.99)
- `checklistItemId`: Link to matching requirement (if found)

### Action Records
- Type: AI_FAILED, BLURRY_DETECTED, VERIFY_DOCS
- Priority: HIGH (errors, blur) | NORMAL (verification)
- Metadata: rawImageId, docType, confidence, errorMessage, etc.
- Appears in: Workspace action queue, client portal notifications

## Error Handling

### Transient Errors (Auto-Retry)
- Rate limit (429)
- Timeout
- Server errors (500, 502, 503)
- Network issues

**Behavior:** Exponential backoff up to 3 times, then fail

### Non-Transient Errors (Create AI_FAILED Action)
- API key missing
- Invalid image format/size
- Gemini misconfiguration
- Unsupported document type (1099-DIV, 1099-K, 1099-R)

### Validation Errors (Create VERIFY_DOCS Action)
- OCR success but confidence < 0.85
- Data fails type validation
- Missing required key fields

## Configuration

### Environment Variables

**Required:**
```env
GEMINI_API_KEY=<your-api-key>
```

**Optional (with defaults):**
```env
GEMINI_MODEL=gemini-2.0-flash
GEMINI_MAX_RETRIES=3
GEMINI_RETRY_DELAY_MS=1000
AI_BATCH_CONCURRENCY=3
```

### Via Code
```typescript
// Check configuration
import { isGeminiConfigured } from '@ella/api/services/ai'

if (!isGeminiConfigured) {
  console.warn('Gemini API not configured - AI pipeline disabled')
}
```

## Usage Examples

### Single Image Processing

```typescript
import { processImage } from '@ella/api/services/ai'

const imageBuffer = await readFile('w2.jpg')
const result = await processImage(
  'raw_123',
  imageBuffer,
  'image/jpeg'
)

console.log(result)
// {
//   rawImageId: 'raw_123',
//   success: true,
//   classification: { docType: 'W2', confidence: 0.95 },
//   blurDetection: { isBlurry: false, blurScore: 25 },
//   ocrExtraction: { success: true, confidence: 0.92 },
//   digitalDocId: 'dd_456',
//   actionsCreated: [],
//   processingTimeMs: 2840
// }
```

### Batch Processing

```typescript
import { processImageBatch } from '@ella/api/services/ai'

const images = [
  { id: 'raw_1', buffer: buf1, mimeType: 'image/jpeg' },
  { id: 'raw_2', buffer: buf2, mimeType: 'image/jpeg' },
  { id: 'raw_3', buffer: buf3, mimeType: 'image/png' },
]

const results = await processImageBatch(images, 3) // Process 3 concurrent
// Returns PipelineResult[] for all images
```

### Direct Component Usage

```typescript
import { classifyDocument, detectBlur, extractDocumentData } from '@ella/api/services/ai'

// Just classify
const classResult = await classifyDocument(buffer, 'image/jpeg')

// Just blur check
const blurResult = await detectBlur(buffer, 'image/jpeg')

// Just OCR extract
const ocrResult = await extractDocumentData(buffer, 'image/jpeg', 'W2')
```

## Testing

### Unit Tests Strategy
- Mock Gemini responses
- Test each stage independently
- Validate error handling paths
- Check database interactions

### Integration Tests
- Use test images from staging folder
- Verify end-to-end pipeline
- Confirm Action creation
- Validate database state

### Manual Testing
1. Configure `.env` with test `GEMINI_API_KEY`
2. Upload documents via portal
3. Check workspace action queue
4. Verify RawImage, DigitalDoc, Action records in database
5. Review extracted data for accuracy

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Classification | 0.5-1.5s | Network + model inference |
| Blur Detection | 0.3-0.8s | Faster than OCR |
| OCR Extraction | 1-3s | Depends on form complexity |
| Full Pipeline | 2-5s | Total per image (no retries) |
| Batch (3 concurrent) | Parallel processing | Linear time per 3-image batch |

**Optimization Tips:**
- Use batch processing for multiple uploads
- Concurrency = 3 (default, tuned for rate limits)
- Set `GEMINI_RETRY_DELAY_MS` lower in local dev (e.g., 100ms)
- Monitor `processingTimeMs` in PipelineResult for perf tracking

## Security & Privacy

**Data Handling:**
- Image buffers never persisted (only metadata)
- Extracted data stored in PostgreSQL (`DigitalDoc.extractedData`)
- SSN/TIN processed by Gemini (shared responsibility model)
- No Gemini history retention (Google doesn't store for APIs)

**Recommendations:**
- Encrypt `GEMINI_API_KEY` in production (use secrets manager)
- Audit extracted SSN/TIN handling before production
- Implement rate limiting on `/portal/:token/upload` (currently unprotected per magic link)
- Log all AI operations for compliance review

## Troubleshooting

### Pipeline Disabled (AI_FAILED Action)
**Check:** `GEMINI_API_KEY` env var set?
```bash
echo $GEMINI_API_KEY
```

### "Unsupported MIME type"
**Allowed:** image/jpeg, image/png, image/webp, image/heic, image/heif
**Upload:** Must be actual image data (not renamed file)

### Very Low Confidence Scores
**Possible Causes:**
- Poor image quality (blur, glare, rotation)
- Partially visible form
- Non-standard form layout
- Gemini model limitations on specific document version

**Action:** VERIFY_DOCS action created for manual review

### Timeout/Rate Limit Errors
**Behavior:** Automatic retry with exponential backoff
**If Persistent:** Check Gemini quota/billing, consider increasing `GEMINI_RETRY_DELAY_MS`

### OCR Extraction Not Triggered
**Check:** `supportsOcrExtraction(docType)` in code
**Currently Supported:** W2, 1099-INT, 1099-NEC, SSN_CARD, DRIVER_LICENSE
**Future:** 1099-DIV, 1099-K, 1099-R (coming Phase 3.1)

## Future Enhancements

### Phase 3.1
- Add OCR for 1099-DIV, 1099-K, 1099-R
- Multi-page document support (PDF extraction)
- Form field cross-validation

### Phase 3.2
- User-guided field correction UI (workspace)
- Confidence threshold adjustments
- Custom prompt templates per client

### Phase 4.0
- Batch document re-verification
- ML model fine-tuning on tax docs
- Real-time OCR quality analytics

## References

- [Gemini API Docs](https://ai.google.dev/)
- [OCR Prompt Examples](./phase-2.1-ai-services.md#ocr-prompts)
- [Database Schema](./codebase-summary.md#database-schema-highlights)
- [Pipeline Architecture Diagram](./system-architecture.md#ai-pipeline)
