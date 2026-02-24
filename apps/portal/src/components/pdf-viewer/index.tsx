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
import { PdfControls } from './pdf-controls'
import { usePdfGestures } from './use-pdf-gestures'
import { useAutoHide } from './use-auto-hide'

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

  // Auto-hide controls after 3s inactivity
  const { visible, show } = useAutoHide({ delay: 3000 })

  // Handle document load success
  const handleLoadSuccess = useCallback((pages: number) => {
    setNumPages(pages)
  }, [])

  // Handle document load error
  const handleLoadError = useCallback(() => {
    setHasError(true)
  }, [])

  // Page change handler for gesture hook
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  // Gesture support - swipe, pinch, double-tap
  // onInteraction resets auto-hide timer
  const { bind, zoom } = usePdfGestures({
    currentPage,
    totalPages: numPages,
    onPageChange: handlePageChange,
    onInteraction: show,
  })

  // Handle tap to show controls
  const handleTap = useCallback(() => {
    show()
  }, [show])

  return (
    <div
      className="w-full h-full relative"
      onClick={handleTap}
      onTouchStart={handleTap}
    >
      {/* PDF Document - full viewport */}
      <div className="w-full h-full overflow-auto">
        <PdfDocument
          url={url}
          filename={filename}
          currentPage={currentPage}
          zoom={zoom}
          gestureBindings={bind()}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
        />
      </div>

      {/* Floating controls with auto-hide */}
      {numPages > 0 && !hasError && (
        <PdfControls
          currentPage={currentPage}
          totalPages={numPages}
          url={url}
          filename={filename}
          visible={visible}
        />
      )}
    </div>
  )
}

export default PdfViewer
