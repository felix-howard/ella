/**
 * PDF Viewer - Mobile-first PDF rendering with react-pdf
 * Features: fit-to-width, DPI scaling, gesture support (Phase 03), auto-hide controls (Phase 04)
 * Lazy loaded to avoid bundling react-pdf (~150KB) for non-PDF users
 */
import { pdfjs } from 'react-pdf'
import { useState, useCallback } from 'react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { PdfDocument } from './pdf-document'

// Configure PDF.js worker from unpkg CDN (matches workspace pattern)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export interface PdfViewerProps {
  url: string
  filename: string
}

export function PdfViewer({ url, filename }: PdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [hasError, setHasError] = useState(false)

  // Handle document load success
  const handleLoadSuccess = useCallback((pages: number) => {
    setNumPages(pages)
  }, [])

  // Handle document load error
  const handleLoadError = useCallback(() => {
    setHasError(true)
  }, [])

  // Page navigation handlers (used by gesture hook in Phase 03)
  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages))
  }, [numPages])

  const goToPrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }, [])

  return (
    <div className="w-full h-full flex flex-col">
      {/* PDF Document */}
      <div className="flex-1 min-h-0 overflow-auto">
        <PdfDocument
          url={url}
          filename={filename}
          currentPage={currentPage}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
        />
      </div>

      {/* Simple page indicator - will be replaced by PdfControls in Phase 04 */}
      {numPages > 0 && !hasError && (
        <div className="shrink-0 py-2 text-center border-t border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="px-3 py-1 text-sm rounded-md bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {numPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
              className="px-3 py-1 text-sm rounded-md bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PdfViewer
