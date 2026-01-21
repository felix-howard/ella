/**
 * PDF Converter Service
 * Converts PDF documents to PNG images for OCR processing
 * Uses pdf-poppler for high-quality rendering
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { nanoid } from 'nanoid'
import * as pdf from 'pdf-poppler'

// Constants
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024 // 20MB
const MAX_PAGES = 10 // Limit pages for memory safety
// pdf-poppler's scale option is -scale-to (pixel box), NOT DPI
// For OCR quality on letter-size (8.5x11in), we need ~2400px for 200 DPI equivalent
// 11in * 200 DPI = 2200px, round up to 2400 for margin
const RENDER_SCALE = 2400
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46] // %PDF

/**
 * PDF conversion error types
 */
export type PdfErrorType =
  | 'INVALID_PDF'
  | 'ENCRYPTED_PDF'
  | 'TOO_LARGE'
  | 'TOO_MANY_PAGES'
  | 'CONVERSION_FAILED'
  | 'IO_ERROR'

/**
 * Single page image result
 */
export interface PdfPageImage {
  pageNumber: number
  buffer: Buffer
  mimeType: 'image/png'
}

/**
 * PDF conversion result
 */
export interface PdfConversionResult {
  success: boolean
  pages?: PdfPageImage[]
  totalPages?: number
  error?: string
  errorType?: PdfErrorType
  processingTimeMs?: number
}

/**
 * Vietnamese error messages for PDF errors
 */
const PDF_ERROR_MESSAGES: Record<PdfErrorType, string> = {
  INVALID_PDF: 'Tệp PDF không hợp lệ hoặc bị hỏng.',
  ENCRYPTED_PDF: 'Tệp PDF được bảo vệ bằng mật khẩu. Vui lòng gỡ mật khẩu trước khi tải lên.',
  TOO_LARGE: 'Tệp PDF quá lớn (tối đa 20MB).',
  TOO_MANY_PAGES: `Tệp PDF có quá nhiều trang (tối đa ${MAX_PAGES} trang).`,
  CONVERSION_FAILED: 'Không thể chuyển đổi PDF. Vui lòng thử lại hoặc tải lên hình ảnh.',
  IO_ERROR: 'Lỗi đọc/ghi tệp. Vui lòng thử lại.',
}

/**
 * Validate PDF buffer using magic bytes
 */
function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < PDF_MAGIC_BYTES.length) return false
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (buffer[i] !== PDF_MAGIC_BYTES[i]) return false
  }
  return true
}

/**
 * Check if error indicates encrypted PDF
 */
function isEncryptedPdfError(error: Error): boolean {
  const msg = error.message.toLowerCase()
  return msg.includes('encrypt') || msg.includes('password') || msg.includes('permission')
}

/**
 * Convert PDF buffer to PNG image buffers
 * @param pdfBuffer - PDF file as Buffer
 * @returns Conversion result with page images or error
 */
export async function convertPdfToImages(pdfBuffer: Buffer): Promise<PdfConversionResult> {
  const startTime = Date.now()

  // Validate size
  if (pdfBuffer.length > MAX_PDF_SIZE_BYTES) {
    return {
      success: false,
      error: PDF_ERROR_MESSAGES.TOO_LARGE,
      errorType: 'TOO_LARGE',
      processingTimeMs: Date.now() - startTime,
    }
  }

  // Validate PDF format
  if (!isPdfBuffer(pdfBuffer)) {
    return {
      success: false,
      error: PDF_ERROR_MESSAGES.INVALID_PDF,
      errorType: 'INVALID_PDF',
      processingTimeMs: Date.now() - startTime,
    }
  }

  // Create temp directory for conversion
  const tempId = nanoid(10)
  const tempDir = path.join(os.tmpdir(), `ella-pdf-${tempId}`)
  const pdfPath = path.join(tempDir, 'input.pdf')

  try {
    // Create temp directory and write PDF
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(pdfPath, pdfBuffer)

    // Get PDF info (page count)
    const info = await pdf.info(pdfPath)
    const totalPages = info.pages || 1

    // Check page limit
    if (totalPages > MAX_PAGES) {
      return {
        success: false,
        totalPages,
        error: PDF_ERROR_MESSAGES.TOO_MANY_PAGES,
        errorType: 'TOO_MANY_PAGES',
        processingTimeMs: Date.now() - startTime,
      }
    }

    // Convert PDF to PNG images
    // Note: scale is -scale-to (pixel box), not DPI
    const options: pdf.Options = {
      format: 'png',
      scale: RENDER_SCALE,
      out_dir: tempDir,
      out_prefix: 'page',
    }

    await pdf.convert(pdfPath, options)

    // Read generated PNG files
    const pages: PdfPageImage[] = []
    for (let i = 1; i <= totalPages; i++) {
      // pdf-poppler outputs: page-1.png, page-2.png, etc.
      const pngPath = path.join(tempDir, `page-${i}.png`)
      try {
        const buffer = await fs.readFile(pngPath)
        pages.push({
          pageNumber: i,
          buffer,
          mimeType: 'image/png',
        })
      } catch {
        // Skip missing pages (shouldn't happen)
        console.warn(`[PDF] Missing page ${i} after conversion`)
      }
    }

    if (pages.length === 0) {
      return {
        success: false,
        error: PDF_ERROR_MESSAGES.CONVERSION_FAILED,
        errorType: 'CONVERSION_FAILED',
        processingTimeMs: Date.now() - startTime,
      }
    }

    return {
      success: true,
      pages,
      totalPages,
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error')

    // Check for encrypted PDF
    if (isEncryptedPdfError(err)) {
      return {
        success: false,
        error: PDF_ERROR_MESSAGES.ENCRYPTED_PDF,
        errorType: 'ENCRYPTED_PDF',
        processingTimeMs: Date.now() - startTime,
      }
    }

    console.error('[PDF] Conversion error:', err.message)
    return {
      success: false,
      error: PDF_ERROR_MESSAGES.CONVERSION_FAILED,
      errorType: 'CONVERSION_FAILED',
      processingTimeMs: Date.now() - startTime,
    }
  } finally {
    // Cleanup temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      console.warn(`[PDF] Failed to cleanup temp dir: ${tempDir}`)
    }
  }
}

/**
 * Get Vietnamese error message for PDF error type
 */
export function getPdfErrorMessage(errorType: PdfErrorType): string {
  return PDF_ERROR_MESSAGES[errorType] || PDF_ERROR_MESSAGES.CONVERSION_FAILED
}

/**
 * Check if MIME type is PDF
 */
export function isPdfMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

/**
 * Poppler availability status
 */
export interface PopplerStatus {
  installed: boolean
  error?: string
  checkedAt: string
}

// Cached poppler status
let popplerStatusCache: PopplerStatus | null = null

/**
 * Check if poppler is installed and available
 * Result is cached for performance
 */
export async function checkPopplerInstalled(): Promise<PopplerStatus> {
  // Return cached result if available
  if (popplerStatusCache) {
    return popplerStatusCache
  }

  try {
    // Attempt a minimal PDF info call to verify poppler works
    // Create a minimal valid PDF to test
    const minimalPdf = Buffer.from(
      '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
        '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
        'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n' +
        '0000000052 00000 n \n0000000101 00000 n \n' +
        'trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
    )

    const tempDir = path.join(os.tmpdir(), `ella-poppler-check-${nanoid(6)}`)
    const testPdfPath = path.join(tempDir, 'test.pdf')

    try {
      await fs.mkdir(tempDir, { recursive: true })
      await fs.writeFile(testPdfPath, minimalPdf)
      await pdf.info(testPdfPath)

      popplerStatusCache = {
        installed: true,
        checkedAt: new Date().toISOString(),
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PDF] Poppler check failed:', msg)
    popplerStatusCache = {
      installed: false,
      error: 'Poppler not installed. Install: apt-get install poppler-utils (Linux) or use bundled Windows binary.',
      checkedAt: new Date().toISOString(),
    }
  }

  return popplerStatusCache
}

/**
 * Get current poppler status (cached)
 */
export function getPopplerStatus(): PopplerStatus | null {
  return popplerStatusCache
}
