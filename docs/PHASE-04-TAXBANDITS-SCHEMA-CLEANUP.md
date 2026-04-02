# Phase 4: TaxBandits API Migration - Schema Cleanup

**Date:** 2026-04-02
**Branch:** feature/more-ella-polish
**Effort:** 0.5h
**Status:** ✅ COMPLETE

---

## Overview

Phase 4 completes the TaxBandits API migration by removing deprecated Tax1099 API fields from the database schema. All 1099-NEC operations now exclusively use TaxBandits-based identification and tracking.

---

## Changes Made

### Database Schema (Removed Fields)

| Model | Field Removed | Reason |
|-------|---------------|--------|
| `Contractor` | `tax1099RecipientId` | TaxBandits API doesn't require recipient ID tracking; submission is direct |
| `Form1099NEC` | `tax1099FormId` | Replaced by `taxbanditsRecordId` (TaxBandits native form ID) |
| `FilingBatch` | `tax1099SubmissionId` | Replaced by `taxbanditsSubmissionId` (TaxBandits native batch ID) |

### Database Schema (Added Fields)

| Model | Field Added | Type | Purpose |
|-------|-------------|------|---------|
| `Form1099NEC` | `taxbanditsSubmissionId` | String (indexed) | Denormalized batch lookup for rapid status queries |
| `FilingBatch` | `taxbanditsSubmissionId` | String (indexed) | Primary batch identifier from TaxBandits API |

### Code Changes

**Routes:**
- `apps/api/src/routes/contractors/index.ts` - Removed `tax1099RecipientId` references from request/response types
- `apps/api/src/routes/contractors/validators.ts` - Removed field validation for deprecated Tax1099 fields

**Services:**
- `apps/api/src/services/crypto/index.ts` - Removed unused Tax1099 field handling

**Frontend API Client:**
- `apps/workspace/src/lib/api-client.ts` - Updated request types to exclude deprecated fields

---

## Schema Documentation

### Current Form1099NEC Structure
```
Form1099NEC {
  id: String (PK)
  clientId: String (FK → Client)
  taxYear: Int
  status: Form1099Status enum

  // TaxBandits Integration
  taxbanditsRecordId: String (indexed)      // Form ID from TaxBandits
  taxbanditsSubmissionId: String? (indexed) // Batch ID (denormalized)

  // Contractor Data
  contractorName: String
  contractorSSN: String (encrypted)
  contractorEIN: String? (encrypted)
  contractorAddress: String
  contractorPhone: String

  // Form Data
  amount1099: Decimal

  // Tracking
  validationErrors: String[]
  efileStatus: String?
  efileSubmittedAt: DateTime?

  // Metadata
  filingBatchId: String? (FK → FilingBatch)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Current FilingBatch Structure
```
FilingBatch {
  id: String (PK)
  clientId: String (FK → Client)
  taxYear: Int
  status: Form1099Status enum

  // TaxBandits Submission
  taxbanditsSubmissionId: String (indexed) // Batch ID from TaxBandits

  // Metadata
  forms: Form1099NEC[] (relation)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Current Contractor Structure
```
Contractor {
  id: String (PK)
  clientId: String (FK → Client, restricted to BUSINESS only)

  // Identification
  name: String
  ssn4Encrypted: String  // Last 4 digits encrypted
  einEncrypted: String?  // Optional EIN encrypted

  // Details
  address: String
  phone: String
  businessType: String enum (INDIVIDUAL | SOLE_PROP | PARTNERSHIP | S_CORP | C_CORP)

  // Amount Tracking
  amount1099: Decimal

  // Metadata
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

## Performance Impact

- **Improved Query Speed**: Indexed `taxbanditsSubmissionId` on Form1099NEC enables O(log n) batch lookups
- **Reduced Storage**: Removed 2 unnecessary fields (tax1099RecipientId, tax1099FormId) from two tables
- **Single Source of Truth**: All batch operations reference TaxBandits IDs only (eliminates mismatch risks)

---

## Backward Compatibility

- **Data Migration**: None required; deprecated fields were already unused in Phase 3 implementation
- **API Endpoints**: No breaking changes; endpoints already used TaxBandits fields in Phase 3
- **Old Tax1099 Client**: Service file removed in Phase 6 cleanup

---

## Testing Status

✅ **Type Check:** All TypeScript strict mode passed
✅ **Lint:** No linting issues
✅ **Build:** Successful compilation
✅ **Routes:** All 1099-NEC endpoints functional with TaxBandits integration
✅ **Validators:** Updated to exclude deprecated fields

---

## Files Modified

- `packages/db/prisma/schema.prisma` - Schema cleanup
- `apps/api/src/routes/contractors/index.ts` - Remove tax1099RecipientId
- `apps/api/src/routes/contractors/validators.ts` - Update validators
- `apps/api/src/services/crypto/index.ts` - Remove unused handlers
- `apps/workspace/src/lib/api-client.ts` - Update request types

---

## Next Steps

- Monitor production deployment for any edge cases with batch lookups
- ✅ `tax1099-client.ts` removed in Phase 6 cleanup
- Document TaxBandits API integration in technical runbooks

---

**Verified by:** Code review
**Approved for production:** ✅ Yes
