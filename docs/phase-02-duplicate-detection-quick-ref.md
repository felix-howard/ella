# Phase 02 Duplicate Detection - Quick Reference

**Status:** Complete
**Date:** 2026-01-21
**Type:** Frontend UI (Quick Reference)
**For:** Developers implementing or debugging duplicate detection features

---

## File Map

| File | Type | Purpose |
|------|------|---------|
| `duplicate-docs-card.tsx` | Component | Main container + grid layout (NEW) |
| `api-client.ts` | API | 2 new methods: delete + classify-anyway |
| `use-classification-updates.ts` | Hook | DUPLICATE status handling |
| `$clientId.tsx` | Route | Integration in Documents tab |
| `index.ts` | Export | Export DuplicateDocsCard |

---

## Component Quick Ref

### DuplicateDocsCard
**Props:**
```typescript
rawImages: RawImage[]    // Filter to status === 'DUPLICATE'
onRefresh: () => void    // Callback to refetch
```

**Returns:** `null` if no duplicates, else grid card

**Layout:** Responsive 3/4/5/6 columns (mobile→desktop)

---

## API Methods

### api.images.delete()
```typescript
DELETE /images/:imageId
Response: void
Toast: "Đã xóa tài liệu trùng lặp"
```

### api.images.classifyAnyway()
```typescript
POST /images/:imageId/classify-anyway
Response: void
Toast: "Đang phân loại tài liệu..."
```

---

## Color Scheme

| Element | Color | Class |
|---------|-------|-------|
| Icon | Orange | `text-orange-500` |
| Count badge | Orange bg | `bg-orange-100 text-orange-600` |
| Duplicate badge | Orange bg | `bg-orange-500 text-white` |
| Delete button hover | Red | `hover:bg-red-50 text-red-600` |
| Classify button hover | Primary | `hover:bg-primary/10` |

---

## Responsive Breakpoints

```
Mobile   < 640px  → 3 cols
Tablet   640-768  → 4 cols
Tablet+  768-1024 → 5 cols
Desktop  > 1024   → 6 cols
```

---

## Toast Messages

| Event | Message | Type |
|-------|---------|------|
| Duplicate detected | "Tài liệu trùng lặp: {filename}" | info |
| Delete success | "Đã xóa tài liệu trùng lặp" | success |
| Delete error | "Không thể xóa tài liệu" | error |
| Classify success | "Đang phân loại tài liệu..." | success |
| Classify error | "Không thể phân loại tài liệu" | error |

---

## State Management

### Component State
```typescript
const [isDeleting, setIsDeleting] = useState(false)
const [isClassifying, setIsClassifying] = useState(false)
```

### Query Invalidation
```typescript
queryClient.invalidateQueries({
  queryKey: ['images', latestCaseId]
})
```

---

## Error Handling Pattern

```typescript
try {
  await api.images.delete(imageId)
  toast.success('Đã xóa tài liệu trùng lặp')
  onRefresh()
} catch (error) {
  console.error('[DuplicateDocsCard] Delete failed:', error)
  toast.error('Không thể xóa tài liệu')
} finally {
  setIsDeleting(false)
}
```

---

## Performance Optimizations

| Technique | Implementation |
|-----------|-----------------|
| Memoization | `React.memo(DuplicateDocItem)` |
| Lazy loading | `LazyPdfThumbnail` (lazy import) |
| URL caching | 55 min staleTime on signed URLs |
| Suspense | Boundary around PDF loader |
| Toast dedup | 500ms window (toast-store) |

---

## Integration Checklist

- [x] Import `DuplicateDocsCard` in route
- [x] Add to Documents tab (before UnclassifiedDocsCard)
- [x] Pass `rawImages` and `onRefresh` props
- [x] Verify React Query invalidation pattern
- [x] Check toast notifications display
- [x] Test responsive layout
- [x] Test delete/classify actions
- [x] Test PDF thumbnail loading
- [x] Verify accessibility (ARIA labels)

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Card not showing duplicates | Verify `status === 'DUPLICATE'` in filter |
| Images not refetching | Check query key matches: `['images', caseId]` |
| Buttons not responsive | Verify disabled state on both buttons during action |
| PDF not rendering | Check lazy component is mounted, Suspense boundary present |
| Toast not visible | Ensure ToastContainer in root layout |

---

## Data Flow Diagram

```
User navigates to Documents tab
  ↓
useClassificationUpdates enabled (5s polling)
  ↓
api.cases.getImages() → rawImages
  ↓
DuplicateDocsCard filters: status === 'DUPLICATE'
  ↓
If empty → return null (hide card)
Else → render grid of items
  ↓
User clicks Delete/Classify
  ↓
API call → onRefresh() invalidates cache
  ↓
Re-render with updated images
```

---

## Links

**Full Documentation:** [`phase-02-duplicate-detection-ui.md`](./phase-02-duplicate-detection-ui.md)

**Related:**
- Unclassified Docs Card (similar pattern)
- Phase 01 pHash Detection (backend)
- System Architecture (data flow)
- Phase 02 API Endpoints

---

## Environment Notes

- Works in workspace app only (PORT 5173)
- Requires valid `latestCaseId`
- Depends on `useClassificationUpdates` hook
- Uses toast-store (no Zustand, useSyncExternalStore)
- Vietnamese-first UI text

---

**Quick Link to Full Doc:** [`phase-02-duplicate-detection-ui.md`](./phase-02-duplicate-detection-ui.md)
