# Phase 04 - AI Error Messages & Idempotency Fix

**Status:** Complete
**Date:** 2026-01-16
**Branch:** `feature/enhancement`

## Overview

Phase 04 implements Vietnamese error message localization for AI failures and fixes a critical race condition in the document classification job. These changes improve user experience with contextual, translated error messages and ensure atomic processing guarantees.

## Components Added

### 1. AI Error Messages Module (`apps/api/src/services/ai/ai-error-messages.ts`)

Low-level error translation layer mapping Gemini exceptions to user-friendly Vietnamese messages.

**Exported Types & Functions:**

```typescript
// Error type union - categorizes 10 error scenarios
export type AIErrorType =
  | 'MODEL_NOT_FOUND'      // 404 model errors, fallback triggers
  | 'RATE_LIMIT'           // 429 Too Many Requests
  | 'QUOTA_EXCEEDED'       // Resource exhaustion
  | 'SERVICE_UNAVAILABLE'  // 503, overloaded service
  | 'INVALID_IMAGE'        // Format/codec mismatch
  | 'IMAGE_TOO_LARGE'      // >10MB file size
  | 'TIMEOUT'              // Execution timeout
  | 'CLASSIFICATION_FAILED'// High-level classification error
  | 'OCR_FAILED'           // Data extraction failure
  | 'UNKNOWN'              // Unmapped/fallback error

// Primary translation function - maps technical error to Vietnamese
export function getVietnameseError(
  technicalError: string | null | undefined
): {
  type: AIErrorType
  message: string
  severity: 'info' | 'warning' | 'error'
}

// Get UI-friendly action title for error type
export function getActionTitle(errorType: AIErrorType): string

// Convert severity to action priority
export function getActionPriority(
  severity: 'info' | 'warning' | 'error'
): 'NORMAL' | 'HIGH'
```

**Error Mapping Strategy:**

| Pattern | Type | Vietnamese Message | Severity |
|---------|------|-------------------|----------|
| `model not found`, `404` | MODEL_NOT_FOUND | Mô hình AI không khả dụng. Hệ thống đang chuyển sang mô hình dự phòng. | warning |
| `rate limit` | RATE_LIMIT | Hệ thống đang bận. Tài liệu sẽ được xử lý trong vài phút. | info |
| `quota exceeded`, `resource exhausted` | QUOTA_EXCEEDED | Đã vượt giới hạn xử lý AI. Vui lòng liên hệ quản trị viên. | error |
| `503`, `service unavailable`, `overloaded` | SERVICE_UNAVAILABLE | Dịch vụ AI tạm ngưng. Vui lòng phân loại thủ công hoặc thử lại sau. | warning |
| `invalid image`, `unsupported format` | INVALID_IMAGE | Định dạng hình ảnh không hợp lệ. Vui lòng tải lên ảnh JPEG, PNG hoặc PDF. | error |
| `too large`, `exceeds maximum` | IMAGE_TOO_LARGE | Hình ảnh quá lớn. Vui lòng tải lên file nhỏ hơn 10MB. | error |
| `timeout` | TIMEOUT | Xử lý quá thời gian. Vui lòng thử lại. | warning |

**Regex Safety:**
- All patterns use non-greedy quantifiers (`.+?`, `.{n,m}?`)
- Limited character classes `[\w-]` instead of `.*`
- Prevents ReDoS (regular expression denial of service) attacks

**Input Validation:**
```typescript
// Handles null, undefined, empty string gracefully
const errorStr = technicalError?.toString().trim() || ''
if (!errorStr) {
  return UNKNOWN_ERROR_RESPONSE
}
```

**Fallback Behavior:**
- Null/undefined input → UNKNOWN with fallback message
- Unmatched error strings → UNKNOWN with fallback message
- Ensures zero crashes on edge cases

### 2. Action Title Mapping

Function `getActionTitle()` converts error types to user-facing Vietnamese titles for action records:

```typescript
MODEL_NOT_FOUND → "Cần chuyển mô hình AI"
RATE_LIMIT → "Đang chờ xử lý"
QUOTA_EXCEEDED → "Vượt giới hạn AI"
SERVICE_UNAVAILABLE → "AI không khả dụng"
INVALID_IMAGE → "Hình ảnh không hợp lệ"
IMAGE_TOO_LARGE → "File quá lớn"
TIMEOUT → "Quá thời gian xử lý"
CLASSIFICATION_FAILED → "Phân loại tự động thất bại"
OCR_FAILED → "Trích xuất dữ liệu thất bại"
UNKNOWN → "Lỗi xử lý AI"
```

### 3. Priority Calculation

Function `getActionPriority()` maps error severity to action priority:

```typescript
'error'   → HIGH     // Critical issues (quota, invalid image)
'warning' → NORMAL   // Non-blocking (rate limit, timeout, service unavailable)
'info'    → NORMAL   // Informational (temporarily unavailable)
```

## Database Schema Updates

### AiFailedMetadata Interface (pipeline-types.ts)

```typescript
export interface AiFailedMetadata extends ActionMetadataBase {
  errorMessage?: string              // User-facing Vietnamese message
  technicalError?: string            // Original Gemini error (sanitized)
  r2Key?: string                     // Storage reference
  attemptedAt?: string               // ISO timestamp
  errorType: AIErrorType             // Required - categorizes error
}
```

**Key Change:** Added `errorType` as **required field** to support severity-based routing and UI categorization.

## Job Updates

### Document Classification Job (`apps/api/src/jobs/classify-document.ts`)

#### Atomic Idempotency Fix

**Problem:** Race condition when multiple requests process same image simultaneously.

**Solution:** Atomic compare-and-swap operation before processing starts.

```typescript
// Step 0: Atomic idempotency check + mark processing
const idempotencyCheck = await step.run('check-idempotency', async () => {
  // ATOMIC: Only update if status === 'UPLOADED'
  const updated = await prisma.rawImage.updateMany({
    where: { id: rawImageId, status: 'UPLOADED' },
    data: { status: 'PROCESSING' },
  })

  // If no rows updated, already processed or doesn't exist
  if (updated.count === 0) {
    const image = await prisma.rawImage.findUnique({
      where: { id: rawImageId },
      select: { status: true },
    })
    return { skip: true, status: image?.status || 'NOT_FOUND' }
  }

  return { skip: false }
})

// Skip remaining steps if already processed
if (idempotencyCheck.skip) {
  return { success: false, reason: 'Already processed' }
}
```

**Benefits:**
- Database-level locking (no concurrent updates possible)
- Single atomic operation (no TOCTOU vulnerability)
- Falls back to status check if already processed
- Prevents double-processing without explicit locking

#### Vietnamese Error Handling in AI_FAILED Actions

When classification or OCR fails:

```typescript
// Get error details with Vietnamese translation
const errorInfo = getVietnameseError(technicalError)

// Create AI_FAILED action with categorized error
await createAction({
  caseId,
  type: 'AI_FAILED',
  priority: getActionPriority(errorInfo.severity),  // Maps severity → priority
  title: getActionTitle(errorInfo.type),            // Vietnamese title
  description: errorInfo.message,
  metadata: {
    rawImageId,
    errorMessage: errorInfo.message,               // Vietnamese for UI
    technicalError: sanitizeErrorMessage(technicalError), // Sanitized for logs
    errorType: errorInfo.type,                      // For routing/analytics
    r2Key,
    attemptedAt: new Date().toISOString(),
  },
})
```

**Error Sanitization:**
```typescript
// Removes sensitive data before storage
function sanitizeErrorMessage(error: string): string {
  return error
    .replace(/(?:AIza|sk-)[a-zA-Z0-9_-]{20,}/g, '[API_KEY_REDACTED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    .replace(/(?:\/|\\)[a-zA-Z0-9._-]+(?:\/|\\)[a-zA-Z0-9._/-]+/g, '[PATH_REDACTED]')
    .substring(0, 500)
}
```

## API Integration

### Exports (`apps/api/src/services/ai/index.ts`)

New error message functions now exported:

```typescript
export {
  getVietnameseError,
  getActionTitle,
  getActionPriority,
  type AIErrorType,
} from './ai-error-messages'
```

**Usage in Jobs/Services:**

```typescript
import { getVietnameseError, getActionTitle, getActionPriority } from '@ella/api/services/ai'

// In error handling paths
const error = getVietnameseError(geminiError)
const action = createAction({
  title: getActionTitle(error.type),
  priority: getActionPriority(error.severity),
  description: error.message,
  // ... rest of metadata
})
```

## User Experience Impact

### Before Phase 04
- Generic "AI processing failed" messages
- No error type categorization
- English-only error text
- Unclear action titles in workspace

### After Phase 04
- Contextual Vietnamese messages:
  - Rate limit → "Hệ thống đang bận. Tài liệu sẽ được xử lý trong vài phút."
  - Image too large → "Hình ảnh quá lớn. Vui lòng tải lên file nhỏ hơn 10MB."
  - Service unavailable → "Dịch vụ AI tạm ngưng. Vui lòng phân loại thủ công hoặc thử lại sau."
- Clear action titles matching error type
- Appropriate priority levels (HIGH for critical, NORMAL for recoverable)
- Users understand what went wrong and next steps

### Workspace Integration
Actions appear in client action queue with:
- **Title:** Vietnamese action description (e.g., "Cần chuyển mô hình AI")
- **Description:** Friendly message (e.g., "Mô hình AI không khả dụng...")
- **Priority:** HIGH/NORMAL based on severity
- **Metadata:** Technical error details for debugging

## Testing Strategy

### Unit Tests

```typescript
// Test each error type mapping
describe('getVietnameseError', () => {
  it('maps 404 error to MODEL_NOT_FOUND', () => {
    const result = getVietnameseError('404: model not found')
    expect(result.type).toBe('MODEL_NOT_FOUND')
    expect(result.severity).toBe('warning')
  })

  it('handles null input gracefully', () => {
    const result = getVietnameseError(null)
    expect(result.type).toBe('UNKNOWN')
    expect(result.message).toContain('phân loại thủ công')
  })
})

// Test priority calculation
describe('getActionPriority', () => {
  it('maps error severity to HIGH priority', () => {
    expect(getActionPriority('error')).toBe('HIGH')
  })

  it('maps warning/info to NORMAL priority', () => {
    expect(getActionPriority('warning')).toBe('NORMAL')
    expect(getActionPriority('info')).toBe('NORMAL')
  })
})

// Test idempotency
describe('classify-document job', () => {
  it('skips already-processed images (PROCESSING status)', async () => {
    // Already marked PROCESSING by concurrent request
    const result = await classifyDocumentJob.run(...)
    expect(result.reason).toBe('Already processed')
  })
})
```

### Integration Tests
- Verify action creation with correct metadata
- Confirm Vietnamese messages appear in workspace
- Test error sanitization doesn't expose API keys
- Validate priority levels in action queue

## Configuration

No new environment variables required. Uses existing:

```env
GEMINI_API_KEY=<your-api-key>
GEMINI_MODEL=gemini-2.0-flash      # Default
```

## Next Steps

1. **Testing:** Run unit tests for error mapping and idempotency
   ```bash
   npm run test -- apps/api/src/services/ai/ai-error-messages.test.ts
   npm run test -- apps/api/src/jobs/classify-document.test.ts
   ```

2. **Manual Testing:**
   - Upload document via portal
   - Simulate service unavailability to verify Vietnamese message
   - Check workspace action queue for correct title/priority

3. **Monitoring:**
   - Track error type distribution via `AIErrorType` in metadata
   - Monitor rate of retryable vs unrecoverable errors
   - Validate sanitization redacts sensitive data

## Files Changed

| File | Changes |
|------|---------|
| `apps/api/src/services/ai/ai-error-messages.ts` | NEW - Error mapping & translation |
| `apps/api/src/services/ai/pipeline-types.ts` | UPDATED - `errorType` field in `AiFailedMetadata` |
| `apps/api/src/services/ai/index.ts` | UPDATED - Export new functions |
| `apps/api/src/jobs/classify-document.ts` | UPDATED - Atomic idempotency check, Vietnamese errors |

## Related Documentation

- [Phase 2.1 - AI Document Processing Services](./phase-2.1-ai-services.md) - Pipeline overview
- [System Architecture - AI Pipeline](./system-architecture.md) - Design patterns
- [Code Standards](./code-standards.md) - TypeScript conventions
