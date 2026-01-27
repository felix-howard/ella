# Phase 03 Storage Rename - R2 File Renaming Implementation

**Date:** 2026-01-27 | **Status:** COMPLETE | **Files Changed:** 5

## Overview

Phase 03 Storage Rename adds R2 file renaming capability based on AI document classification results. Files are renamed from generic upload names to meaningful names following a standardized convention.

## Key Components

### 1. Filename Sanitizer Utilities
**Location:** `packages/shared/src/utils/filename-sanitizer.ts`

Provides utilities for consistent document naming with support for international characters:

#### Functions

- **`removeDiacritics(text: string): string`**
  - Removes Vietnamese accents and tones (ă, â, đ, ê, ô, ơ, ư)
  - Uses Unicode normalization (NFD) + combining mark removal
  - Handles special case of đ/Đ

- **`toPascalCase(text: string): string`**
  - Converts text to PascalCase
  - Example: "google llc" → "GoogleLlc"
  - Splits on spaces, hyphens, underscores

- **`sanitizeComponent(input: string | null | undefined, maxLength?: number): string`**
  - Removes diacritics + special characters
  - Converts to PascalCase
  - Enforces max length (default 30 chars)
  - Handles null/undefined gracefully

- **`generateDocumentName(components: DocumentNamingComponents): string`**
  - Generates final filename from classification results
  - Format: `{TaxYear}_{DocType}_{Source}_{ClientName}`
  - Enforces 60-char total limit
  - Tax year defaults to current year if null

- **`getDisplayNameFromKey(r2Key: string): string`**
  - Extracts display name from R2 key path
  - Removes file extension
  - Example: `cases/abc123/docs/2025_W2_Google_Andy.pdf` → `2025_W2_Google_Andy`

#### Naming Components Interface
```typescript
interface DocumentNamingComponents {
  taxYear: number | null
  docType: string
  source: string | null
  clientName: string
}
```

### 2. Storage Service Enhancement
**Location:** `apps/api/src/services/storage.ts`

Adds `renameFile()` function for R2 file renaming:

#### RenameResult Interface
```typescript
interface RenameResult {
  success: boolean
  newKey: string
  oldKey: string
  error?: string
}
```

#### renameFile() Function
```typescript
async function renameFile(
  oldKey: string,
  caseId: string,
  components: DocumentNamingComponents
): Promise<RenameResult>
```

**Operation:**
1. Generates new filename using `generateDocumentName()`
2. Returns old key unchanged if keys match (no-op)
3. Copies object from old key to new key in `cases/{caseId}/docs/` folder
4. Deletes old key (failures logged but don't fail operation)
5. Returns result object

**Design Rationale:**
- R2/S3 has no native rename operation → copy+delete pattern
- Delete failure is acceptable (orphaned file in R2, DB points to new key)
- Extension preservation handled via `.split('.')` on old key
- Defaults to `.pdf` if no extension found

**R2 Configuration Check:**
- Requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY environment variables
- Returns error if R2 not configured (graceful degradation)

## File Structure
```
cases/{caseId}/
├── raw/              # Original uploaded files (generic names)
│   └── 123456.pdf
├── docs/             # Renamed documents (meaningful names)
│   └── 2025_W2_GoogleLlc_JohnSmith.pdf
└── thumbnails/       # Generated thumbnails
```

## Test Coverage

### Filename Sanitizer Tests (33 tests)
- **Diacritics Removal:** Vietnamese character handling
- **PascalCase Conversion:** Word splitting, case conversion
- **Component Sanitization:** Special char removal, length enforcement
- **Document Name Generation:** Format validation, truncation
- **Display Name Extraction:** Key parsing, extension removal

### Storage Rename Tests (10 tests)
**Location:** `apps/api/src/services/__tests__/storage-rename.test.ts`

Core functionality:
1. Copy+delete pattern execution
2. Extension preservation (.pdf, .jpg, etc.)
3. Identical key detection (skips rename)
4. Copy failure handling (returns error)
5. Delete failure handling (succeeds with warning)

Edge cases:
1. Vietnamese character handling
2. Null taxYear → current year
3. Missing extension → defaults to .pdf
4. Empty source field → omitted from name
5. Complex docType names (e.g., SCHEDULE_K1_1065)

**Mock Strategy:**
- Mocks @aws-sdk/client-s3 (S3Client, commands)
- Mocks @aws-sdk/s3-request-presigner
- Sets env vars before dynamic import
- Tracks mockSend() call count and arguments

## Integration Points

### Upcoming Usage
- **Document Verification Flow:** Called when staff verifies AI classification
- **Automatic Finalization:** Could be triggered on high-confidence (≥85%) documents
- **Manual Override:** When staff corrects AI classification

### Data Flow
```
AI Classification Result (docType, confidence)
    ↓
If verified/finalized:
    ↓
Call renameFile(r2Key, caseId, {taxYear, docType, source, clientName})
    ↓
Update Document table: r2Key = newKey
    ↓
Old key orphaned in R2 (acceptable)
```

## Conventions Followed

### Naming Rules
- No spaces (use underscore as separator)
- No Vietnamese diacritics (converted to ASCII)
- No special characters (/ \ : * ? " < > |)
- PascalCase for source and client name
- Uppercase for docType (from AI classification)
- Year first for chronological sorting
- Max 60 chars total (enforced)

### Examples
| Classification | Components | Result |
|---|---|---|
| W2 from Google LLC for John Smith | 2025, W2, "Google LLC", "John Smith" | 2025_W2_GoogleLlc_JohnSmith.pdf |
| Driver License for Nguyễn Văn A | 2025, DRIVER_LICENSE, null, "Nguyễn Văn A" | 2025_DRIVER_LICENSE_NguyenVanA.pdf |
| Schedule K1 from Partnership Inc | 2025, SCHEDULE_K1, "Partnership Inc", "John" | 2025_SCHEDULE_K1_PartnershipInc_John.pdf |

## Deployment Notes

### Environment Requirements
- R2_ACCOUNT_ID - Cloudflare R2 account ID
- R2_ACCESS_KEY_ID - R2 API access key
- R2_SECRET_ACCESS_KEY - R2 API secret key
- R2_BUCKET_NAME - Target bucket name (default: 'ella-documents')

### Graceful Degradation
- If R2 not configured: Operation logs warning, returns success without changing file
- If copy fails: Returns error, file not moved
- If delete fails: Logs warning, operation succeeds (new file in place)

## Future Enhancements

1. **Batch Rename:** Rename multiple files in single operation
2. **Rename Audit Trail:** Track who renamed what and when
3. **Filename Conflict Handling:** Append timestamp/counter if name exists
4. **Automatic Rename:** Trigger on confidence threshold (e.g., ≥85%)

## Related Documentation
- [AI Document Processing Pipeline Flow](./system-architecture.md#ai-document-processing-pipeline-flow---phase-0203-implementation)
- [Storage Service](./system-architecture.md#backend-services)
- [Filename Sanitizer Tests](./phase-03-storage-rename.md#test-coverage)
