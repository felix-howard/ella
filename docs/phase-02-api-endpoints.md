# Phase 02 API Endpoints - Data Entry & Field Verification

**Phase:** Phase 02 - Data Entry Workflow Infrastructure
**Status:** Complete & Production-Ready
**Date:** 2026-01-15
**Branch:** feature/enhancement

---

## Overview

Phase 02 introduces 4 critical API endpoints for the data entry workflow, enabling field-level verification, clipboard tracking, document entry completion, and re-upload request handling. These endpoints support the OltPro data entry workflow with atomic transactions, XSS sanitization, and comprehensive validation.

## API Endpoints

### 1. POST /docs/:id/verify-field

**Purpose:** Verify a single field in extracted document data

**Location:** `apps/api/src/routes/docs/index.ts` (line 401)

**Request Body:**
```typescript
{
  field: string              // Field name to verify (e.g., "wages", "ssn")
  status: string            // Verification status: "verified" | "edited" | "unreadable"
  value?: unknown           // New value if status === "edited"
}
```

**Response (Success - 200):**
```typescript
{
  success: true,
  fieldVerifications: {
    [fieldName: string]: "verified" | "edited" | "unreadable"
  }
}
```

**Response (Errors):**
- `404 NOT_FOUND` - Document not found
- `400 INVALID_FIELD` - Field not in whitelist for document type

**Key Features:**
- **Field Whitelist Validation** - Uses `isValidDocField()` to prevent JSON injection
- **Atomic Transaction** - All-or-nothing field update via Prisma transaction
- **Merge Behavior** - Preserves existing field verifications (doesn't overwrite)
- **Value Update** - Optionally updates `extractedData[field]` if `status === "edited"`

**Security:**
- Field names validated against VALID_DOC_FIELDS whitelist per document type
- Prevents arbitrary JSON column injection
- Race condition prevention via transaction lock

**Database Updates:**
- Updates `DigitalDoc.fieldVerifications` JSON column
- Updates `DigitalDoc.extractedData` if field value edited

**Example Usage:**
```typescript
// Verify W2 wages field as correct
const response = await fetch('/docs/doc123/verify-field', {
  method: 'POST',
  body: JSON.stringify({
    field: 'wages',
    status: 'verified'
  })
})

// Edit 1099-NEC compensation value
const response = await fetch('/docs/doc456/verify-field', {
  method: 'POST',
  body: JSON.stringify({
    field: 'nonemployeeCompensation',
    status: 'edited',
    value: 45000
  })
})

// Mark SSN field as unreadable (document quality issue)
const response = await fetch('/docs/doc789/verify-field', {
  method: 'POST',
  body: JSON.stringify({
    field: 'ssn',
    status: 'unreadable'
  })
})
```

**Validation Schemas:**
```typescript
export const verifyFieldSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  status: z.enum(['verified', 'edited', 'unreadable']),
  value: z.unknown().optional(),
})
```

---

### 2. POST /docs/:id/mark-copied

**Purpose:** Track when a field is copied to clipboard for OltPro workflow

**Location:** `apps/api/src/routes/docs/index.ts` (line 451)

**Request Body:**
```typescript
{
  field: string    // Field name that was copied (e.g., "wages", "employerName")
}
```

**Response (Success - 200):**
```typescript
{
  success: true,
  copiedFields: {
    [fieldName: string]: true
  }
}
```

**Response (Errors):**
- `404 NOT_FOUND` - Document not found
- `400 INVALID_FIELD` - Field not in whitelist for document type

**Key Features:**
- **Copy Tracking** - Accumulates which fields have been copied
- **Atomic Transaction** - Prevents race conditions during copy
- **Field Whitelist Validation** - Same security as verify-field endpoint
- **Accumulation** - Preserves existing copiedFields tracking

**Security:**
- Field names validated against VALID_DOC_FIELDS whitelist
- Prevents tracking of non-existent/invalid fields
- Race condition prevention via transaction

**Database Updates:**
- Updates `DigitalDoc.copiedFields` JSON column
- Marks field as `true` once copied (audit trail)

**Example Usage:**
```typescript
// Track W2 wages field copied to clipboard
const response = await fetch('/docs/doc123/mark-copied', {
  method: 'POST',
  body: JSON.stringify({
    field: 'wages'
  })
})

// Track multiple fields copied during data entry
const fields = ['employerName', 'wages', 'federalWithholding']
for (const field of fields) {
  await fetch(`/docs/doc123/mark-copied`, {
    method: 'POST',
    body: JSON.stringify({ field })
  })
}
```

**Validation Schemas:**
```typescript
export const markCopiedSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
})
```

**Frontend Integration:**
- Called from `apps/workspace/src/hooks/use-clipboard.ts` when field copied
- Enables audit trail for data entry productivity metrics
- Supports OltPro keyboard workflow (Enter key = copy field)

---

### 3. POST /docs/:id/complete-entry

**Purpose:** Mark document data entry as complete

**Location:** `apps/api/src/routes/docs/index.ts` (line 492)

**Request Body:**
```typescript
{
  // No required body fields
}
```

**Response (Success - 200):**
```typescript
{
  success: true,
  message: "Entry marked complete"
}
```

**Response (Errors):**
- `404 NOT_FOUND` - Document not found

**Key Features:**
- **Simple Status Flag** - Sets `entryCompleted = true`
- **Timestamp Tracking** - Records `entryCompletedAt` for audit trail
- **No Validation** - Staff can mark complete at any point
- **Idempotent** - Safe to call multiple times (sets same value)

**Database Updates:**
- Sets `DigitalDoc.entryCompleted = true`
- Sets `DigitalDoc.entryCompletedAt = new Date()`

**Business Logic:**
- Staff completes data entry form for document
- Marks document as "entry complete" for case progression
- Enables case-level completion tracking (total documents vs completed)
- Triggers case status transition logic

**Example Usage:**
```typescript
// Mark W2 document entry as complete after staff finishes data entry
const response = await fetch('/docs/doc123/complete-entry', {
  method: 'POST',
  body: JSON.stringify({})
})

// Response indicates success
// Client can now move to next document or complete case
```

**Validation Schemas:**
```typescript
export const completeEntrySchema = z.object({})
```

**Frontend Integration:**
- Called from data entry completion button in workspace
- Part of OltPro workflow: extract data → verify fields → copy fields → complete entry

---

### 4. POST /images/:id/request-reupload

**Purpose:** Request client re-upload of blurry/unreadable document with SMS notification

**Location:** `apps/api/src/routes/images/index.ts` (line 332)

**Request Body:**
```typescript
{
  reason: string           // Human-readable reason (e.g., "Image too blurry")
  fields: string[]        // Array of unreadable field names
  sendSms: boolean        // Whether to send SMS notification (default: true)
}
```

**Response (Success - 200):**
```typescript
{
  success: true,
  image: {
    id: string,
    reuploadRequested: true,
    reuploadRequestedAt: "2026-01-15T10:30:00Z",
    reuploadReason: "Image too blurry, wages field unreadable",
    reuploadFields: ["wages", "federalWithholding"],
    status: "BLURRY"
    // ... other RawImage fields
  }
}
```

**Response (Errors):**
- `404 NOT_FOUND` - Image not found

**Key Features:**
- **Atomic Transaction** - Updates image + creates action in single transaction
- **XSS Sanitization** - `sanitizeReuploadReason()` removes HTML/control chars
- **Action Creation** - Creates HIGH priority `BLURRY_DETECTED` action
- **SMS Notification** - Optional SMS to client via Twilio (outside transaction)
- **Status Update** - Sets `RawImage.status = "BLURRY"`
- **Field Tracking** - Records which fields triggered reupload request

**Security:**
- `sanitizeReuploadReason()` removes HTML tags, control characters, limits to 500 chars
- Prevents XSS via stored JSON metadata
- Field names not validated (can be any string from staff)

**Database Updates - Transaction:**
- `RawImage.reuploadRequested = true`
- `RawImage.reuploadRequestedAt = new Date()`
- `RawImage.reuploadReason = sanitized reason`
- `RawImage.reuploadFields = [array of field names]`
- `RawImage.status = "BLURRY"`
- Creates `Action` record (type: "BLURRY_DETECTED", priority: "HIGH")

**SMS Notification:**
- Only sent if `sendSms === true` AND SMS configured AND client has active magic link
- Uses `sendBlurryResendRequest()` from SMS service
- Includes portal URL with magic link token
- Sent outside transaction (fire-and-forget)

**Database Updates - SMS Side Effect:**
- Creates `Message` record in SMS channel if sent
- `TaxCase.lastContactAt` updated

**Example Usage:**
```typescript
// Request re-upload for blurry W2 image
const response = await fetch('/images/rawImage789/request-reupload', {
  method: 'POST',
  body: JSON.stringify({
    reason: "Image is too blurry to read wages and tax fields",
    fields: ["wages", "federalWithholding", "socialSecurityWages"],
    sendSms: true
  })
})

// Response includes re-upload tracking and SMS status
// Action created for staff to follow up if image not resubmitted

// Request re-upload without SMS
const response = await fetch('/images/rawImage456/request-reupload', {
  method: 'POST',
  body: JSON.stringify({
    reason: "Glare on image obscures key information",
    fields: ["employerAddress"],
    sendSms: false
  })
})
```

**Validation Schemas:**
```typescript
const requestReuploadSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  fields: z.array(z.string()).min(1, 'At least one field is required'),
  sendSms: z.boolean().default(true),
})
```

**Action Metadata:**
```typescript
metadata: {
  rawImageId: string,
  docType: string | null,
  reason: string,              // Sanitized
  fields: string[]
}
```

**Frontend Integration:**
- Called from workspace UI when staff reviews unreadable document
- Includes document type label in action description (Vietnamese)
- SMS template: "blurry-resend.ts" in SMS service

**Error Handling:**
- Image not found → 404 response
- SMS send failure → Logged but doesn't fail request (fire-and-forget)

---

## Field Whitelist Validation

### Document Type Field Whitelists

All 4 endpoints use the same field whitelist validation via `isValidDocField(docType, fieldName)` defined in `apps/api/src/lib/validation.ts`.

**W2 Fields (24 fields):**
```
employerName, employerEIN, employerAddress,
employeeName, employeeSSN, employeeAddress,
wages, federalWithholding, socialSecurityWages,
socialSecurityTax, medicareWages, medicareTax,
socialSecurityTips, allocatedTips, dependentCareBenefits,
nonqualifiedPlans, box12a, box12b, box12c, box12d,
statutory, retirementPlan, thirdPartySickPay,
state, stateId, stateWages, stateTax,
localWages, localTax, localityName
```

**FORM_1099_INT Fields (19 fields):**
```
payerName, payerTIN, payerAddress,
recipientName, recipientTIN, recipientAddress,
interestIncome, earlyWithdrawalPenalty, usSavingsBonds,
federalTaxWithheld, investmentExpenses, foreignTaxPaid,
foreignCountry, taxExemptInterest, privateBondInterest,
marketDiscount, bondPremium, bondPremiumTreasury,
bondPremiumTaxExempt, cusipNumber, state, stateId, stateTaxWithheld
```

**FORM_1099_NEC Fields (8 fields):**
```
payerName, payerTIN, payerAddress,
recipientName, recipientTIN, recipientAddress,
nonemployeeCompensation, payerMadeDirectSales,
federalTaxWithheld, state, stateId, stateIncome, stateTaxWithheld
```

**SSN_CARD Fields (3 fields):**
```
name, ssn, cardType
```

**DRIVER_LICENSE Fields (13 fields):**
```
fullName, firstName, lastName, middleName,
dateOfBirth, address, city, state, zipCode,
licenseNumber, expirationDate, issueDate,
sex, height, eyeColor, documentDiscriminator
```

**OTHER/UNKNOWN Document Types (2 fields):**
```
rawText, notes
```

### Whitelist Validation Function

```typescript
export function isValidDocField(docType: string | null, fieldName: string): boolean {
  if (!docType) return false

  const validFields = VALID_DOC_FIELDS[docType]
  if (!validFields) {
    // For unsupported doc types, only allow generic fields
    return VALID_DOC_FIELDS.OTHER.includes(fieldName)
  }

  return validFields.includes(fieldName)
}
```

**Security Impact:**
- Prevents JSON injection attacks via extracted data
- Staff cannot add arbitrary fields to DigitalDoc.extractedData
- Maintains schema consistency across all documents
- Enables safe type-safe data operations

---

## Data Models - Database Schema

### DigitalDoc Model (Phase 01-B Updates)

```prisma
model DigitalDoc {
  // ... existing fields ...

  // Phase 01-B: Field verification tracking
  fieldVerifications    Json?     // { "field": "verified|edited|unreadable" }
  copiedFields          Json?     // { "field": true } - which fields copied
  entryCompleted        Boolean   @default(false)
  entryCompletedAt      DateTime?

  // Indexes for efficient queries
  @@index([entryCompleted])
  @@index([caseId, entryCompleted])
}
```

### RawImage Model (Phase 01-B Updates)

```prisma
model RawImage {
  // ... existing fields ...

  // Phase 01-B: Re-upload request tracking
  reuploadRequested     Boolean   @default(false)
  reuploadRequestedAt   DateTime?
  reuploadReason        String?
  reuploadFields        String[]  // Array of field names needing re-upload

  // Indexes for efficient queries
  @@index([reuploadRequested])
  @@index([caseId, reuploadRequested])
}
```

---

## Security Considerations

### 1. Field Whitelist Validation (All Endpoints)

**Threat:** Mass assignment / JSON injection via arbitrary field names
**Mitigation:** `isValidDocField()` validates against per-docType whitelist
**Implementation:** Checked in all 4 endpoints before database update
**Coverage:** 80+ fields across 5 document types

### 2. XSS Prevention (request-reupload)

**Threat:** HTML/JavaScript injection via reupload reason
**Mitigation:** `sanitizeReuploadReason()` removes HTML tags, control chars, limits to 500 chars
**Implementation:**
```typescript
function sanitizeTextInput(input: string, maxLength = 500): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<[^>]*>/g, '')                    // Remove HTML tags
    .replace(/[<>]/g, '')                       // Remove angle brackets
    .replace(/[\u0000-\u001F\u007F]/g, '')      // Remove control chars
}
```

### 3. Race Conditions (verify-field, mark-copied, request-reupload)

**Threat:** Concurrent updates causing lost writes or inconsistent state
**Mitigation:** Prisma atomic transactions (`prisma.$transaction`)
**Implementation:**
```typescript
const result = await prisma.$transaction(async (tx) => {
  // Read → validate → write all in single transaction
  const doc = await tx.digitalDoc.findUnique({ where: { id } })
  // ... validation ...
  await tx.digitalDoc.update({ ... })
})
```

### 4. Data Disclosure (request-reupload)

**Threat:** Revealing sensitive info in action descriptions
**Mitigation:** Sanitized reason + generic field names only
**Implementation:** Action metadata contains sanitized values only

---

## Atomic Transactions

### verify-field Atomicity

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Fetch current state
  const doc = await tx.digitalDoc.findUnique({ where: { id } })

  // 2. Validate field
  if (!isValidDocField(doc.docType, field)) throw error

  // 3. Merge and update
  const fieldVerifications = { ...doc.fieldVerifications, [field]: status }
  if (status === 'edited' && value !== undefined) {
    extractedData[field] = value
  }

  // 4. Persist atomically
  await tx.digitalDoc.update({ data: { fieldVerifications, extractedData } })
})
```

**Guarantee:** Field verification applied entirely or not at all

### mark-copied Atomicity

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Fetch current state
  const doc = await tx.digitalDoc.findUnique({ where: { id } })

  // 2. Validate field
  if (!isValidDocField(doc.docType, field)) throw error

  // 3. Merge and update
  const copiedFields = { ...doc.copiedFields, [field]: true }

  // 4. Persist atomically
  await tx.digitalDoc.update({ data: { copiedFields } })
})
```

**Guarantee:** Copy tracking applied entirely or not at all

### request-reupload Atomicity

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Fetch image with case/client info
  const image = await tx.rawImage.findUnique({ where: { id }, include: { taxCase: {...} } })

  // 2. Update image status + metadata
  await tx.rawImage.update({
    data: {
      reuploadRequested: true,
      reuploadRequestedAt: new Date(),
      reuploadReason: sanitized,
      reuploadFields: fields,
      status: 'BLURRY'
    }
  })

  // 3. Create action for staff follow-up
  await tx.action.create({
    data: { caseId, type: 'BLURRY_DETECTED', ... }
  })
})
// 4. SMS sent outside transaction (if fails, doesn't rollback DB updates)
```

**Guarantee:** Image status + action created together or both rolled back

---

## Validation Schemas

All endpoints defined in `apps/api/src/routes/docs/schemas.ts`:

```typescript
export const verifyFieldSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  status: z.enum(['verified', 'edited', 'unreadable']),
  value: z.unknown().optional(),
})

export const markCopiedSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
})

export const completeEntrySchema = z.object({})

// In apps/api/src/routes/images/index.ts:
const requestReuploadSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  fields: z.array(z.string()).min(1, 'At least one field is required'),
  sendSms: z.boolean().default(true),
})
```

---

## Client Integration (Frontend API Client)

### Method Additions to `apps/workspace/src/lib/api-client.ts`

```typescript
// Digital Document Operations
export const docs = {
  // Verify single field
  verifyField: async (docId: string, payload: {
    field: string,
    status: 'verified' | 'edited' | 'unreadable',
    value?: unknown
  }) => {
    return apiRequest(
      'POST',
      `/docs/${docId}/verify-field`,
      payload
    )
  },

  // Track field copied
  markCopied: async (docId: string, field: string) => {
    return apiRequest(
      'POST',
      `/docs/${docId}/mark-copied`,
      { field }
    )
  },

  // Mark document entry complete
  completeEntry: async (docId: string) => {
    return apiRequest(
      'POST',
      `/docs/${docId}/complete-entry`,
      {}
    )
  },
}

// Raw Image Operations
export const images = {
  // Request re-upload with optional SMS
  requestReupload: async (imageId: string, payload: {
    reason: string,
    fields: string[],
    sendSms?: boolean
  }) => {
    return apiRequest(
      'POST',
      `/images/${imageId}/request-reupload`,
      payload
    )
  },
}
```

---

## Error Handling

### Error Response Format

```typescript
{
  error: "ERROR_CODE",      // Machine-readable error code
  message: "Human-readable error message"
}
```

### HTTP Status Codes

| Status | Scenario | Endpoints |
|--------|----------|-----------|
| 200 | Successful operation | All |
| 400 | Bad request / Validation failed | verify-field, mark-copied, request-reupload |
| 404 | Resource not found | All |
| 500 | Server error (rare) | All |

### Error Codes

| Code | Meaning | Endpoints |
|------|---------|-----------|
| NOT_FOUND | Document/image not found | All |
| INVALID_FIELD | Field not in whitelist | verify-field, mark-copied |

---

## Performance Considerations

### Transaction Overhead

- **verify-field:** 2 database queries (find + update) in transaction
- **mark-copied:** 2 database queries (find + update) in transaction
- **complete-entry:** 1 database query (update only)
- **request-reupload:** 3 database queries (find + update + create) in transaction, SMS outside

### Query Optimization

- Use indexes on frequently queried fields:
  - `DigitalDoc`: `@@index([entryCompleted])`, `@@index([caseId, entryCompleted])`
  - `RawImage`: `@@index([reuploadRequested])`, `@@index([caseId, reuploadRequested])`

### Batch Operations

For efficiency, batch field verifications:

```typescript
// Instead of:
await docs.verifyField(docId, { field: 'wages', status: 'verified' })
await docs.verifyField(docId, { field: 'tax', status: 'verified' })

// Ideal: Single endpoint accepting multiple fields
// (Not yet implemented - consider for Phase 03)
```

---

## Testing

### Test Files

- `apps/api/src/services/ai/__tests__/document-classifier.test.ts` (Phase 06)
- `apps/api/src/jobs/__tests__/classify-document.test.ts` (Phase 06)

### Test Coverage Areas

1. **Field Validation** - Whitelist enforcement
2. **Atomicity** - Transaction success/rollback
3. **XSS Prevention** - Reason sanitization
4. **Error Handling** - 404, 400 responses
5. **Idempotency** - Multiple calls same result

---

## Related Documentation

- **Phase 01-B Schema:** `./codebase-summary.md#phase-01-document-tab-ux-redesign`
- **AI Services:** `./phase-2.1-ai-services.md`
- **Classification Job:** `./phase-02-classification-job.md`
- **Quick Reference:** `./phase-02-quick-reference.md`

---

## Deployment Checklist

- [ ] API endpoints tested in development environment
- [ ] Field whitelist comprehensive for all supported document types
- [ ] XSS sanitization verified for reupload reason field
- [ ] Transaction error handling in place
- [ ] SMS configuration verified (if using reupload SMS)
- [ ] Database indexes created for efficient queries
- [ ] Frontend API client methods integrated
- [ ] Error handling UI in workspace implemented
- [ ] Staff trained on data entry workflow
- [ ] Monitoring configured for endpoint usage

---

---

## Health Endpoint Response (Phase 03 Update)

### GET /health Response Schema

**Location:** `apps/api/src/routes/health.ts`

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-16T12:00:00.000Z",
  "gemini": {
    "configured": true,
    "model": "gemini-2.0-flash",
    "activeModel": "gemini-2.0-flash",
    "fallbackModels": ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
    "available": true,
    "checkedAt": "2026-01-16T12:00:00.000Z",
    "error": null,
    "maxRetries": 3,
    "maxImageSizeMB": 10
  }
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always "ok" on successful response |
| `timestamp` | ISO8601 | Current server time (UTC) |
| `gemini.configured` | boolean | API key present (true/false) |
| `gemini.model` | string | Primary model from env (e.g., gemini-2.0-flash) |
| `gemini.activeModel` | string | **Phase 03**: Currently working model (may differ from primary if fallback active) |
| `gemini.fallbackModels` | string[] | **Phase 03**: List of fallback models in order |
| `gemini.available` | boolean | Model validation passed during startup |
| `gemini.checkedAt` | ISO8601 &#124; null | Last validation timestamp (null if never checked) |
| `gemini.error` | string &#124; null | Validation error message if available=false |
| `gemini.maxRetries` | number | Max retry attempts per model from config |
| `gemini.maxImageSizeMB` | number | Max image size in MB (10) |

**Phase 03 Changes:**
- Added `activeModel` field to show current working model after fallback
- Added `fallbackModels[]` array to expose fallback chain configuration
- Model fallback auto-activates on 404 errors, cached for session

**Usage:** Monitor health endpoint to detect when primary model becomes unavailable. If `activeModel` != `model`, a fallback is in use.

---

---

## Draft Return Sharing Phase 02 API Endpoints

**Phase:** Phase 02 - Draft Return Sharing & Portal Distribution
**Status:** Complete & Production-Ready
**Date:** 2026-02-23
**Branch:** dev

### Overview

Phase 02 adds 6 API endpoints for draft tax return upload, management, and client sharing. Enables staff to upload PDF returns, share with clients via magic links, track views, and manage link lifecycle.

### Workspace Endpoints (Authenticated)

#### 1. POST /draft-returns/:caseId/upload

**Purpose:** Upload PDF and create draft return with magic link

**Location:** `apps/api/src/routes/draft-returns/index.ts` (line 45)

**Request:** Multipart form with PDF file
```typescript
{
  file: File  // PDF file (application/pdf)
}
```

**Response (Success - 200):**
```typescript
{
  draftReturn: {
    id: string,
    version: number,
    filename: string,
    fileSize: number,
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUPERSEDED',
    viewCount: number,
    lastViewedAt: string | null,    // ISO8601
    uploadedAt: string,              // ISO8601
    uploadedBy: { id: string, name: string }
  },
  magicLink: {
    token: string,
    url: string,
    expiresAt: string | null,       // 14 days from now
    isActive: boolean,
    usageCount: number,
    lastUsedAt: string | null
  },
  portalUrl: string                  // Full portal URL
}
```

**Response (Errors):**
- `404 NOT_FOUND` - Case not found or no access
- `400 NO_FILE` - No PDF provided
- `400 INVALID_TYPE` - File is not PDF
- `400 FILE_TOO_LARGE` - Exceeds 50MB limit
- `400 INVALID_PDF` - File lacks PDF magic bytes

**Key Features:**
- **Version Tracking** - Auto-increments version number per case
- **Superseding** - Marks previous active versions as SUPERSEDED
- **Magic Link Creation** - 14-day TTL (extend-able)
- **R2 Upload** - Atomic transaction + file upload
- **Link Deactivation** - Deactivates old magic links
- **Filename Sanitization** - Prevents path traversal & XSS

**Security:**
- Filename sanitized: removes path separators, control chars, length limited to 255
- PDF validation: magic bytes check (0x25504446 = "%PDF")
- File size: max 50MB (prevents DoS)
- Org-scoped: buildNestedClientScope validates case ownership
- Transaction-based: version superseding atomic

**Database Updates (Transacted):**
- Increments version counter (find latest version → +1)
- Sets previous ACTIVE versions → SUPERSEDED
- Creates DraftReturn record (r2Key, filename, fileSize, version, uploadedById, status)
- Creates MagicLink record (type: DRAFT_RETURN, expiresAt: +14 days, isActive: true)

**Example Usage:**
```typescript
const formData = new FormData()
formData.append('file', pdfFile)
const response = await fetch('/draft-returns/case123/upload', {
  method: 'POST',
  body: formData,
  headers: { 'Authorization': 'Bearer ...' }
})
const { draftReturn, magicLink, portalUrl } = await response.json()
// Share portalUrl with client
```

**Validation Schemas:**
- MIME type: application/pdf
- Max size: 50MB
- PDF magic bytes: [0x25, 0x50, 0x44, 0x46]

---

#### 2. GET /draft-returns/:caseId

**Purpose:** Get current draft return and link status with version history

**Location:** `apps/api/src/routes/draft-returns/index.ts` (line 182)

**Request:** None

**Response (Success - 200):**
```typescript
{
  draftReturn: {
    id: string,
    version: number,
    filename: string,
    fileSize: number,
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUPERSEDED',
    viewCount: number,
    lastViewedAt: string | null,
    uploadedAt: string,
    uploadedBy: { id: string, name: string }
  } | null,
  magicLink: {
    token: string,
    url: string,
    expiresAt: string | null,
    isActive: boolean,
    usageCount: number,
    lastUsedAt: string | null
  } | null,
  versions: Array<{
    version: number,
    uploadedAt: string,
    status: string
  }>
}
```

**Response (Errors):**
- `404 NOT_FOUND` - Case not found or no access

**Key Features:**
- **Active Draft Only** - Returns only ACTIVE status draft, not historical versions
- **Version History** - All versions (including SUPERSEDED) for admin UI
- **Link Status** - Current active magic link with expiry
- **View Tracking** - viewCount + lastViewedAt from portal access

**Database Queries:**
- SELECT draftReturn WHERE status=ACTIVE ORDER BY version DESC (limit 1)
- SELECT magicLink WHERE draftReturnId=? AND isActive=true
- SELECT ALL draftReturns WHERE taxCaseId=? ORDER BY version DESC

**Example Usage:**
```typescript
const response = await fetch('/draft-returns/case123', {
  headers: { 'Authorization': 'Bearer ...' }
})
const { draftReturn, magicLink, versions } = await response.json()
// draftReturn = null if not yet uploaded
// magicLink = current sharing link (check expiresAt for expiry)
// versions = full history for audit trail
```

---

#### 3. POST /draft-returns/:id/revoke

**Purpose:** Revoke draft return link (prevents client access)

**Location:** `apps/api/src/routes/draft-returns/index.ts` (line 258)

**Request Body:** None

**Response (Success - 200):**
```typescript
{ success: true }
```

**Response (Errors):**
- `404 NOT_FOUND` - Draft not found or no access

**Key Features:**
- **Status Update** - Sets status → REVOKED
- **Link Deactivation** - Sets all active magic links → isActive=false
- **Transaction-Based** - Both updates atomic
- **Prevents Access** - Portal rejects revoked links

**Database Updates (Transacted):**
- UPDATE draftReturn SET status='REVOKED' WHERE id=?
- UPDATE magicLink SET isActive=false WHERE draftReturnId=? AND isActive=true

**Example Usage:**
```typescript
const response = await fetch('/draft-returns/draft-123/revoke', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ...' }
})
// Client can no longer access the draft via magic link
// Portal returns: { error: 'LINK_REVOKED', message: '...' }
```

---

#### 4. POST /draft-returns/:id/extend

**Purpose:** Extend magic link expiry by 14 days

**Location:** `apps/api/src/routes/draft-returns/index.ts` (line 301)

**Request Body:** None

**Response (Success - 200):**
```typescript
{
  success: true,
  expiresAt: string  // ISO8601, now + 14 days
}
```

**Response (Errors):**
- `404 NOT_FOUND` - Draft not found or no access
- `400 NO_ACTIVE_LINK` - No active link to extend

**Key Features:**
- **14-Day Extension** - Always adds exactly 14 days from now
- **Active Link Only** - Only extends if link is isActive=true
- **Transaction-Safe** - Prevents race conditions
- **Current Time-Based** - Uses `Date.now()` to prevent clock skew

**Database Updates (Transacted):**
- FIND magicLink WHERE draftReturnId=? AND isActive=true
- UPDATE magicLink SET expiresAt=(now + 14 days) WHERE id=?

**Example Usage:**
```typescript
const response = await fetch('/draft-returns/draft-123/extend', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ...' }
})
const { success, expiresAt } = await response.json()
// expiresAt = 14 days from now
// Client can now access for another 14 days
```

---

### Portal Endpoints (Public)

#### 5. GET /portal/draft/:token

**Purpose:** Validate token and return draft data with signed PDF URL

**Location:** `apps/api/src/routes/portal/draft.ts` (line 15)

**Request:** None

**Response (Success - 200):**
```typescript
{
  clientName: string,
  clientLanguage: 'EN' | 'VI',
  taxYear: number,
  version: number,
  filename: string,
  uploadedAt: string,          // ISO8601
  pdfUrl: string               // Signed R2 URL (15 min TTL)
}
```

**Response (Errors):**
- `401 INVALID_TOKEN` - Token not found
- `401 INVALID_TOKEN_TYPE` - Token is not DRAFT_RETURN type
- `401 LINK_REVOKED` - Staff revoked the link
- `401 LINK_EXPIRED` - Link expiry date passed
- `404 DRAFT_NOT_FOUND` - Associated draft not found
- `500 PDF_UNAVAILABLE` - R2 signed URL generation failed

**Key Features:**
- **Token Validation** - Checks existence, type, active status, expiry
- **R2 Signed URL** - 15-minute expiry (prevents URL sharing)
- **Link Usage Tracking** - Updates lastUsedAt + increments usageCount
- **Client Context** - Returns client name/language for portal UI
- **No Authentication** - Public endpoint (token = auth)

**Validation Flow:**
1. Find magicLink by token
2. Verify type=DRAFT_RETURN
3. Verify isActive=true
4. Verify expiresAt > now
5. Generate signed PDF URL
6. Update usage stats
7. Return draft data + pdfUrl

**Example Usage:**
```typescript
// Client clicks magic link: /draft/abc123token
const response = await fetch('/portal/draft/abc123token')
const { clientName, pdfUrl, taxYear } = await response.json()
// Portal fetches PDF from pdfUrl (browser download)
// Portal calls POST /portal/draft/:token/viewed
```

---

#### 6. POST /portal/draft/:token/viewed

**Purpose:** Track when client views the PDF (increments viewCount)

**Location:** `apps/api/src/routes/portal/draft.ts` (line 80)

**Request Body:** None

**Response (Success - 200):**
```typescript
{ success: true }
```

**Response (Errors):**
- `400` - Token invalid or not active

**Key Features:**
- **View Counting** - Increments DraftReturn.viewCount
- **Timestamp** - Sets lastViewedAt to current time
- **Fire & Forget** - Client-side tracking (portal calls on PDF load)
- **No Validation Error** - Returns 400 on any error (no detailed messages for security)

**Database Updates:**
- UPDATE draftReturn SET viewCount=viewCount+1, lastViewedAt=now WHERE id=?

**Example Usage:**
```typescript
// Portal PDF viewer loaded successfully
const response = await fetch('/portal/draft/abc123token/viewed', {
  method: 'POST'
})
// Don't wait for response (fire & forget)
// Staff sees updated viewCount in GET /draft-returns/:caseId
```

---

### Data Models - Database Schema (Phase 02 Additions)

**DraftReturn Model:**
```prisma
model DraftReturn {
  id            String   @id @default(cuid())
  taxCaseId     String   // FK to TaxCase (cascade delete)
  r2Key         String   @unique  // Storage path
  filename      String   // Sanitized filename
  fileSize      Int      // Bytes
  version       Int      // Auto-increment per case
  status        String   @default("ACTIVE")  // ACTIVE|REVOKED|EXPIRED|SUPERSEDED
  uploadedById  String   // FK to Staff
  uploadedBy    Staff    @relation(fields: [uploadedById], references: [id], onDelete: Restrict)
  viewCount     Int      @default(0)
  lastViewedAt  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  taxCase    TaxCase      @relation(fields: [taxCaseId], references: [id], onDelete: Cascade)
  magicLinks MagicLink[]

  // Indexes
  @@index([taxCaseId])
  @@index([taxCaseId, status])
  @@unique([taxCaseId, version])
}
```

**MagicLink Model (DRAFT_RETURN Type):**
```prisma
model MagicLink {
  id              String       @id @default(cuid())
  token           String       @unique
  type            String       // PORTAL|SCHEDULE_C|SCHEDULE_E|DRAFT_RETURN
  caseId          String       // FK to TaxCase
  draftReturnId   String?      // FK to DraftReturn (for DRAFT_RETURN type)
  expiresAt       DateTime?    // null = never expires, 14 days default for DRAFT_RETURN
  isActive        Boolean      @default(true)
  usageCount      Int          @default(0)
  lastUsedAt      DateTime?
  createdAt       DateTime     @default(now())

  // Relations
  taxCase     TaxCase     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  draftReturn DraftReturn? @relation(fields: [draftReturnId], references: [id], onDelete: SetNull)

  // Indexes
  @@unique([token])
  @@index([caseId, type])
  @@index([draftReturnId])
}
```

---

### Security Considerations

**1. Filename Sanitization**
- Removes: /, \, <, >, :, ", |, ?, *, .., control chars
- Limits: 255 characters max
- Prevents: Path traversal, XSS, filesystem issues

**2. PDF Validation**
- Magic bytes: Must start with 0x25504446 ("%PDF")
- MIME type: application/pdf
- File size: Max 50MB
- Prevents: Non-PDF uploads, DoS attacks

**3. Org-Scoped Access**
- buildNestedClientScope() validates case ownership
- Case → Client → Organization → Staff
- Prevents: Cross-org data access

**4. Magic Link Tokens**
- 12-character random base36 (nanoid)
- Used as both auth + identifier
- Token lookup: O(1) via unique index
- Prevents: Brute force (12^36 combinations ≈ 4.7e13)

**5. R2 Signed URLs**
- 15-minute expiry (read-only access)
- Prevents: Long-lived shareable URLs
- Access-control: R2 bucket policies (if configured)

**6. View Tracking**
- No sensitive data in request (token only)
- lastUsedAt updated per access
- Enables: Staff monitoring of client engagement

---

### Atomicity & Race Conditions

**Upload Transaction:**
```typescript
// Find max version (locked)
// Mark previous ACTIVE → SUPERSEDED
// Deactivate old magic links
// Create new DraftReturn record
// Create new MagicLink record
// (Upload to R2 after transaction success)
```
**Guarantee:** Version numbering never duplicates, old links always deactivated

**Extend Transaction:**
```typescript
// Find active magic link (locked)
// Update expiresAt to now + 14 days
```
**Guarantee:** Prevents concurrent extends causing lost updates

**Revoke Transaction:**
```typescript
// Update DraftReturn status → REVOKED
// Update all MagicLinks isActive → false
```
**Guarantee:** Revocation atomic with link deactivation

---

### Magic Link Service Integration

**getMagicLinkUrl() function:**
```typescript
case 'DRAFT_RETURN':
  return `${PORTAL_URL}/draft/${token}`
```

Location: `apps/api/src/services/magic-link.ts` (line 30)

Supports: Link type routing, consistent token format across all link types

---

---

## Phase 02 Manual Document Grouping - NEW

**Phase:** Phase 02 - Manual Document Grouping
**Status:** Complete & Production-Ready
**Date:** 2026-02-24
**Branch:** dev

### Overview

Phase 02 Manual Document Grouping adds a single API endpoint that allows staff to manually trigger batch document grouping for a tax case. This provides administrative control over document grouping when needed.

### API Endpoint

#### POST /cases/:caseId/group-documents

**Purpose:** Trigger batch document grouping job for classified documents in a case

**Location:** `apps/api/src/routes/cases/index.ts` (line 805)

**Authorization:** Staff-only (requires `user.staffId`)

**Request Body:**
```typescript
{
  forceRegroup?: boolean  // optional, default false
                          // If true, regroups even if already grouped
}
```

**Response (Success - 200):**
```typescript
{
  success: true,
  jobId: string,                    // Inngest job ID (e.g., "01HXYZ...")
  documentCount: number,            // Count of classified documents
  message: string                   // e.g., "Grouping started for 15 documents"
}
```

**Response (Errors):**
- `403 FORBIDDEN` - User is not staff member
- `404 NOT_FOUND` - Case not found or no access
- `400 NO_DOCUMENTS` - No classified documents to group
- `429 RATE_LIMITED` - Grouping already in progress (30s cooldown per case)

**Key Features:**
- **Staff-Only Access** - Enforced via `user.staffId` check
- **Rate Limiting** - 30-second cooldown between triggers per case (prevents concurrent runs)
- **Org-Scoped** - `buildNestedClientScope()` validates case ownership
- **Document Count** - Returns count of classified/linked documents processed
- **Job Tracking** - Returns Inngest job ID for monitoring
- **Audit Logging** - Logs trigger event with staff ID and options

**Security:**
- Staff-only restriction prevents clients/unauthorized users from triggering
- Rate limiter uses in-memory Map with 30s cooldown (per caseId)
- Case scope validation prevents cross-org access
- Triggers only process documents in CLASSIFIED or LINKED status

**Database Queries:**
- SELECT taxCase WHERE id=? AND org scope matches
- COUNT rawImages WHERE status IN ['CLASSIFIED', 'LINKED']

**Inngest Event:**
```typescript
{
  name: 'document/group-batch',
  data: {
    caseId: string,
    forceRegroup: boolean,
    triggeredBy: string  // Staff ID
  }
}
```

**Example Usage:**
```typescript
// Trigger grouping for case with default settings
const response = await fetch('/cases/case123/group-documents', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ...' },
  body: JSON.stringify({ forceRegroup: false })
})

// Response with job ID to monitor
const { jobId, documentCount } = await response.json()
// jobId = "01HXYZ..." - track progress in Inngest dashboard
// documentCount = 15 - documents being processed

// Force re-grouping of already grouped documents
const response = await fetch('/cases/case123/group-documents', {
  method: 'POST',
  body: JSON.stringify({ forceRegroup: true })
})

// Rate limit error (if called within 30 seconds)
// Response: { error: 'RATE_LIMITED', message: 'Grouping already in progress. Try again in 25s' }
```

**Validation Schemas:**
```typescript
export const groupDocumentsSchema = z.object({
  forceRegroup: z.boolean().optional().default(false),
})

export type GroupDocumentsInput = z.infer<typeof groupDocumentsSchema>
```

**Located in:** `apps/api/src/routes/cases/schemas.ts` (line 86)

### Event Type Definition

#### DocumentGroupBatchEvent

**Location:** `apps/api/src/lib/inngest.ts` (line 56)

**Type Definition:**
```typescript
export type DocumentGroupBatchEvent = {
  data: {
    caseId: string
    forceRegroup: boolean
    triggeredBy: string  // Staff ID
  }
}

// Registered in Inngest events map (line 71)
export type InngestEvents = {
  'document/group-batch': DocumentGroupBatchEvent
}
```

**Usage:**
- Sent by POST `/cases/:caseId/group-documents` endpoint
- Triggers background Inngest job for batch grouping
- Includes metadata for audit trail and conditional processing

### Rate Limiting

**Implementation:**
```typescript
const groupingInProgress = new Map<string, number>()
const GROUPING_COOLDOWN_MS = 30000  // 30 seconds
```

**Logic:**
1. Check if previous trigger timestamp exists for caseId
2. If exists and (now - lastTrigger) < 30000ms, return 429 RATE_LIMITED
3. On success, update timestamp: `groupingInProgress.set(caseId, Date.now())`

**Purpose:**
- Prevents duplicate concurrent batch jobs
- Avoids database contention from overlapping grouping operations
- Automatic cleanup not needed (Map holds max one entry per active case)

**Return Response on Rate Limit:**
```json
{
  "error": "RATE_LIMITED",
  "message": "Grouping already in progress. Try again in Xs"
}
```

### Audit Logging

**Implementation:**
```typescript
console.log(`[Manual Grouping] caseId=${id} staffId=${user.staffId} forceRegroup=${forceRegroup} docCount=${classifiedCount}`)
```

**Fields:**
- `caseId` - Tax case being grouped
- `staffId` - Staff member triggering
- `forceRegroup` - Whether forcing re-group
- `docCount` - Number of documents processed

**Purpose:** Audit trail for manual grouping actions (who triggered, when, parameters)

### Error Handling

| Status | Error Code | Scenario |
|--------|-----------|----------|
| 403 | FORBIDDEN | User is not staff |
| 404 | NOT_FOUND | Case doesn't exist or no access |
| 400 | NO_DOCUMENTS | No classified/linked documents |
| 429 | RATE_LIMITED | Within 30s cooldown |

**Example Error Response:**
```json
{
  "error": "NOT_FOUND",
  "message": "Case not found"
}
```

### Integration with Workspace

**Where Used:**
- Staff dashboard case actions (likely)
- Administrative grouping controls
- Case detail page (potential button)

**Flow:**
1. Staff clicks "Group Documents" button
2. Frontend POST to `/cases/:caseId/group-documents`
3. Backend validates access + rate limits
4. Triggers Inngest background job
5. Returns jobId for progress tracking
6. Frontend can poll or subscribe to job status updates

### Related Documentation

- **Classification Job:** `./phase-02-classification-job.md`
- **System Architecture:** `./system-architecture.md`
- **Quick Reference:** `./phase-02-quick-reference.md`
- **Inngest Events:** `apps/api/src/lib/inngest.ts`
- **Implementation:** `apps/api/src/routes/cases/index.ts` (lines 801-879)

### Deployment Checklist

- [ ] Endpoint tested in development environment
- [ ] Rate limiter verified (30s cooldown works)
- [ ] Staff-only restriction enforced
- [ ] Org-scoped access validated
- [ ] Inngest job integration confirmed
- [ ] Audit logging verified in console
- [ ] Error responses correct HTTP status codes
- [ ] Frontend integration complete
- [ ] Monitoring configured for job processing
- [ ] Documentation updated in workspace

---

**Last Updated:** 2026-02-24
**Status:** Complete & Production-Ready
**Architecture Version:** 6.2 (Phase 02 Manual Document Grouping)
**Next Phase:** Phase 03 - Advanced Features

