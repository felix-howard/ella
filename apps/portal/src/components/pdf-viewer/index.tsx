/**
 * PDF Viewer - Mobile-first PDF rendering with vertical scrolling
 * Features: fit-to-width, DPI scaling, scroll-based page tracking, zoom controls
 * All pages rendered vertically for natural mobile scrolling experience
 */
import { pdfjs } from 'react-pdf'
import { useState, useCallback, useRef } from 'react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { PdfDocument } from './pdf-document'
import { PdfControls } from './pdf-controls'
import { useAutoHide } from './use-auto-hide'

// Configure PDF.js worker from unpkg CDN (matches workspace pattern)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.5

export interface PdfViewerProps {
  url: string
}

export function PdfViewer({ url }: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [zoom, setZoom] = useState(1)
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

  // Page change from scroll tracking
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  // Scroll to specific page
  const scrollToPage = useCallback((pageNum: number) => {
    show()
    const container = scrollContainerRef.current
    if (!container) return

    const pageEl = container.querySelector(`[data-page="${pageNum}"]`)
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [show])

  // Navigation handlers
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1)
    }
  }, [currentPage, scrollToPage])

  const handleNextPage = useCallback(() => {
    if (currentPage < numPages) {
      scrollToPage(currentPage + 1)
    }
  }, [currentPage, numPages, scrollToPage])

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    show()
    setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
  }, [show])

  const handleZoomOut = useCallback(() => {
    show()
    setZoom((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP))
  }, [show])

  const handleZoomReset = useCallback(() => {
    show()
    setZoom(1)
  }, [show])

  // Show controls on interaction
  const handleInteraction = useCallback(() => {
    show()
  }, [show])

  return (
    <div
      className="w-full h-full relative"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Scrollable PDF container - vertical scroll for all pages */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto overscroll-contain"
        style={{
          // Enable smooth scrolling and prevent pull-to-refresh
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <PdfDocument
          url={url}
          zoom={zoom}
          numPages={numPages}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          onPageChange={handlePageChange}
          scrollContainerRef={scrollContainerRef}
        />
      </div>

      {/* Floating controls with navigation and zoom */}
      {numPages > 0 && !hasError && (
        <PdfControls
          currentPage={currentPage}
          totalPages={numPages}
          zoom={zoom}
          visible={visible}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
        />
      )}
    </div>
  )
}

export default PdfViewer
