# Phase 02 Quick Reference Guide

**Quick Links:** [Full Implementation](./phase-02-classification-job.md) | [Architecture](./system-architecture.md#ai-document-processing-pipeline-flow---phase-02-implementation)

---

## 5-Step Pipeline At a Glance

```typescript
// 1. mark-processing
RawImage.status = PROCESSING

// 2. fetch-image (R2 → Buffer)
const imageData = await fetchImageBuffer(r2Key)

// 3. classify (Gemini Vision)
const { docType, confidence } = await classifyDocument(buffer, mimeType)

// 4. route-by-confidence
if (confidence < 0.60) → UNCLASSIFIED, AI_FAILED action
if (confidence >= 0.85) → CLASSIFIED, auto-link, no action
if (0.60-0.85) → CLASSIFIED, auto-link, VERIFY_DOCS action

// 5. ocr-extract (if docType supports it)
const digitalDocId = await processOcrResultAtomic({ ... })
```

---

## Confidence Thresholds

| Range | Status | Action | Staff Involvement |
|-------|--------|--------|------------------|
| < 0.60 | UNCLASSIFIED | AI_FAILED | Manual classification |
| 0.60-0.85 | CLASSIFIED | VERIFY_DOCS | Review classification |
| ≥ 0.85 | CLASSIFIED | (none) | None (silent success) |

---

## Environment Setup

```bash
# Required for production
INNGEST_SIGNING_KEY=<from-inngest-dashboard>
GEMINI_API_KEY=<api-key>
R2_ACCOUNT_ID=<cloudflare-account>
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret>

# Optional (with defaults)
GEMINI_MODEL=gemini-2.0-flash
GEMINI_MAX_RETRIES=3
GEMINI_RETRY_DELAY_MS=1000
```

---

## File References

**Job:** `apps/api/src/jobs/classify-document.ts`
```typescript
export const classifyDocumentJob = inngest.createFunction({
  id: 'classify-document',
  retries: 3,
  throttle: { limit: 10, period: '1m' },  // Gemini rate limit
})
```

**Portal Trigger:** `apps/api/src/routes/portal/index.ts`
```typescript
POST /portal/:token/upload
→ Upload to R2
→ Create RawImage (status: UPLOADED)
→ inngest.send([{ name: 'document/uploaded', data: {...} }])
```

**Services:**
- Storage: `apps/api/src/services/storage.ts` (fetchImageBuffer)
- Pipeline: `apps/api/src/services/ai/pipeline-helpers.ts` (DB updates)
- OCR: `apps/api/src/services/ai/ocr-extractor.ts` (data extraction)

---

## Action Types Created

### AI_FAILED (Confidence < 60%)
```typescript
{
  type: 'AI_FAILED',
  priority: 'NORMAL',
  title: 'Phân loại tự động thất bại',
  description: `Không thể phân loại tài liệu (độ tin cậy: ${confidence}%)`
  metadata: {
    rawImageId,
    errorMessage,
    r2Key,
    attemptedAt
  }
}
```

### VERIFY_DOCS (60-85% or OCR validation)
```typescript
{
  type: 'VERIFY_DOCS',
  priority: 'NORMAL',
  title: 'Xác minh phân loại' or 'Xác minh dữ liệu OCR',
  description: `${docType}: Độ tin cậy ${confidence}% - cần xác minh`,
  metadata: {
    rawImageId,
    docType,
    confidence,
    checklistItemId
  }
}
```

---

## Supported OCR Document Types

✓ W2 - Employment income
✓ 1099-INT - Interest income
✓ 1099-NEC - Contractor compensation
✓ SSN_CARD - Social Security card
✓ DRIVER_LICENSE - State ID

Future: 1099-DIV, 1099-K, 1099-R (Phase 3.1)

---

## Database State After Job

```
RawImage
├─ status: CLASSIFIED | UNCLASSIFIED | PROCESSING
├─ classifiedType: W2 | 1099-NEC | null
└─ aiConfidence: 0.60-0.99

ChecklistItem (if linked)
├─ status: HAS_DIGITAL (if OCR extracted)
└─ receivedCount: incremented

DigitalDoc (if OCR extracted)
├─ docType: W2 | 1099-NEC | ...
├─ extractedData: { field1, field2, ... }
├─ confidence: 0.5-0.99
└─ status: EXTRACTED | PARTIAL | FAILED

Action (if created)
├─ type: AI_FAILED | VERIFY_DOCS
├─ priority: NORMAL
└─ metadata: job details
```

---

## Performance Metrics

| Operation | Duration | Notes |
|-----------|----------|-------|
| Fetch from R2 | 0.2-0.5s | Signed URL + HTTP fetch |
| Classification | 0.5-1.5s | Gemini vision model |
| OCR extraction | 1-3s | Form-specific prompt |
| **Total/image** | **2-5s** | Sequential steps |
| Batch (3 images) | 6-15s | Parallel via Inngest |

---

## Troubleshooting

**Jobs Not Processing?**
```bash
# Check Inngest signing key
echo $INNGEST_SIGNING_KEY

# Check Gemini key
echo $GEMINI_API_KEY

# Watch Inngest UI
# http://localhost:8288 (dev)
# https://app.inngest.com/ (prod)
```

**Unclassified Documents Increasing?**
→ Check AI_FAILED actions in workspace
→ Review error messages in action.metadata
→ Check Gemini API quota/billing

**No OCR Extraction?**
→ Verify confidence >= 0.60
→ Check docType in SUPPORTED_OCR_TYPES
→ Inspect OCR extraction step in Inngest UI

---

## Atomic Transaction Example

```typescript
// All 3 succeed together or all fail together
await prisma.$transaction(async (tx) => {
  // 1. Upsert DigitalDoc
  await tx.digitalDoc.upsert({ ... })

  // 2. Update ChecklistItem
  await tx.checklistItem.update({
    data: { status: 'HAS_DIGITAL' }
  })

  // 3. Mark RawImage linked
  await tx.rawImage.update({
    data: { status: 'LINKED' }
  })
})
```

---

## Production Safety Checklist

- [ ] INNGEST_SIGNING_KEY set (required)
- [ ] GEMINI_API_KEY configured
- [ ] R2 credentials all present
- [ ] Inngest dashboard monitored
- [ ] Database backups enabled
- [ ] Error logging configured
- [ ] Staff trained on action queue
- [ ] Test upload verified working

---

## Key Implementation Details

**Durable Execution:** Each `step.run()` independently retryable
**Rate Limiting:** 10 jobs/min protects Gemini quota
**Retry Strategy:** 3 retries on transient errors, exponential backoff
**Security:** Signing key validates Inngest cloud requests
**Atomicity:** DB transactions prevent partial states
**Serialization:** Base64 buffers for step durability

---

**For full details see:** [phase-02-classification-job.md](./phase-02-classification-job.md)
