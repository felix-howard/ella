# Phase 02: Background Document Classification Job

**Status:** Complete
**Date:** 2026-01-14
**Branch:** feature/enhancement
**Focus:** Inngest background job processing, confidence-based document routing, OCR integration

---

## Overview

Phase 02 implements production-ready background document classification via Inngest. Transforms document upload into an automated multi-stage pipeline: fetch from storage → classify with Gemini → route by confidence → extract structured data → update database atomically.

**Key Achievement:** Confidence-based routing eliminates manual classification bottleneck. High-confidence documents auto-link without user action. Medium-confidence routes to review queue. Low-confidence flags for manual intervention.

---

## Architecture

### End-to-End Flow

```
Portal Upload (POST /portal/:token/upload)
        ↓
1. Validate token & files (type, size, count)
2. Upload each file to R2 storage
3. Create RawImage record (status: UPLOADED)
4. Emit inngest.send() with document/uploaded event
5. Return response with aiProcessing: true
        ↓
Inngest Cloud receives event batch
        ↓
Match event to classifyDocumentJob function
        ↓
Execute durable job (3 retries, 10 req/min throttle)
        ↓
Durable Step 1: mark-processing
  └─ Update RawImage.status = PROCESSING
        ↓
Durable Step 2: fetch-image
  ├─ Generate signed URL (R2)
  ├─ Fetch image buffer via HTTP
  ├─ Base64 encode for step serialization
  └─ Return { buffer: base64, mimeType }
        ↓
Durable Step 3: classify
  ├─ Decode base64 buffer
  ├─ Call Gemini vision classification
  ├─ Extract { docType, confidence, reasoning }
  └─ Return classification result
        ↓
Durable Step 4: route-by-confidence
  ├─ If confidence < 60%:
  │  ├─ Update RawImage.status = UNCLASSIFIED
  │  └─ Create AI_FAILED action (NORMAL priority)
  ├─ If confidence >= 85%:
  │  ├─ Update RawImage.status = CLASSIFIED
  │  ├─ Call linkToChecklistItem()
  │  └─ Return { action: 'auto-linked', needsOcr: true/false }
  └─ If 60-85%:
     ├─ Update RawImage.status = CLASSIFIED
     ├─ Call linkToChecklistItem()
     ├─ Create VERIFY_DOCS action (NORMAL priority)
     └─ Return { action: 'needs-review', needsOcr: true/false }
        ↓
Durable Step 5: ocr-extract (conditional)
  ├─ If needsOcr && docType supports OCR:
  │  ├─ Decode base64 buffer
  │  ├─ Call extractDocumentData()
  │  ├─ Validate extracted JSON schema
  │  ├─ Call processOcrResultAtomic()
  │  │  ├─ Upsert DigitalDoc record
  │  │  ├─ Update ChecklistItem.status = HAS_DIGITAL
  │  │  ├─ Mark RawImage.status = LINKED
  │  │  └─ All in single transaction (ACID)
  │  └─ Return digitalDocId
  └─ Return undefined (no OCR)
        ↓
Return final result
  ├─ rawImageId, docType, confidence
  ├─ routing action (auto-linked|needs-review|unclassified)
  └─ digitalDocId (if OCR extracted)
```

---

## Job Configuration

### Inngest Job Definition

**File:** `apps/api/src/jobs/classify-document.ts`

```typescript
const classifyDocumentJob = inngest.createFunction(
  {
    id: 'classify-document',
    retries: 3,                                    // 3 automatic retries
    throttle: { limit: 10, period: '1m' },        // Max 10 jobs/min
  },
  { event: 'document/uploaded' },                 // Trigger event
  async ({ event, step }) => { ... }              // Handler function
)
```

**Configuration Details:**
- **ID:** Unique function identifier (`classify-document`)
- **Retries:** 3 automatic retries with exponential backoff
- **Throttle:** Rate limiting (10 req/min) protects Gemini API quota
- **Event Trigger:** Listens for `document/uploaded` events from portal
- **Durable Execution:** Each `step.run()` is independently retryable

### Event Schema

**Event Name:** `document/uploaded`

```typescript
{
  rawImageId: string        // Database record ID
  caseId: string            // Associated tax case
  r2Key: string             // S3/R2 object key (path)
  mimeType: string          // e.g., 'image/jpeg'
  uploadedAt: ISO8601       // Timestamp
}
```

### Portal Trigger

**Endpoint:** `POST /portal/:token/upload`

**Trigger Logic:**
```typescript
// For each uploaded file:
1. Upload to R2 storage
2. Create RawImage record
3. If Gemini configured:
     Add to inngestEvents array
4. If inngestEvents.length > 0:
     inngest.send(inngestEvents)  // Batch send
5. If no Gemini:
     Create VERIFY_DOCS action (manual classification fallback)
```

**Response:**
```json
{
  "uploaded": 2,
  "images": [
    {
      "id": "raw_xxx",
      "filename": "w2_2024.jpg",
      "status": "UPLOADED",
      "createdAt": "2026-01-14T21:15:00Z"
    }
  ],
  "aiProcessing": true,
  "message": "Đã nhận 2 file. Đang xử lý tự động..."
}
```

---

## Confidence Routing

### Thresholds & Actions

| Confidence | Status | Action | Priority | Notes |
|-----------|--------|--------|----------|-------|
| < 0.60 | UNCLASSIFIED | AI_FAILED | NORMAL | Manual review needed |
| 0.60-0.85 | CLASSIFIED | VERIFY_DOCS | NORMAL | Review classification |
| >= 0.85 | CLASSIFIED | (none) | - | Silent auto-link |

### Routing Rules

**UNCLASSIFIED (< 60%)**
- RawImage.status → UNCLASSIFIED
- RawImage.classifiedType → null
- Action created: AI_FAILED
- Action title: "Phân loại tự động thất bại"
- Description includes confidence % & reasoning
- No ChecklistItem linking
- No OCR extraction

**NEEDS_REVIEW (60-85%)**
- RawImage.status → CLASSIFIED
- RawImage.classifiedType → detected docType
- RawImage.aiConfidence → 0.60-0.85
- ChecklistItem auto-linked if found
- Action created: VERIFY_DOCS
- Action title: "Xác minh phân loại"
- Description: "{DocType}: Độ tin cậy {X}% - cần xác minh"
- OCR extraction triggers if docType supports it

**AUTO_LINKED (>= 85%)**
- RawImage.status → CLASSIFIED
- RawImage.classifiedType → detected docType
- RawImage.aiConfidence → 0.85-0.99+
- ChecklistItem auto-linked
- No action created (silent success)
- OCR extraction triggers if docType supports it

---

## Database Operations

### RawImage Status Lifecycle

```
UPLOADED (initial)
    ↓
PROCESSING (job starts)
    ↓
CLASSIFIED (classification success)
    ├─ OR UNCLASSIFIED (confidence < 60%)
    ├─ OR BLURRY (blur detection, future)
    │
    └─ [If OCR enabled]
       ↓
       LINKED (OCR complete)
```

### Confidence Metadata

```typescript
RawImage {
  classifiedType: DocType | null
  aiConfidence: float (0.0-1.0)
  classifiedAt: DateTime | null
  // Plus: r2Key, mimeType, filename, fileSize, uploadedVia
}
```

### Action Creation

```typescript
Action {
  caseId: string
  type: 'AI_FAILED' | 'VERIFY_DOCS'
  priority: 'NORMAL'
  title: Vietnamese title
  description: Details with confidence % & error
  metadata: {
    rawImageId,
    docType (if classified),
    confidence,
    errorMessage (if failed),
    r2Key,
    attemptedAt
  }
}
```

### Atomic Transaction (OCR Step)

When OCR extraction succeeds:

```typescript
// Single transaction - all or nothing
await prisma.$transaction(async (tx) => {
  // 1. Upsert DigitalDoc
  await tx.digitalDoc.upsert({
    where: { rawImageId },
    create: { /* new doc */ },
    update: { /* update existing */ }
  })

  // 2. Update ChecklistItem
  await tx.checklistItem.update({
    where: { id: checklistItemId },
    data: { status: 'HAS_DIGITAL', receivedCount: { increment: 1 } }
  })

  // 3. Mark RawImage linked
  await tx.rawImage.update({
    where: { id: rawImageId },
    data: { status: 'LINKED' }
  })
})
```

**Guarantees:**
- All 3 operations succeed together, or all fail together
- No partial states possible
- Prevents race conditions on concurrent uploads

---

## Service Layer

### Storage Service

**File:** `apps/api/src/services/storage.ts`

New function: `fetchImageBuffer(r2Key)`

```typescript
export async function fetchImageBuffer(r2Key: string): Promise<{
  buffer: Buffer
  mimeType: string
} | null> {
  // 1. Generate signed URL (1-hour expiry)
  const signedUrl = await getSignedDownloadUrl(r2Key)

  // 2. Fetch via HTTP
  const response = await fetch(signedUrl)

  // 3. Convert to Buffer
  const buffer = Buffer.from(await response.arrayBuffer())

  // 4. Extract MIME type from headers
  const mimeType = response.headers.get('content-type') || 'image/jpeg'

  return { buffer, mimeType }
}
```

**Usage in Job:**
```typescript
const imageData = await step.run('fetch-image', async () => {
  const result = await fetchImageBuffer(r2Key)
  return {
    buffer: result.buffer.toString('base64'),  // Serialize for durability
    mimeType: result.mimeType
  }
})
```

### Pipeline Helper Functions

**File:** `apps/api/src/services/ai/pipeline-helpers.ts`

**Key Functions:**

```typescript
// 1. Mark image as processing
async function markImageProcessing(rawImageId: string): Promise<void>

// 2. Update classification result
async function updateRawImageStatus(
  rawImageId: string,
  status: 'CLASSIFIED' | 'UNCLASSIFIED',
  confidence: number,
  docType?: DocType
): Promise<void>

// 3. Auto-link to checklist
async function linkToChecklistItem(
  rawImageId: string,
  caseId: string,
  docType: DocType
): Promise<string | null>  // Returns checklistItemId if found

// 4. Atomic OCR result processing
async function processOcrResultAtomic(params: {
  rawImageId: string
  caseId: string
  docType: DocType
  extractedData: Record<string, unknown>
  status: 'EXTRACTED' | 'PARTIAL' | 'FAILED'
  confidence: number
  checklistItemId?: string | null
}): Promise<string>  // Returns digitalDocId

// 5. Create action with metadata
async function createAction(params: {
  caseId: string
  type: ActionType
  priority: ActionPriority
  title: string
  description: string
  metadata: ActionMetadata
}): Promise<string>  // Returns actionId
```

---

## OCR Integration

### OCR Conditional Logic

OCR extraction only triggers if:

1. **Confidence >= 60%** - Successfully classified
2. **DocType supports OCR** - Check `requiresOcrExtraction(docType)`

**Currently Supported for OCR:**
- W2 (employment income)
- 1099-INT (interest income)
- 1099-NEC (contractor compensation)
- SSN_CARD (social security card)
- DRIVER_LICENSE (state ID)

**Future (Phase 3.1):**
- 1099-DIV (dividend income)
- 1099-K (payment card transactions)
- 1099-R (retirement distributions)

### OCR Extraction Function

**File:** `apps/api/src/services/ai/ocr-extractor.ts`

```typescript
export async function extractDocumentData(
  imageBuffer: Buffer,
  mimeType: string,
  docType: DocType
): Promise<OcrExtractionResult>
```

**Result Schema:**
```typescript
interface OcrExtractionResult {
  success: boolean
  docType: string
  extractedData: Record<string, unknown> | null
  confidence: number        // 0.5-0.99 (capped at 0.99)
  isValid: boolean          // Passes struct validation
  fieldLabels: Record<string, string>  // Vietnamese labels
  error?: string
  processingTimeMs?: number
}
```

**Confidence Calculation:**
- Base: 50% from key field completeness (50-90% range)
- Bonus: 10% from total field completeness (0-10% range)
- Total range: 0.5-0.99 (always leaves room for human review)

---

## Error Handling & Recovery

### Transient Errors (Auto-Retry)

Automatically retried up to 3 times with exponential backoff:

- Rate limit (429)
- Timeout (ECONNABORTED, ETIMEDOUT)
- Server errors (500, 502, 503)
- Temporary network issues

**Backoff Strategy:**
- Base delay: 1000ms (configurable via GEMINI_RETRY_DELAY_MS)
- Exponential: 1s → 2s → 4s
- Jitter applied by Inngest

**After 3 Retries:**
- Job fails
- AI_FAILED action created
- Staff notified

### Non-Transient Errors (No Retry)

Fail immediately without retry:

- Invalid image format/size
- Gemini API key missing
- Gemini misconfiguration
- Unsupported document type

**Action:** AI_FAILED created, staff handles manually

### Validation Errors (No Retry)

OCR success but data invalid:

- Confidence < 0.85
- Extracted data fails schema validation
- Key fields missing

**Action:** VERIFY_DOCS created for manual review

---

## Configuration & Deployment

### Environment Variables

**Production Required:**
```bash
INNGEST_SIGNING_KEY=<generated-by-inngest>  # Validates cloud requests
GEMINI_API_KEY=<api-key>                     # AI classification
R2_ACCOUNT_ID=<account-id>                   # Storage
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
```

**Optional (with defaults):**
```bash
GEMINI_MODEL=gemini-2.0-flash                # Default
GEMINI_MAX_RETRIES=3
GEMINI_RETRY_DELAY_MS=1000
```

### Inngest Production Readiness Check

```typescript
// In routes/inngest.ts
if (!config.inngest.isProductionReady) {
  console.error('[Inngest] SECURITY WARNING: INNGEST_SIGNING_KEY not set!')
  console.error('[Inngest] Background jobs DISABLED until signing key configured.')
}

// Route returns 503 if not ready
if (!config.inngest.isProductionReady) {
  return c.json({ error: 'Inngest not configured for production.' }, 503)
}
```

**Validation Rules:**
- Development: Signing key optional (console warning)
- Production: Signing key required (job execution blocked if missing)
- Local Testing: Can test with mock signing key

---

## Integration Points

### Workspace Action Queue

Classification jobs create actions that appear in staff dashboard:

- **AI_FAILED** - Unclassified or extraction error (High visibility)
- **VERIFY_DOCS** - Confidence 60-85% or OCR validation needed (Review queue)

Staff access via: `GET /actions` (grouped by priority)

### Portal Status Updates

Real-time checklist progress as images process:

```
Client views portal → /portal/:token
  ├─ Received: Classified + verified documents
  ├─ Blurry: Images that need resending
  └─ Missing: Still-needed documents
```

### Case Checklist Linking

Auto-linked documents reduce manual data entry:

```
Upload W2 image → Classify → Auto-link to W2 checklist item
                → Confidence >= 85% → No action needed
                → ChecklistItem.status = HAS_DIGITAL
                → Portal shows "W2 received ✓"
```

---

## Testing & Monitoring

### Local Development

1. Configure `.env` with test `GEMINI_API_KEY`
2. Start Inngest local dev server: `npx inngest-cli@latest dev`
3. Upload documents via portal
4. Inngest UI shows job execution: http://localhost:8288
5. Check database for:
   - RawImage records with status & confidence
   - DigitalDoc records with extracted data
   - Action records in appropriate queues
   - ChecklistItem linking

### Monitoring in Production

**Key Metrics:**
- Job success rate (target: >95%)
- Average processing time per image
- Classification confidence distribution
- OCR extraction success rate
- Gemini API throttle/rate-limit frequency

**Health Checks:**
```bash
# Verify Inngest is responding
curl https://<app>/api/inngest/health

# Check Gemini configuration
GET /health → Check aiConfigured flag
```

### Troubleshooting

**Jobs Not Triggering:**
- Check INNGEST_SIGNING_KEY is set
- Verify GEMINI_API_KEY configured
- Check inngest logs via Inngest UI

**Unclassified Documents Piling Up:**
- Review AI_FAILED actions metadata
- Check Gemini rate limits
- Inspect error messages in action.metadata.errorMessage

**OCR Not Extracting:**
- Verify docType supports OCR (5 types only)
- Check confidence >= 60%
- Inspect extraction errors in DigitalDoc

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Fetch from R2 | 0.2-0.5s | Network + signed URL generation |
| Gemini classification | 0.5-1.5s | Model inference |
| Gemini OCR extraction | 1-3s | Complex form parsing |
| Total per image | 2-5s | Sequential stages |
| Batch (3 parallel) | 6-15s | 3 images concurrent (throttled) |

**Optimization Notes:**
- Inngest throttle (10/min) prevents Gemini rate limits
- Batch sending reduces event overhead
- Base64 serialization adds ~30% size (necessary for durability)
- Signed URLs reduce R2 bandwidth costs

---

## Security Considerations

### Production Security

1. **Signing Key Required**
   - INNGEST_SIGNING_KEY validates all cloud requests
   - Job execution blocked in production without it
   - Prevents unauthorized job triggering

2. **Data in Transit**
   - R2 signed URLs expire in 1 hour
   - Fetch via HTTPS only
   - Base64 encoded in job steps (no secrets in logs)

3. **Gemini Privacy**
   - Image buffers never persisted locally
   - Extracted data stored in PostgreSQL only
   - Google doesn't retain API images (shared responsibility)

4. **Sensitive Data Handling**
   - No SSN/TIN logged anywhere
   - Action metadata sanitized before storage
   - Error messages don't leak file contents

---

## Future Enhancements

### Phase 3.1
- Multi-page PDF document support
- Form field cross-validation
- 1099-DIV, 1099-K, 1099-R OCR support

### Phase 3.2
- Real-time job progress notifications
- Job cancellation support
- Bulk re-classification for failed batches

### Phase 4.0
- ML model fine-tuning on tax documents
- Custom confidence thresholds per client
- Automated duplicate detection

---

## Related Documentation

- [System Architecture](./system-architecture.md#background-job-processing-inngest) - Job architecture
- [Phase 2.1 AI Services](./phase-2.1-ai-services.md) - Gemini client & pipeline details
- [Project Overview](./project-overview-pdr.md) - Feature roadmap
- [Code Standards](./code-standards.md) - Implementation patterns

---

**Last Updated:** 2026-01-14
**Status:** Production Ready
**Next Phase:** Phase 3.1 - Advanced OCR & Notifications
