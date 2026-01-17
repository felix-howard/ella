# Phase 04: Frontend Review UX - Classification Review & Confidence Badges

**Date:** 2026-01-14
**Status:** Complete
**Branch:** feature/enhancement

## Overview

Phase 04 adds intelligent confidence-based review workflow for AI document classification. CPA staff can review medium-confidence classifications (60-85%), approve with optional type correction, or reject to trigger re-upload. High-confidence (85%+) classifications auto-link; low-confidence (<60%) flag for manual review.

## Core Features

### 1. Confidence Level System

**File:** `apps/workspace/src/lib/constants.ts`

```typescript
CONFIDENCE_LEVELS = {
  HIGH: { min: 0.85, label: 'Cao', color: 'text-success', bg: 'bg-success/10' },
  MEDIUM: { min: 0.60, label: 'Trung bình', color: 'text-warning', bg: 'bg-warning/10' },
  LOW: { min: 0, label: 'Thấp', color: 'text-error', bg: 'bg-error/10' },
}

getConfidenceLevel(confidence: number | null) → ConfidenceLevel
```

**Usage:**
- HIGH (85%+): Auto-linked, no review needed
- MEDIUM (60-85%): Review modal, CPA can approve/change type
- LOW (<60%): Flagged for manual classification

### 2. RawImage Type Enhancement

**File:** `apps/workspace/src/lib/api-client.ts`

```typescript
interface RawImage {
  id: string
  caseId: string
  filename: string
  fileSize: number
  status: RawImageStatus
  classifiedType: DocType | null    // NEW: AI classification result
  aiConfidence: number | null        // NEW: 0-1 confidence score
  imageGroupId: string | null        // Duplicate group reference
}

interface ImageGroup {
  id: string
  caseId: string
  docType: DocType
  bestImageId: string | null
  images: RawImage[]
}
```

**New API Method:**
```typescript
api.images.updateClassification(id: string, {
  docType: string
  action: 'approve' | 'reject'
}) → { success, status }
```

### 3. Raw Image Gallery Updates

**File:** `apps/workspace/src/components/cases/raw-image-gallery.tsx`

**New Features:**
- Confidence badges next to image status (HIGH/MEDIUM/LOW)
- Review button (only visible for MEDIUM/LOW confidence)
- Color-coded confidence indicator
- Visual feedback for classification state

**Status Config:**
```typescript
IMAGE_STATUS_CONFIG = {
  UPLOADED: { label: 'Đã tải lên', icon: Clock },
  CLASSIFIED: { label: 'Đã phân loại', icon: CheckCircle },
  LINKED: { label: 'Đã liên kết', icon: CheckCircle },
  BLURRY: { label: 'Ảnh mờ', icon: AlertTriangle },
  UNCLASSIFIED: { label: 'Chưa phân loại', icon: HelpCircle },
}
```

### 4. Classification Review Modal (NEW)

**File:** `apps/workspace/src/components/documents/classification-review-modal.tsx`

**Purpose:** Review AI classification for medium-confidence images

**Props:**
```typescript
interface ClassificationReviewModalProps {
  image: RawImage | null
  isOpen: boolean
  onClose: () => void
  caseId: string
}
```

**Features:**
- Image preview (with signed URL validation for XSS prevention)
- Current AI classification with confidence badge
- DocType selector dropdown (21 supported types)
- Approve/Reject buttons
- Keyboard shortcuts (Enter=Approve, Esc=Close)
- Optimistic UI updates with React Query
- Toast notifications (success/error)
- XSS-safe signed URL validation

**Approve Action:**
- Updates `RawImage.classifiedType` to selected type
- Sets `aiConfidence = 1.0` (manual verification)
- Links to `DigitalDoc` record
- Updates `ChecklistItem.status = HAS_RAW`
- Increments `receivedCount`
- Toast: "Đã xác nhận phân loại"

**Reject Action:**
- Sets `RawImage.status = BLURRY`
- Clears classification
- Creates `BLURRY_DETECTED` action (HIGH priority)
- Toast: "Đã từ chối - yêu cầu gửi lại"

**Keyboard Shortcuts:**
- `Enter` - Approve classification
- `Esc` - Close modal
- Dropdown navigation with arrow keys

### 5. API Endpoint - PATCH /images/:id/classification

**File:** `apps/api/src/routes/images/index.ts`

**Route:** `PATCH /images/:id/classification`

**Request Body:**
```json
{
  "docType": "W2",
  "action": "approve" | "reject"
}
```

**Approval Logic:**
1. Find matching ChecklistItem by `docType`
2. Update RawImage with classification
3. Set status = LINKED
4. Link to ChecklistItem (increment receivedCount)
5. Create/update DigitalDoc (status = PENDING for OCR)
6. Atomic transaction (all-or-nothing)

**Rejection Logic:**
1. Set RawImage.status = BLURRY
2. Clear classification
3. Create BLURRY_DETECTED action (HIGH priority)
4. Metadata: { rawImageId, rejectedDocType }

**Response:**
```json
{
  "success": true,
  "status": "LINKED" | "BLURRY",
  "message": "Classification approved" | "Classification rejected - resend requested"
}
```

## Data Flow

```
Raw Image Gallery
        ↓
[Confidence Badge Display]
├─ HIGH (85%+): "Cao" badge, no review button
├─ MEDIUM (60-85%): "Trung bình" badge, Review button visible
└─ LOW (<60%): "Thấp" badge, Review button visible
        ↓
Staff clicks Review button
        ↓
ClassificationReviewModal opens
        ↓
[Modal Display]
├─ Image preview (signed URL with XSS validation)
├─ Current classification + confidence
├─ DocType dropdown (21 types)
└─ Approve/Reject buttons
        ↓
[Approve Path]
├─ PATCH /images/:id/classification { docType, action: 'approve' }
├─ Backend: Atomic transaction (RawImage + ChecklistItem + DigitalDoc)
├─ Frontend: Optimistic update (React Query)
├─ Toast: "Đã xác nhận phân loại"
└─ Modal closes, gallery refreshes
        ↓
[Reject Path]
├─ PATCH /images/:id/classification { docType, action: 'reject' }
├─ Backend: Set BLURRY, create BLURRY_DETECTED action
├─ Toast: "Đã từ chối - yêu cầu gửi lại"
└─ Modal closes, gallery refreshes, action appears in queue
```

## Security Considerations

### URL Validation (XSS Prevention)

**Function:** `isValidSignedUrl(url: string) → boolean`

```typescript
// Only allow HTTPS from trusted cloud storage
const trustedHosts = [
  '.r2.cloudflarestorage.com',
  '.amazonaws.com',
  '.storage.googleapis.com',
  '.blob.core.windows.net',
]
```

**Implementation:**
- Validate URL protocol = HTTPS
- Check hostname against whitelist
- Prevent data: URLs and javascript: URLs
- Handle parse errors gracefully

### Optimistic Updates

**Pattern:**
1. Cancel in-flight queries
2. Snapshot previous state
3. Optimistically update cache
4. Show UI change immediately
5. On success: invalidate queries
6. On error: rollback to snapshot

**Benefits:**
- Instant feedback to user
- Background sync prevents stale data
- Error rollback ensures consistency

## UI/UX Details

### Confidence Badge Styling

```
HIGH (85%+):   text-success bg-success/10   "Cao"
MEDIUM (60-85%): text-warning bg-warning/10  "Trung bình"
LOW (<60%):    text-error bg-error/10      "Thấp"
```

### Modal Layout

- Header: "Xác minh phân loại" title + close button
- Content: Grid (MD: 2-col, SM: 1-col)
  - Left: Image preview (4:3 aspect, rounded, overflow-hidden)
  - Right: Classification details
    - Current AI classification (read-only)
    - Confidence badge
    - DocType dropdown (scrollable, 60px max-height)
    - Filename (monospace, truncated)
- Footer: Approve/Reject buttons + keyboard hint

### Image Loading States

- Loading: Spinner
- Error: AlertCircle icon + "Không thể tải ảnh"
- Success: Full image with fallback object-contain
- No URL: ImageIcon + filename

## Files Changed

| File | Change |
|------|--------|
| `apps/workspace/src/lib/constants.ts` | Added CONFIDENCE_LEVELS, getConfidenceLevel() |
| `apps/workspace/src/lib/api-client.ts` | Updated RawImage type, added ImageGroup, api.images.updateClassification() |
| `apps/workspace/src/components/cases/raw-image-gallery.tsx` | Confidence badges, review button |
| `apps/workspace/src/components/documents/classification-review-modal.tsx` | NEW: Modal for review |
| `apps/api/src/routes/images/index.ts` | NEW: PATCH /images/:id/classification endpoint |

## Constants & Labels

**Vietnamese Labels:**
```typescript
// Confidence levels
HIGH: 'Cao'
MEDIUM: 'Trung bình'
LOW: 'Thấp'

// Image status
UPLOADED: 'Đã tải lên'
CLASSIFIED: 'Đã phân loại'
LINKED: 'Đã liên kết'
BLURRY: 'Ảnh mờ'
UNCLASSIFIED: 'Chưa phân loại'

// Toast messages
APPROVE_SUCCESS: 'Đã xác nhận phân loại'
REJECT_SUCCESS: 'Đã từ chối - yêu cầu gửi lại'
UPDATE_ERROR: 'Lỗi cập nhật phân loại'
```

## Next Steps

1. **Phase 04.1** - Confidence-based action queue filtering
   - Filter actions by confidence level
   - Batch approve/reject workflow
   - Confidence trend analytics

2. **Phase 04.2** - Manual classification for low-confidence images
   - Drag-to-classify interface
   - Template matching suggestions
   - Confidence feedback loop

3. **Phase 05** - Real-time notifications on classification completion
   - WebSocket or polling for auto-refresh
   - Push notifications to staff
   - Audit trail of all reviews

## Related Documentation

- [codebase-summary.md](./codebase-summary.md) - Raw image & classification overview
- [system-architecture.md](./system-architecture.md) - Database schema & API routes
- [phase-4.1-copy-clipboard-workflow.md](./phase-4.1-copy-clipboard-workflow.md) - Data entry workflow
- [phase-4.2-side-by-side-document-viewer.md](./phase-4.2-side-by-side-document-viewer.md) - Document viewer

---

**Last Updated:** 2026-01-14
**Status:** Phase 04 Complete
**Next Phase:** Phase 04.1 - Action Queue Filtering & Batch Workflow
