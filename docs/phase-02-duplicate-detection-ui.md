# Phase 02: Duplicate Document Detection - Frontend UI

**Status:** Complete
**Date:** 2026-01-21
**Branch:** feature/even-more-enhancement

## Overview

Phase 02 Frontend UI implements the visual layer and user interactions for duplicate document detection. Builds on Phase 01 (pre-classification pHash duplicate detection) to provide staff with actionable duplicate management capabilities.

**Key Features:**
- DuplicateDocsCard component displays all documents flagged with DUPLICATE status
- Delete duplicates directly from UI
- Force-classify duplicates (bypass duplicate check)
- Toast notifications for duplicate detection and actions
- Conditional rendering (card hidden when no duplicates exist)
- Responsive grid layout (3 cols mobile → 6 cols desktop)

## Architecture

### Component Hierarchy

```
ClientDetailPage ($clientId.tsx)
  └── Documents Tab
      └── DuplicateDocsCard
          └── DuplicateDocItem (memoized)
              ├── DuplicateThumbnail
              │   └── LazyPdfThumbnail (lazy-loaded)
              └── Action Buttons
                  ├── Delete Button
                  └── Classify Button
```

## Components

### DuplicateDocsCard

**Location:** `apps/workspace/src/components/documents/duplicate-docs-card.tsx`

Main container component that displays duplicate documents in a grid.

#### Props
```typescript
interface DuplicateDocsCardProps {
  rawImages: RawImage[]        // All raw images for the case
  onRefresh: () => void         // Callback to refetch images after action
}
```

#### Behavior
- Filters `rawImages` to only include those with `status === 'DUPLICATE'`
- Returns `null` if no duplicates exist (card hidden entirely)
- Shows count badge (orange) with duplicate count
- Displays Vietnamese UI text:
  - Header: "Tài liệu trùng lặp"
  - Subtext: "Các tài liệu này trùng với tài liệu đã tải lên. Bạn có thể xóa hoặc phân loại riêng."

#### Layout
- **Header:** Icon (Copy - orange) + title + count badge
- **Info text:** Explanatory text about duplicates
- **Grid:** Responsive layout:
  - 3 cols on mobile (< 640px)
  - 4 cols on small devices (640px - 768px)
  - 5 cols on tablets (768px - 1024px)
  - 6 cols on desktop (> 1024px)

### DuplicateDocItem

**Type:** Memoized functional component inside `duplicate-docs-card.tsx`

Individual thumbnail card for a single duplicate document.

#### State Management
```typescript
const [isDeleting, setIsDeleting] = useState(false)      // Delete operation in progress
const [isClassifying, setIsClassifying] = useState(false) // Classify operation in progress
```

#### Layout
```
┌─────────────────────────┐
│ h-24 Thumbnail Area     │
│ ┌─────────────────────┐ │
│ │ DuplicateThumbnail  │ │
│ └─────────────────────┘ │
│ ┌─ Badge (top-right) ─┐ │  "Trùng"
│ └─────────────────────┘ │
├─────────────────────────┤
│ Filename (truncated)    │
├─────────────────────────┤
│ [Xóa] | [Phân loại]     │  Action buttons (split 50/50)
└─────────────────────────┘
```

#### Action Handlers

**handleDelete()**
- Calls `api.images.delete(image.id)`
- Shows success toast: "Đã xóa tài liệu trùng lặp"
- Calls `onRefresh()` to refetch images
- Error toast: "Không thể xóa tài liệu"

**handleClassify()**
- Calls `api.images.classifyAnyway(image.id)` (bypass duplicate check)
- Shows success toast: "Đang phân loại tài liệu..."
- Calls `onRefresh()` to trigger polling updates
- Error toast: "Không thể phân loại tài liệu"

### DuplicateThumbnail

**Type:** Sub-component for loading and displaying document thumbnails

#### Features
- Lazy-loads signed URL via `useSignedUrl()` hook (55 min cache)
- Handles PDF files differently (lazy-loaded LazyPdfThumbnail)
- Displays fallback icons (FileText for PDFs, ImageIcon for images)
- Error state shows icon only
- Loading state shows spinner

#### PDF Support
```typescript
function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf')
}
```

Uses Suspense + lazy-loaded `LazyPdfThumbnail` component to avoid bundle bloat.

## API Integration

### New API Methods

**apps/workspace/src/lib/api-client.ts**

#### api.images.delete()
```typescript
api.images.delete(imageId: string): Promise<void>
```
- DELETE request to `/images/:imageId`
- Permanently removes duplicate image from case
- Used by DuplicateDocItem

#### api.images.classifyAnyway()
```typescript
api.images.classifyAnyway(imageId: string): Promise<void>
```
- POST request to `/images/:imageId/classify-anyway`
- Forces classification job to start, bypassing duplicate check
- Used by DuplicateDocItem
- Triggers reprocessing by the classification service

### Error Handling
- Wrapped in try/catch blocks in component handlers
- User-friendly toast error messages
- Console logging for debugging

## Hook Integration

### use-classification-updates.ts

Added DUPLICATE status handling in `handleStatusChange()` callback:

```typescript
case 'DUPLICATE':
  toast.info(`Tài liệu trùng lặp: ${current.filename}`)
  break
```

**Behavior:** When an image status transitions to DUPLICATE (from UPLOADED or PROCESSING):
- Shows info toast with filename
- No checklist invalidation needed (DUPLICATE doesn't create DigitalDoc)
- Continues polling for other status changes

## Route Integration

**apps/workspace/src/routes/clients/$clientId.tsx**

### Import
```typescript
import { DuplicateDocsCard } from '../../components/documents'
```

### Usage (Documents Tab)
```typescript
{activeTab === 'documents' && (
  <div className="space-y-6">
    {/* Card A: Duplicate Docs - shows when duplicates exist */}
    <DuplicateDocsCard
      rawImages={rawImages}
      onRefresh={() => {
        queryClient.invalidateQueries({ queryKey: ['images', latestCaseId] })
      }}
    />

    {/* Card B: Unclassified Docs */}
    <UnclassifiedDocsCard {...} />

    {/* Card C: Category Checklist */}
    {/* ... */}
  </div>
)}
```

**Position:** DuplicateDocsCard appears FIRST in documents tab (above UnclassifiedDocsCard).

**Refresh Logic:** `onRefresh` invalidates React Query cache for `['images', latestCaseId]`, triggering immediate refetch and UI update.

## Export Configuration

**apps/workspace/src/components/documents/index.ts**

```typescript
export { DuplicateDocsCard } from './duplicate-docs-card'
```

Makes component available for route integration.

## Styling & UX

### Colors & States
- **Header icon:** Orange (Copy icon, text-orange-500)
- **Count badge:** Orange background (bg-orange-100, text-orange-600)
- **Duplicate indicator:** Orange badge with white text ("Trùng")
- **Delete button hover:** Red background (hover:bg-red-50, text-red-600)
- **Classify button hover:** Primary accent (hover:bg-primary/10, text-primary)
- **Card hover:** Orange border (hover:border-orange-400)

### Accessibility
- Semantic button elements with `aria-label` attributes
- `aria-busy` attributes for loading states
- `title` attributes for tooltips
- Proper disabled states during operations
- Image alt text from filename

### Performance Optimizations
- **Memoization:** `DuplicateDocItem` wrapped in `React.memo()` to prevent re-renders during polling
- **Lazy PDF loading:** `LazyPdfThumbnail` lazy-imported to reduce bundle
- **Suspense boundary:** Around LazyPdfThumbnail with fallback UI
- **Signed URL caching:** 55-minute staleTime on thumbnail requests
- **Toast deduplication:** Built into toast-store (500ms window)

## Toast Notifications

**Location:** `apps/workspace/src/stores/toast-store.ts`

### Duplicate Detection (Auto)
- Triggered by `useClassificationUpdates` hook
- Message: "Tài liệu trùng lặp: {filename}"
- Type: `info` (blue/dark toast)

### Delete Action
- Success: "Đã xóa tài liệu trùng lặp"
- Error: "Không thể xóa tài liệu"

### Classify Action
- Success: "Đang phân loại tài liệu..."
- Error: "Không thể phân loại tài liệu"

## User Workflows

### Scenario 1: Handle Duplicate Found
1. Document uploaded → pHash detects duplicate
2. Image status transitions to DUPLICATE
3. Toast appears: "Tài liệu trùng lặp: filename.pdf"
4. DuplicateDocsCard renders on Documents tab
5. User sees duplicate in grid with count badge

### Scenario 2: Delete Duplicate
1. User clicks delete button on duplicate thumbnail
2. Button shows spinner, disabled state
3. API call: DELETE /images/{imageId}
4. On success:
   - Toast: "Đã xóa tài liệu trùng lặp"
   - Images cache invalidated
   - Card re-renders, image removed
   - If no duplicates remain, card hidden entirely

### Scenario 3: Force Classify Duplicate
1. User clicks "Phân loại" button on duplicate thumbnail
2. Button shows spinner, disabled state
3. API call: POST /images/{imageId}/classify-anyway
4. On success:
   - Toast: "Đang phân loại tài liệu..."
   - Images cache invalidated
   - Classification job starts (bypasses pHash check)
   - Polling detects status transition
   - Toast updates when classification completes

## Data Flow

```
User navigates to Documents tab
  ↓
useClassificationUpdates enabled (polling on 5s interval)
  ↓
api.cases.getImages() fetches all rawImages
  ↓
DuplicateDocsCard filters to status === 'DUPLICATE'
  ↓
If duplicates.length === 0:
  └─→ return null (card hidden)
Else:
  └─→ Render grid of DuplicateDocItem components
      ├─ Each item fetches signed URL on mount
      ├─ User can delete → invalidate cache → refetch
      └─ User can classify → invalidate cache → polling detects status change
```

## Testing Considerations

### Manual Testing Checklist
- [ ] Upload duplicate file → verify pHash detection works
- [ ] Check toast notification appears
- [ ] Verify DuplicateDocsCard renders with correct count
- [ ] Delete duplicate → verify removal from UI
- [ ] Classify duplicate → verify transitions to CLASSIFIED
- [ ] Responsive layout at different breakpoints (3/4/5/6 cols)
- [ ] PDF thumbnail loads (lazy component)
- [ ] Error states (delete/classify fail)
- [ ] Card hidden when no duplicates

### Edge Cases
- Multiple duplicates (> 20)
- Rapid delete/classify actions
- Network timeout during delete/classify
- PDF file type handling
- Filename truncation (very long names)
- Concurrent polling + manual action

## Migration Notes

**From Phase 01 (pHash Detection):**
- Phase 01 implemented backend duplicate detection
- Phase 02 adds UI for managing detected duplicates
- No backend schema changes required
- Uses existing `RawImage` type and DUPLICATE status

**Integration Points:**
- Depends on `useClassificationUpdates` hook (existing)
- Reuses `useSignedUrl` hook pattern from UnclassifiedDocsCard
- Follows styling conventions from existing components

## Related Documentation

- [Phase 01: Duplicate Detection (pHash)](./phase-01-pdf-converter.md) - Backend detection
- [Unclassified Docs Card](./phase-01-unclassified-docs-card.md) - Similar component pattern
- [System Architecture](./system-architecture.md) - Data flow diagrams
- [API Endpoints](./phase-02-api-endpoints.md) - Detailed endpoint docs

## File Changes Summary

| File | Change | Lines |
|------|--------|-------|
| `duplicate-docs-card.tsx` | NEW | 235 |
| `components/documents/index.ts` | MODIFIED | +1 export |
| `lib/api-client.ts` | MODIFIED | +2 methods |
| `hooks/use-classification-updates.ts` | MODIFIED | +3 lines (DUPLICATE case) |
| `routes/clients/$clientId.tsx` | MODIFIED | +1 import, +6 lines (component usage) |

## Next Steps

### For Developers
1. Test duplicate detection workflow end-to-end
2. Verify toast notifications display correctly
3. Check responsive layout at all breakpoints
4. Monitor console for any API errors

### For Product
1. Gather user feedback on duplicate detection UX
2. Consider batch operations (delete/classify multiple at once)
3. Plan Phase 03 enhancements (grouping, analytics)

### For DevOps
1. Monitor `/images/:imageId` DELETE endpoint performance
2. Track `/images/:imageId/classify-anyway` usage
3. Ensure pHash duplicate detection is accurate on production data
