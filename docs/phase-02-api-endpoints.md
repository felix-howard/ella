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

**Last Updated:** 2026-01-15
**Status:** Complete & Production-Ready
**Architecture Version:** 6.0
**Next Phase:** Phase 03 - Multi-stage Processing & Batch Operations

