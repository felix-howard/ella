# Phase 2: Portal UI Components - Redesigned Experience

**Completed:** 2026-01-20
**Status:** Phase 2 Complete - Consolidated Single-Page Experience

## Overview

Portal redesign Phase 2 delivers a simplified, mobile-first UI for document uploads. Two new lightweight components replace the previous enhanced uploader, creating a streamlined user experience:
- **MissingDocsList** - Clean list of required documents
- **SimpleUploader** - Single big button for file picker

Integrated into consolidated `/u/$token/` route (removed separate `/upload` and `/status` pages).

## Components

### 1. MissingDocsList (`apps/portal/src/components/missing-docs-list.tsx`)

**Purpose:** Display documents client needs to upload from checklist

**Props:**
```typescript
interface MissingDocsListProps {
  docs: ChecklistDoc[]
  language: Language  // 'VI' | 'EN'
}
```

**Features:**
- **XSS Sanitization** - Strips HTML tags from doc labels for defense-in-depth
- **Localized Labels** - Uses `doc.labelVi` + sanitized fallback to `doc.docType`
- **Icon-Text Layout** - FileText icon + label in minimal card design
- **Empty State** - Shows "Đã đủ tài liệu" / "All documents received" when docs.length === 0
- **ARIA Compliant** - `role="list"`, `role="listitem"`, `aria-live="polite"` for screen readers

**Visual:**
- Space-y-3 section container
- lg semibold heading
- Each doc in muted/50 bg card (p-3, rounded-xl)
- Gray FileText icon + text-sm label

**Example Usage:**
```tsx
<MissingDocsList
  docs={portalData.checklist.filter(c => c.status === 'MISSING')}
  language="VI"
/>
```

### 2. SimpleUploader (`apps/portal/src/components/simple-uploader.tsx`)

**Purpose:** Single big button that triggers native OS file picker (mobile-first)

**Props:**
```typescript
interface SimpleUploaderProps {
  token: string                              // Auth token from route param
  language: Language                         // 'VI' | 'EN'
  onUploadComplete: (result: UploadResponse) => void
  onError: (message: string) => void
}
```

**Features:**
- **Native File Picker** - Click triggers hidden `<input type="file" multiple />`
- **Client-Side Validation** (hidden from user):
  - Max 10MB per file
  - Types: JPEG, PNG, GIF, WebP, PDF
  - Silently skips invalid files, proceeds with valid ones
- **No Technical Jargon** - User sees friendly i18n messages, not error codes
- **Upload States:**
  - Default: "Nhấn để gửi tài liệu" (Tap to upload)
  - Uploading: Loader spinner + "Đang tải lên..." (Uploading...)
  - Success: CheckCircle2 + "Đã gửi thành công!" (Uploaded successfully!)
  - Error: AlertCircle toast + API message

**Progress Tracking:**
- Linear progress bar (h-2, rounded-full, bg-muted)
- Percentage display below bar
- Updates via `onUploadComplete` callback

**Error Handling:**
- Toast alerts for validation/API errors
- 5-second auto-dismiss
- No blocking - user can retry

**Layout:**
```
[Hidden file input]
[Error toast - if error]
[Success toast - if success]
[Progress bar - if uploading]
[BIG BUTTON - w-full h-16 text-lg rounded-2xl]
```

## Integration: `/u/$token/` Route

**File:** `apps/portal/src/routes/u/$token/index.tsx`

**Page Structure (Single Page Experience):**
1. WelcomeHeader (greeting + tax year)
2. MissingDocsList (documents needed from checklist)
3. SimpleUploader (one big upload button)
4. Refresh handler for retry on errors

**Data Flow:**
- Initial load: `portalApi.getData(token)` fetches PortalData
- Upload complete: `handleUploadComplete` refreshes data → updates MissingDocsList
- Error: Retry button reloads data

**Consolidation (Phase 2):**
- Deleted: `enhanced-uploader.tsx`, `upload-buttons.tsx`
- Removed: Separate `/upload` and `/status` routes
- Merged: Single cohesive page experience

## I18n Additions

**File:** `apps/portal/src/lib/i18n.ts`

**New Strings** (VI):
- `docsNeeded` → "Tài liệu cần gửi"
- `tapToUpload` → "Nhấn để gửi tài liệu"
- `uploadedSuccess` → "Đã gửi thành công!"
- `noDocsNeeded` → "Đã đủ tài liệu"

**English Equivalents:**
- `docsNeeded` → "Documents Needed"
- `tapToUpload` → "Tap to Upload Documents"
- `uploadedSuccess` → "Uploaded successfully!"
- `noDocsNeeded` → "All documents received"

## Architecture & Patterns

### Component Design
- **Lightweight** - No external uploader libraries (avoid bloat)
- **Reusable** - Props-based, single responsibility
- **Accessible** - ARIA labels, semantic HTML, keyboard support
- **Type-Safe** - Full TypeScript interfaces

### Mobile-First
- Single column layout (max 448px design)
- Large touch targets (h-16 button, 16+ tap area)
- Minimal scroll depth on small screens
- Native OS pickers (no custom UI)

### Security
- XSS sanitization in MissingDocsList
- File type validation (allowlist: JPEG, PNG, GIF, WebP, PDF)
- Size limits enforced (10MB per file)
- No user-submitted content in DOM

## Deleted Components

**enhanced-uploader.tsx:**
- Complex drag-drop + file picker
- Too many options for single-page UX
- Replaced by SimpleUploader

**upload-buttons.tsx:**
- Separate camera/gallery buttons
- Outdated pattern (native picker is faster)
- Consolidated into single button

## Testing Notes

**MissingDocsList:**
- Render with empty docs → shows "Đã đủ tài liệu"
- Render with docs → lists all with icons
- XSS sanitization → `<script>` tags stripped

**SimpleUploader:**
- File selection → valid files upload, invalid silently skip
- Progress → 0-100% updates smoothly
- Error toast → auto-dismisses after 5s
- Success → brief 3s toast, triggers callback

## Next Steps

### Phase 2.1+
- Desktop view optimization (sidebar nav, wider layout)
- Real-time upload status polling
- Chunked upload for large files
- Retry logic for failed uploads

### Analytics
- Track upload success rate
- Monitor invalid file rejection
- Error message frequency analysis

---

**Component Ownership:** Portal App
**Lines of Code:** ~260 (both components)
**Dependencies:** lucide-react, Button from @ella/ui
**Last Updated:** 2026-01-20
