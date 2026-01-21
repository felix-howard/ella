# Phase 05: Real-time Updates - Polling & Notifications

**Date:** 2026-01-14
**Status:** Complete
**Branch:** feature/enhancement

## Overview

Phase 05 implements real-time UI updates when AI document classification completes. The system polls for image status changes every 5 seconds (only when the documents tab is active), displays toast notifications based on confidence levels, and shows a floating status panel during processing.

## Core Features

### 1. Classification Updates Hook

**File:** `apps/workspace/src/hooks/use-classification-updates.ts`

Real-time polling mechanism for tracking image status changes:

```typescript
export function useClassificationUpdates({
  caseId,
  enabled = true,
  refetchInterval = 5000, // 5 seconds
}: UseClassificationUpdatesOptions)
```

**Key Features:**
- Polls `/cases/:id/images` endpoint every 5 seconds
- Only polls when `enabled: true` and tab is active
- `refetchIntervalInBackground: false` - saves battery/bandwidth
- Tracks previous image states to detect transitions
- Shows contextual toast notifications on status changes
- Invalidates checklist query when images are linked
- Memory leak prevention with cleanup on unmount
- **Stuck detection (Phase 1 & 2 Debug):** Identifies images stuck in PROCESSING state for >5 minutes and excludes them from progress notifications

**State Tracking:**
```typescript
type ImageStatusMap = Map<string, {
  status: string
  aiConfidence: number | null
}>
```

**Notifications by Status Transition:**
- `UPLOADED → PROCESSING`: FloatingPanel shown
- `PROCESSING → CLASSIFIED (85%+)`: `toast.success("W2 (95%)")`
- `PROCESSING → CLASSIFIED (60-85%)`: `toast.info("Cần xác minh: 1099-NEC (72%)")`
- `PROCESSING → CLASSIFIED (<60%)`: `toast.info("Độ tin cậy thấp")`
- `PROCESSING → LINKED`: `toast.success("Đã liên kết: W2")`
- `PROCESSING → UNCLASSIFIED`: `toast.info("Cần xem xét: filename")`
- `PROCESSING → BLURRY`: `toast.error("Ảnh mờ: filename")`

**Return Value:**
```typescript
{
  images: RawImage[]
  processingCount: number          // Count of PROCESSING images
  isPolling: boolean              // Whether polling is active
}
```

### 2. Upload Progress Floating Panel

**File:** `apps/workspace/src/components/documents/upload-progress.tsx`

Displays processing status during AI classification:

```typescript
interface UploadProgressProps {
  processingCount: number
}
```

**Features:**
- Shows "AI đang phân loại N ảnh..." (AI is classifying N images)
- Animated pulsing Sparkles icon
- Fixed position: `bottom-20 right-6 z-50`
- Auto-hides when `processingCount === 0`
- Non-intrusive floating panel design
- Vietnamese labels

**Layout:**
```
┌─ Đang xử lý ✨ ─────────────┐
│ ✨ AI đang phân loại N ảnh...│
│ Kết quả sẽ tự động cập nhật  │
└──────────────────────────────┘
```

### 3. Raw Image Gallery PROCESSING State

**File:** `apps/workspace/src/components/cases/raw-image-gallery.tsx`

Enhanced with PROCESSING status badge:

**Status Configuration:**
```typescript
PROCESSING: {
  label: 'Đang phân loại',
  icon: Loader2,              // Animated loader
  color: 'text-primary',
  bgColor: 'bg-primary-light',
}
```

**Display:**
- PROCESSING badge shows animated loader icon
- Gallery item shows "Đang phân loại" label
- Remains visible during AI processing
- Updates to final status when complete

### 4. Client Detail Route Integration

**File:** `apps/workspace/src/routes/clients/$clientId.tsx`

Integrates all real-time components:

```typescript
// Enable polling when documents tab is active
const {
  images,
  processingCount,
  isPolling
} = useClassificationUpdates({
  caseId: latestCaseId,
  enabled: activeTab === 'documents'  // Only when tab active
})

// Render components
return (
  <>
    <RawImageGallery
      images={images}
      // ... other props
    />
    <UploadProgress processingCount={processingCount} />
  </>
)
```

**Integration Flow:**
1. Documents tab becomes active → polling starts
2. useClassificationUpdates polls every 5s
3. Status changes detected → toast notifications
4. Checklist queries invalidated → automatic refresh
5. Gallery UI updates with new status/confidence
6. FloatingPanel shows processing progress
7. Documents tab becomes inactive → polling stops

## Polling Architecture

### Request/Response Cycle

```
GET /cases/:id/images (React Query)
        ↓
Response: { images: RawImage[] }
        ↓
Compare with previous state
        ↓
Detect transitions:
  - UPLOADED → PROCESSING
  - PROCESSING → CLASSIFIED
  - PROCESSING → LINKED
  - etc.
        ↓
handleStatusChange() triggers
        ↓
Toast notification (if transition detected)
        ↓
Optionally: invalidateQueries(['checklist', caseId])
        ↓
Component re-renders with new state
```

### Timing & Performance

**Polling Interval:** 5000ms (5 seconds)
- Configurable via `refetchInterval` prop
- Conservative interval balances responsiveness vs load
- Inngest processes images in 2-5s typically, so 5s catches transitions well

**Tab-Aware Polling:**
```typescript
refetchInterval: enabled ? refetchInterval : false,
refetchIntervalInBackground: false
```
- Only polls when tab is active
- Stops polling immediately on tab switch
- Saves battery/bandwidth when not viewing

**Memory Management:**
- `previousImagesRef` tracks state between polls
- Cleanup on unmount: `previousImagesRef.clear()`
- State comparison prevents memory bloat
- Initial load skips notifications (prevents noise)

## Toast Notifications

### Confidence-Based Messages

All messages include document labels from `DOC_TYPE_LABELS`:

**High Confidence (85%+):**
```
toast.success("W2 (95%)")
toast.success("Đã liên kết: 1099-INT")
```

**Medium Confidence (60-85%):**
```
toast.info("Cần xác minh: 1099-NEC (72%)")
toast.info("Cần xem xét: filename.jpg")
```

**Low Confidence (<60%):**
```
toast.info("Độ tin cậy thấp: Invoice")
```

**Error States:**
```
toast.error("Ảnh mờ: document.jpg")
```

### Toast Store Integration

Uses existing Zustand toast store:
```typescript
import { toast } from '../stores/toast-store'

toast.success(message)  // 2s auto-dismiss
toast.info(message)     // 2s auto-dismiss
toast.error(message)    // 2s auto-dismiss
```

## Stuck Detection (Phase 1 & 2 Debug)

### Smart Stuck Image Handling

The hook implements intelligent detection for images that appear stuck in PROCESSING state, preventing false progress notifications:

**Threshold:** 5 minutes (300,000ms) in PROCESSING state

**Detection Logic:**

On initial load:
1. Scan all images with `status === PROCESSING`
2. Check `updatedAt` timestamp
3. Calculate time delta: `now - updatedAt.getTime()`
4. If delta > 5 minutes, mark as "stuck" in `initialProcessingIdsRef`
5. Count only "active" (non-stuck) processing images

**Affected Components:**
- FloatingPanel only shows count of active (non-stuck) images
- Auto-hides when `activeProcessingCount === 0` (ignores stuck items)
- Progress notifications only fired for images that transition while session is active

**Benefits:**
- Prevents misleading progress indicators
- Distinguishes between actively-processing items and stale/abandoned jobs
- Improves modal display accuracy on page reload

**Example Scenario:**
```
Initial load:
  - Image A: PROCESSING since 6 minutes ago → marked stuck
  - Image B: PROCESSING since 30 seconds ago → counted as active

Result:
  - FloatingPanel shows "1 image processing" (Image B only)
  - User doesn't see stuck Image A in progress count
  - When Image B completes → notification fires
```

**Code Implementation:**
```typescript
// Track IDs that were already processing on initial load (old/stuck data)
const initialProcessingIdsRef = useRef<Set<string> | null>(null)

// On first mount: identify stuck images
const now = Date.now()
initialProcessingIdsRef.current = new Set(
  currentImages
    .filter((img) => {
      if (img.status !== 'PROCESSING') return false
      const updatedAt = new Date(img.updatedAt).getTime()
      return now - updatedAt > STUCK_THRESHOLD_MS // Only mark as stuck if older than 5 min
    })
    .map((img) => img.id)
)

// Compute active count (exclude initial stuck items)
const activeCount = currentImages.filter(
  (img) => img.status === 'PROCESSING' && !initialProcessingIdsRef.current?.has(img.id)
).length
```

## Files Changed

| File | Type | Changes |
|------|------|---------|
| `apps/workspace/src/hooks/use-classification-updates.ts` | MODIFIED | Added stuck detection (Phase 1&2 Debug), improved modal display accuracy |
| `apps/workspace/src/components/documents/upload-progress.tsx` | NEW | Floating panel component |
| `apps/workspace/src/components/cases/raw-image-gallery.tsx` | MODIFIED | Added PROCESSING status badge |
| `apps/workspace/src/routes/clients/$clientId.tsx` | MODIFIED | Integrated polling + components |

## Constants & Dependencies

**DOC_TYPE_LABELS** (from constants.ts):
```typescript
{
  W2: 'W2',
  '1099_INT': '1099-INT',
  '1099_NEC': '1099-NEC',
  SSN_CARD: 'SSN Card',
  DRIVER_LICENSE: 'Driver License',
  // ... 16 more types
}
```

**Image Status Types:**
```typescript
type ImageStatus = 'UPLOADED' | 'PROCESSING' | 'CLASSIFIED' |
                   'LINKED' | 'BLURRY' | 'UNCLASSIFIED'
```

## Usage Example

```typescript
function ClientDetailPage() {
  const { clientId } = Route.useParams()
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // Enable polling when documents tab is active
  const { images, processingCount } = useClassificationUpdates({
    caseId: latestCaseId,
    enabled: activeTab === 'documents',
    refetchInterval: 5000
  })

  return (
    <div>
      {/* Tab navigation */}
      <div className="tabs">
        <button onClick={() => setActiveTab('overview')}>Overview</button>
        <button onClick={() => setActiveTab('documents')}>Documents</button>
      </div>

      {/* Content */}
      {activeTab === 'documents' && (
        <>
          <RawImageGallery images={images} />
          <UploadProgress processingCount={processingCount} />
        </>
      )}
    </div>
  )
}
```

## Performance Optimization Notes

**Polling Efficiency:**
- 5s interval is optimal balance (fast enough to show updates, slow enough for efficiency)
- State comparison prevents duplicate notifications
- Skip initial load avoids notification spam on mount

**React Query Optimization:**
- `refetchIntervalInBackground: false` - doesn't poll when hidden
- Automatic cache management reduces redundant renders
- Query invalidation on status change (not full refetch)

**Browser Impact:**
- No polling when documents tab inactive
- Minimal battery/network drain
- Memory cleanup prevents leaks
- Ref-based state (previousImagesRef) avoids render triggers

## Browser Compatibility

- Chrome 90+ (React Query 5.64+)
- Firefox 88+
- Safari 14.1+
- Edge 90+

## Related Documentation

- [codebase-summary.md](./codebase-summary.md) - Phase 05 overview
- [system-architecture.md](./system-architecture.md) - Real-time flow diagram
- [phase-04-frontend-review-ux.md](./phase-04-frontend-review-ux.md) - Classification modal
- [phase-4.1-copy-clipboard-workflow.md](./phase-4.1-copy-clipboard-workflow.md) - Toast system

## Next Steps

1. **Phase 05.1 - WebSocket Real-time**
   - Replace polling with Socket.io or native WebSocket
   - Eliminate 5s latency
   - Support server-pushed events
   - Reduce network overhead

2. **Phase 05.2 - Advanced Notifications**
   - Sound notifications for high-priority events
   - Browser notifications (with permission)
   - Audit trail of all notifications

3. **Phase 05.3 - Performance Monitoring**
   - Track polling performance metrics
   - Monitor toast notification frequency
   - Optimize polling intervals by usage patterns

## Key Decisions

1. **Polling vs WebSocket** - Chose polling for simplicity, can upgrade to WebSocket later
2. **5s Interval** - Balanced responsiveness (matches typical AI processing time)
3. **Tab-Aware Polling** - Stop when inactive to save resources
4. **Toast Notifications** - Non-intrusive feedback for status changes
5. **Confidence-Based Messages** - Contextual messaging helps staff prioritize

---

**Last Updated:** 2026-01-17 (Phase 1 & 2 Debug: Stuck detection + Gemini model update)
**Status:** Phase 05 Complete + Phase 1 & 2 Debug Enhancements
**Architecture Version:** 5.1

## Recent Updates (Phase 1 & 2 Debug)

**2026-01-17 Changes:**
1. **Stuck Detection Enhancement:** Added smart 5-minute threshold detection for images stuck in PROCESSING state
   - Prevents misleading progress notifications
   - Improves modal display accuracy on component mount/reload
   - Distinguishes active vs abandoned jobs

2. **Gemini Model Update:** Reverted primary model from `gemini-2.0-flash` to `gemini-2.5-flash`
   - More stable performance for classification tasks
   - Maintained fallback chain: `gemini-2.5-flash-lite,gemini-2.5-flash`
   - See [Phase 2.1 - AI Document Processing Services](./phase-2.1-ai-services.md) for details
