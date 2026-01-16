# Phase 01: PDF Converter Service

**Status:** Complete
**Date:** 2026-01-16
**Component:** `apps/api/src/services/pdf/`

## Overview

Phase 01 PDF Converter Service enables high-quality PDF to PNG conversion for OCR processing. Documents are rendered at 200 DPI for optimal OCR accuracy while maintaining strict file size and page limits for memory safety.

**Key Features:**
- PDF validation (magic bytes & format checks)
- Page count inspection (max 10 pages)
- Multi-page batch conversion
- 20MB file size limit enforcement
- Encrypted PDF detection
- Vietnamese error messages
- Automatic temp file cleanup

## Architecture

### Service Organization

```
apps/api/src/services/pdf/
├── pdf-converter.ts          # Core conversion logic
├── index.ts                  # Public exports
└── __tests__/
    └── pdf-converter.test.ts # Unit tests (8 tests)
```

### Type Declarations

```
apps/api/src/types/
└── pdf-poppler.d.ts          # TypeScript definitions for pdf-poppler
```

## Implementation Details

### PDF Conversion Function

**Function:** `convertPdfToImages(pdfBuffer: Buffer): Promise<PdfConversionResult>`

Converts a PDF buffer to PNG images for OCR processing.

**Parameters:**
- `pdfBuffer` - PDF file as Buffer

**Returns:**
```typescript
{
  success: boolean
  pages?: PdfPageImage[]           // Array of rendered pages
  totalPages?: number              // Total pages in PDF
  error?: string                   // Vietnamese error message
  errorType?: PdfErrorType         // Error classification
  processingTimeMs?: number        // Processing duration
}
```

**Error Types:**
```typescript
type PdfErrorType =
  | 'INVALID_PDF'        // Wrong magic bytes or corrupted
  | 'ENCRYPTED_PDF'      // Password-protected document
  | 'TOO_LARGE'          // Exceeds 20MB limit
  | 'TOO_MANY_PAGES'     // More than 10 pages
  | 'CONVERSION_FAILED'  // Rendering or IO error
  | 'IO_ERROR'           // File read/write failure
```

### Conversion Process

```
1. Size validation (≤ 20MB)
   ↓
2. PDF magic bytes check (%PDF header)
   ↓
3. Create temp directory (tmpdir/ella-pdf-{nanoid})
   ↓
4. Write PDF file to temp location
   ↓
5. Query pdf.info() → page count
   ↓
6. Check page limit (≤ 10 pages)
   ↓
7. pdf.convert() with 200 DPI rendering
   ↓
8. Read generated PNG files (page-1.png, page-2.png, ...)
   ↓
9. Return PdfPageImage[] with page numbers + buffers
   ↓
10. Cleanup temp directory (finally block)
```

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_PDF_SIZE_BYTES` | 20MB | Prevent memory exhaustion |
| `MAX_PAGES` | 10 | Limit simultaneous rendering |
| `RENDER_DPI` | 200 | OCR-quality resolution |
| `PDF_MAGIC_BYTES` | `[0x25, 0x50, 0x44, 0x46]` | "%PDF" header validation |

### Error Messages (Vietnamese)

| Error Type | Message |
|-----------|---------|
| INVALID_PDF | Tệp PDF không hợp lệ hoặc bị hỏng. |
| ENCRYPTED_PDF | Tệp PDF được bảo vệ bằng mật khẩu. Vui lòng gỡ mật khẩu trước khi tải lên. |
| TOO_LARGE | Tệp PDF quá lớn (tối đa 20MB). |
| TOO_MANY_PAGES | Tệp PDF có quá nhiều trang (tối đa 10 trang). |
| CONVERSION_FAILED | Không thể chuyển đổi PDF. Vui lòng thử lại hoặc tải lên hình ảnh. |
| IO_ERROR | Lỗi đọc/ghi tệp. Vui lòng thử lại. |

## Validation & Safety

### 1. Size Validation
- Checks buffer length before processing
- Hard limit: 20MB (returns TOO_LARGE error immediately)
- Prevents out-of-memory conditions

### 2. Format Validation
- Magic bytes check: First 4 bytes must be `[0x25, 0x50, 0x44, 0x46]` ("%PDF")
- Returns early for invalid PDFs without calling poppler
- CPU efficient: byte comparison before heavy processing

### 3. Encryption Detection
- Pattern matching on error messages
- Detects: "encrypt", "password", "permission" patterns
- Maps to specific ENCRYPTED_PDF error type
- User gets clear guidance to unlock PDF

### 4. Page Limit Enforcement
- Queries `pdf.info()` for page count
- Rejects immediately if `totalPages > MAX_PAGES` (10)
- Prevents infinite loops / memory leaks from malformed PDFs

### 5. Temp File Cleanup
- Creates unique temp directory per conversion (nanoid)
- Always cleans up in finally block:
  ```typescript
  try {
    await fs.rm(tempDir, { recursive: true, force: true })
  } catch {
    console.warn(`[PDF] Failed to cleanup temp dir: ${tempDir}`)
  }
  ```
- Resilient: continues if cleanup fails (logged but not fatal)
- Safety: force: true prevents errors on partial directories

## Public API

### Main Function

```typescript
import { convertPdfToImages } from '@ella/api/src/services/pdf'

const result = await convertPdfToImages(pdfBuffer)
if (result.success) {
  for (const page of result.pages!) {
    console.log(`Page ${page.pageNumber}: ${page.buffer.length} bytes`)
    // Send to OCR processing...
  }
} else {
  console.error(`[${result.errorType}] ${result.error}`)
}
```

### Helper Functions

```typescript
// Get Vietnamese message for error type
getPdfErrorMessage(errorType: PdfErrorType): string

// Check if MIME type is PDF
isPdfMimeType(mimeType: string): boolean  // Checks: application/pdf
```

## Integration Points

### With Portal Upload

When processing uploaded PDFs in `POST /portal/:token/upload`:

```typescript
import { convertPdfToImages, isPdfMimeType } from '@ella/api/src/services/pdf'

// Check if file is PDF
if (isPdfMimeType(file.type)) {
  const conversionResult = await convertPdfToImages(fileBuffer)

  if (!conversionResult.success) {
    // Return error to client (Vietnamese message included)
    return c.json({
      success: false,
      error: conversionResult.error,
      errorType: conversionResult.errorType
    }, 400)
  }

  // Process each page as separate RawImage
  for (const page of conversionResult.pages!) {
    const rawImage = await prisma.rawImage.create({
      data: {
        caseId,
        r2Key: `case-${caseId}/page-${page.pageNumber}.png`,
        filename: `${originalFilename}-page-${page.pageNumber}.png`,
        fileSize: page.buffer.length,
        // ... rest of fields
      }
    })

    // Upload PNG to R2 storage
    await uploadToR2(page.buffer, rawImage.r2Key, page.mimeType)
  }
}
```

### With AI Error Messages

PDF errors are integrated into the unified error handling system. Error types are mapped in `src/services/ai/ai-error-messages.ts`:

```typescript
export type AIErrorType =
  | 'PDF_INVALID'          // Maps to INVALID_PDF
  | 'PDF_ENCRYPTED'        // Maps to ENCRYPTED_PDF
  | 'PDF_TOO_LARGE'        // Maps to TOO_LARGE
  | 'PDF_CONVERSION_FAILED' // Maps to CONVERSION_FAILED
  // ... other error types
```

This allows unified error handling across all document processing operations.

## Dependencies

### Runtime
- `pdf-poppler` - PDF rendering library
- `nanoid` - Unique temp directory naming
- Node.js `fs/promises` - Async file operations
- Node.js `os` - Platform-specific temp directory

### Development
- `vitest` - Unit testing
- TypeScript

## Platform Requirements

### Windows
- **Status:** Supported
- **Poppler:** Bundled with `pdf-poppler` package
- **Installation:** `npm install pdf-poppler` (includes Windows binaries)
- **Notes:** No additional setup required

### Linux (Production)
- **Status:** Supported
- **System Package Required:** `poppler-utils`

**Installation:**

```bash
# Ubuntu/Debian
apt-get update && apt-get install -y poppler-utils

# CentOS/RHEL
yum install -y poppler-utils

# Alpine (if using containerized deployments)
apk add --no-cache poppler-utils
```

**Verification:**
```bash
pdfinfo --version   # Should show version info
pdftoppm --version  # Should show version info
```

### macOS
- **Status:** Supported
- **Installation:**
```bash
brew install poppler
```

## Testing

### Test Coverage

**File:** `apps/api/src/services/pdf/__tests__/pdf-converter.test.ts`

**Test Suite:** 8 tests covering:

1. **Single Page Conversion**
   - Valid 1-page PDF → success with PdfPageImage

2. **Multi-Page Conversion**
   - Valid 3-page PDF → success with all pages numbered correctly

3. **Invalid PDF Detection**
   - Wrong magic bytes → INVALID_PDF error (no poppler call)

4. **Size Validation**
   - 25MB buffer → TOO_LARGE error (no poppler call)

5. **Page Limit Enforcement**
   - 15-page PDF → TOO_MANY_PAGES error

6. **Encryption Detection**
   - poppler error containing "encrypt" → ENCRYPTED_PDF error

7. **IO Error Handling**
   - File read failure → CONVERSION_FAILED error

8. **Temp Directory Cleanup**
   - Cleanup called in finally block (even on errors)

### Running Tests

```bash
# Run PDF converter tests only
pnpm -F @ella/api test pdf-converter

# Run all API service tests
pnpm -F @ella/api test

# Run with coverage
pnpm -F @ella/api test -- --coverage
```

### Test Examples

```typescript
// Test: Single page conversion
it('converts single page PDF successfully', async () => {
  mockPdfInfo.mockResolvedValueOnce({ pages: 1 })
  mockPdfConvert.mockResolvedValueOnce(undefined)
  mockFsReadFile.mockResolvedValueOnce(createMockPngBuffer())

  const result = await convertPdfToImages(createValidPdfBuffer())

  expect(result.success).toBe(true)
  expect(result.pages).toHaveLength(1)
  expect(result.pages![0].pageNumber).toBe(1)
  expect(result.pages![0].mimeType).toBe('image/png')
})

// Test: Invalid PDF rejection
it('rejects invalid PDF (wrong magic bytes)', async () => {
  const result = await convertPdfToImages(createInvalidBuffer())

  expect(result.success).toBe(false)
  expect(result.errorType).toBe('INVALID_PDF')
  expect(mockPdfInfo).not.toHaveBeenCalled()  // Early return, no processing
})
```

## Mocking Strategy

For testing without actual file system operations:

```typescript
vi.mock('pdf-poppler', () => ({
  info: vi.fn(),      // Mock PDF info query
  convert: vi.fn(),   // Mock PDF rendering
}))

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),     // Mock directory creation
  writeFile: vi.fn(), // Mock file write
  readFile: vi.fn(),  // Mock file read
  rm: vi.fn(),        // Mock cleanup
}))
```

## Performance Characteristics

| Operation | Typical Duration |
|-----------|------------------|
| Size check | < 1ms |
| Magic bytes validation | < 1ms |
| PDF info query | 50-200ms |
| Single page rendering (200 DPI) | 200-500ms |
| 3-page batch | 600-1500ms |
| 10-page batch | 2000-5000ms |
| Temp cleanup | < 50ms |
| **Total (3-page PDF)** | **~1-2 seconds** |

**Notes:**
- Times vary with PDF complexity and system load
- DPI 200 is optimal for OCR (higher = slower, lower = worse recognition)
- Processing is CPU-bound (poppler rendering) not I/O-bound
- Temp directory cleanup is negligible overhead

## Deployment Checklist

### Pre-Deployment

- [ ] Verify `poppler-utils` installed on target Linux servers
- [ ] Test PDF conversion with sample documents
- [ ] Verify temp directory permissions (`/tmp` writeable)
- [ ] Check disk space (ensure 100MB+ available for temp files)
- [ ] Monitor CPU usage during peak hours

### Post-Deployment

- [ ] Monitor error logs for PDF conversion failures
- [ ] Verify temp directory cleanup (no stale directories)
- [ ] Test with encrypted PDFs (should return proper error)
- [ ] Test with oversized PDFs (should return proper error)
- [ ] Monitor performance metrics

### Troubleshooting

**Error: "poppler-utils not found" on Linux**
```bash
# Install missing dependency
apt-get install poppler-utils

# Verify installation
pdfinfo --version
```

**Error: "Permission denied" on temp cleanup**
- Check `/tmp` directory permissions: `chmod 1777 /tmp`
- Verify application process has write access to `/tmp`

**Error: "PDF conversion timeout"**
- Check system CPU load
- Verify disk I/O not bottlenecked
- Consider lowering DPI if OCR accuracy acceptable

**Stale temp directories accumulating**
- Verify finally block is executing (check error logs)
- Check disk space (full disk may prevent cleanup)
- Manual cleanup: `rm -rf /tmp/ella-pdf-*`

## Future Enhancements

1. **Batch Processing Optimization**
   - Process multiple PDFs concurrently (with connection pooling)

2. **OCR Direct Integration**
   - Skip PNG intermediate step, send buffer directly to OCR

3. **Configurable DPI**
   - Allow per-document DPI selection (faster for simple forms)

4. **Page Range Selection**
   - Allow processing subset of pages (e.g., first 3 pages only)

5. **Caching**
   - Cache conversion results for identical PDFs (by hash)

6. **Performance Metrics**
   - Track DPI vs OCR accuracy correlation
   - Monitor processing time per page complexity

## Related Documentation

- [System Architecture - Document Upload Flow](./system-architecture.md#document-upload-flow-portal---magic-link)
- [Phase 02 AI Error Messages](./phase-04-ai-error-messages.md)
- [Code Standards - AI Services](./code-standards.md#ai-services-ellaapiPhase-21)

## Files Modified/Created

**New Files:**
- `apps/api/src/services/pdf/pdf-converter.ts` - Core service (~220 LOC)
- `apps/api/src/services/pdf/index.ts` - Public exports
- `apps/api/src/types/pdf-poppler.d.ts` - Type definitions (~50 LOC)
- `apps/api/src/services/pdf/__tests__/pdf-converter.test.ts` - Unit tests (~140 LOC)

**Modified Files:**
- `apps/api/src/services/ai/ai-error-messages.ts` - Added PDF error types
- `apps/api/package.json` - Added `pdf-poppler` dependency

---

**Last Updated:** 2026-01-16
**Phase:** Phase 01 - PDF Converter Service (Complete)
**Architecture Version:** 6.3
