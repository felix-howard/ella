# Portal Enhanced Uploader

**Status:** Implemented (2026-01-14)
**Component:** `EnhancedUploader` at `apps/portal/src/components/upload/enhanced-uploader.tsx`

## Overview

Enhanced document upload interface for portal with mobile-first design, real-time progress tracking, and automatic retry logic.

## Features

### User Interface
- **Mobile (iOS/Android):**
  - Camera capture button (uses device camera with `capture="environment"`)
  - Gallery picker button
  - File count display

- **Desktop (600px+):**
  - Drag & drop zone with visual feedback
  - Click-to-browse fallback
  - Responsive grid preview (3 columns on mobile/tablet)

### Upload Capabilities
- **File Types:** JPEG, PNG, GIF, WebP, PDF
- **Max File Size:** 10MB per file
- **Max Files:** 20 files per upload session (configurable)
- **Validation:**
  - MIME type check (strict: requires both valid type + extension)
  - File size validation
  - File count limit with user-friendly error messages

### Progress & Retry
- **Real-time Progress:** XHR-based upload with per-file progress bars
- **Batch Processing:** All files upload as single batch with shared progress
- **Retry Logic:** Automatic retry (up to 2 retries) for network errors only
  - Server errors (429, 500, etc.) do not retry
  - Network errors (`NETWORK_ERROR`, status 0) trigger retries
- **Progress Display:**
  - Overall progress bar with percentage
  - Individual file preview with upload percentage overlay
  - Success checkmark on completion
  - Error state with visual indicator

### Accessibility
- ARIA live regions for progress updates (`aria-live="polite"`)
- Progress bar with `role="progressbar"` and numeric attributes
- Semantic HTML (`role="region"`, `role="list"`, `role="listitem"`)
- Hidden file inputs with `aria-hidden="true"`
- Alert dialogs for validation errors with `role="alert"`
- Descriptive button labels and file names in alt text

### Memory Management
- Cleanup: Object URLs revoked on component unmount
- Prevents: Memory leaks from blob URL buildup
- Timing: URLs released after upload or on file removal

## API Integration

### Endpoint
```
POST /portal/{token}/upload
Content-Type: multipart/form-data
```

### Implementation

**Upload with Progress:**
```typescript
portalApi.uploadWithProgress(token, files, onProgress)
```

Uses XMLHttpRequest for:
- `onprogress` event tracking
- Real-time upload progress (0-1 decimal)
- Raw response parsing

**Error Handling:**
- `ApiError` with status, code, and message
- Rate limiting (429) → `RATE_LIMITED` error
- Network errors → `NETWORK_ERROR` with retry eligible
- Server errors (500, 503) → `SERVER_ERROR` / `UNAVAILABLE` (no retry)
- Parse errors → `PARSE_ERROR`

## Internationalization

**i18n Strings** (`apps/portal/src/lib/i18n.ts`):

### Vietnamese (VI)
| Key | Value |
|-----|-------|
| `takePhoto` | Chụp ảnh |
| `chooseFromGallery` | Chọn từ thư viện |
| `uploadTitle` | Gửi tài liệu thuế |
| `uploading` | Đang tải lên... |
| `dragDropHere` | Kéo thả file vào đây |
| `clickToBrowse` | hoặc click để chọn |
| `selectedFiles` | file đã chọn |
| `maxFileSize` | Tối đa 10MB mỗi file |
| `supportedFormats` | Chấp nhận: JPEG, PNG, PDF |
| `fileTooLarge` | File quá lớn (tối đa 10MB) |
| `invalidFileType` | Chỉ chấp nhận ảnh (JPEG, PNG) và PDF |
| `maxFilesReached` | Chỉ có thể thêm {count} file nữa |
| `errorUploading` | Không thể tải lên |

### English (EN)
Similar keys with English translations. See `getText(language)` for full mapping.

## Component Props

```typescript
interface EnhancedUploaderProps {
  token: string              // Magic link token for upload
  language: Language         // 'VI' or 'EN'
  onUploadComplete: (result: UploadResponse) => void
  onError: (error: string) => void
  maxFiles?: number          // Default: 20
  disabled?: boolean         // Disable during upload or other operations
}
```

## Implementation Details

### File Validation Helpers

**`isValidFileType(file: File): boolean`**
- Checks MIME type against `VALID_MIME_TYPES` (strict)
- OR accepts any image/* MIME type as fallback
- Checks file extension against `VALID_EXTENSIONS`
- Both MIME and extension must pass

**`sanitizeFileName(name: string): string`**
- Removes control characters and special OS chars
- Max length: 255 chars
- Replaces invalid chars with underscore

**`isMobileDevice(): boolean`**
- Detects iOS, Android, Windows Phone, etc.
- Used at component init (memoized)
- Controls conditional UI (camera buttons vs drag-drop)

### Upload State Machine

```
idle
  ↓ (user clicks upload)
uploading (files marked as 'uploading')
  ↓
  ├─ (success) → success (files marked as 'done')
  ├─ (network error) → [retry logic] → uploading
  └─ (server error or max retries) → error (files marked as 'error')
```

### File Progress Tracking

Each file has:
- `id`: Random 9-char string (unique in session)
- `progress`: 0-100 (percentage)
- `status`: 'pending' | 'uploading' | 'done' | 'error'
- `previewUrl`: Blob URL (images only, PDF shows icon)

Batch upload means all files update together during XHR progress.

## Type Definitions

```typescript
type UploadState = 'idle' | 'uploading' | 'success' | 'error'

interface FileWithProgress {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  previewUrl?: string
}

interface ValidationError {
  type: 'size' | 'format' | 'count'
  message: string
}
```

## Integration in Upload Page

Route: `apps/portal/src/routes/u/$token/upload.tsx`

**Flow:**
1. Page loads and validates token via `portalApi.getData(token)`
2. User selects files → `EnhancedUploader` handles selection & preview
3. User uploads → `uploadWithProgress` called, progress updates in real-time
4. Success → Page shows "Thank you" with upload count
5. Error → Page shows error message with retry button
6. Retry → Returns to file selection state

**State Management:**
- `pageState`: 'loading' | 'select' | 'success' | 'error'
- `uploadedCount`: Number of successfully uploaded files
- `errorMessage`: Last error from uploader

## Performance Considerations

### Optimizations
- `memo()` on both components prevents unnecessary re-renders
- `useCallback` on handlers prevents closure stale-ness
- `useMemo` on `isMobileDevice()` calc (single computation)
- Batch file upload (all at once, not sequential)

### Memory
- Blob URLs cleaned up on unmount or file removal
- No persistent state of old URLs
- File array properly keyed with stable IDs

### Network
- XHR for real-time progress (fetch API doesn't support)
- Automatic retry only for transient network errors
- Single upload request for all files (efficiency)

## Browser Support

- Modern browsers: Chrome, Firefox, Safari, Edge (all versions with File API + XHR)
- Mobile: iOS 13+, Android 8+ (camera capture support)
- No IE11 support (uses modern ES6+ syntax)

## Common Issues & Solutions

### Issue: Camera button not appearing
**Cause:** Component detected as desktop (user agent check)
**Solution:** Check browser device emulation or actual mobile device

### Issue: Progress bar stuck at 0%
**Cause:** XHR.upload.onprogress not fired (small files may complete too fast)
**Solution:** Expected behavior for small files; not a bug

### Issue: Memory leak warnings after upload
**Cause:** Preview URLs not cleaned up
**Solution:** Component cleanup runs on unmount; ensure component unmounts after success

### Issue: Retries not happening
**Cause:** Server error (not network error); retries only for `NETWORK_ERROR`
**Solution:** Retry logic correctly skips non-transient failures; by design

## Testing Checklist

- [ ] Mobile: Camera button captures and uploads
- [ ] Mobile: Gallery picker selects multiple files
- [ ] Desktop: Drag & drop zone accepts files
- [ ] Desktop: Click zone opens file picker
- [ ] Validation: Rejects files > 10MB
- [ ] Validation: Rejects non-image/PDF files
- [ ] Validation: Shows error message for invalid files
- [ ] Validation: Shows error when maxFiles exceeded
- [ ] Upload: Progress bar updates 0-100%
- [ ] Upload: Files show in preview grid
- [ ] Upload: Success state after completion
- [ ] Upload: Error state on failure
- [ ] Retry: Network error retries automatically
- [ ] Retry: Server error does not retry
- [ ] i18n: Vietnamese text displays correctly
- [ ] i18n: English text displays correctly
- [ ] Accessibility: Progress bar has aria-valuenow
- [ ] Accessibility: Alert role for validation errors
- [ ] Accessibility: Keyboard navigation works
- [ ] Memory: No blob URL leaks after unmount

## Future Enhancements

- Image compression before upload (reduce payload size)
- Resumable upload for large files (chunked XHR)
- Per-file retry toggle (skip bad files, retry others)
- Drag & drop on mobile (iOS 13+, Android 5+)
- Image cropping/rotation UI
- PDF preview with page thumbnails
