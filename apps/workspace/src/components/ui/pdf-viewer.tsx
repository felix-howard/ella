/**
 * PdfViewer - PDF rendering with native scale-based zoom (always crisp)
 * Uses react-pdf scale prop for re-rendering at zoom resolution
 * Lazy loaded to avoid bundling react-pdf (~150KB) for non-PDF users
 */

import { Document, Page, pdfjs } from 'react-pdf'
import { Loader2 } from 'lucide-react'

// Configure PDF.js worker from unpkg (serves npm packages directly)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export interface PdfViewerProps {
  /** PDF file URL */
  fileUrl: string
  /** Zoom scale (1 = 100%, 2 = 200%, etc.) */
  scale: number
  /** Rotation in degrees */
  rotation: number
  /** Current page number */
  currentPage: number
  /** Callback when PDF loads successfully */
  onLoadSuccess: (numPages: number) => void
  /** Callback when PDF fails to load */
  onLoadError: () => void
}

export default function PdfViewer({
  fileUrl,
  scale,
  rotation,
  currentPage,
  onLoadSuccess,
  onLoadError,
}: PdfViewerProps) {
  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    onLoadSuccess(numPages)
  }

  const handleLoadError = (error: Error) => {
    console.error('PDF load error:', error.message)
    onLoadError()
  }

  // When zoomed > 1, use inline-block to allow full scroll range
  // When at 1x, center the content
  const isZoomed = scale > 1

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={handleLoadSuccess}
      onLoadError={handleLoadError}
      loading={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        </div>
      }
      className={isZoomed ? 'inline-block' : 'flex justify-center'}
    >
      <Page
        pageNumber={currentPage}
        scale={scale}
        rotate={rotation}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="shadow-md"
        loading={
          <div className="w-[400px] h-[550px] bg-muted animate-pulse rounded" />
        }
      />
    </Document>
  )
}
