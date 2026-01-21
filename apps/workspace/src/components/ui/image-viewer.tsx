/**
 * ImageViewer - Zoomable, rotatable image/PDF viewer component
 * Features: zoom (1-3x), rotation, PDF page navigation
 * PDF rendering is lazy loaded to reduce bundle size
 */

import { useState, useCallback, useLayoutEffect, useRef, useEffect, lazy, Suspense } from 'react'
import { cn } from '@ella/ui'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'

// Lazy load PDF components to reduce initial bundle size (~150KB savings)
const PdfViewer = lazy(() => import('./pdf-viewer'))

export interface ImageViewerProps {
  /** Image or PDF URL to display */
  imageUrl: string | null
  /** Whether the file is a PDF */
  isPdf?: boolean
  /** Additional CSS classes */
  className?: string
  /** Show controls (default true) */
  showControls?: boolean
}

// Constants for zoom configuration
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

export function ImageViewer({
  imageUrl,
  isPdf = false,
  className,
  showControls = true,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Ref for scroll container to reset scroll position on load
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset scroll position when image URL changes or zoom resets to 1
  // useLayoutEffect for synchronous reset to avoid visual flicker
  useLayoutEffect(() => {
    if (containerRef.current) {
      // Only reset scroll when going back to 100% or loading new image
      if (zoom <= 1) {
        containerRef.current.scrollTop = 0
        containerRef.current.scrollLeft = 0
      }
    }
  }, [imageUrl, zoom])

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
  }, [])

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360)
  }, [])

  const handlePdfLoadSuccess = useCallback((pages: number) => {
    setNumPages(pages)
    setError(null)
  }, [])

  const handlePdfLoadError = useCallback(() => {
    setError('Không thể tải file PDF')
  }, [])

  const handlePrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    if (numPages) {
      setCurrentPage((p) => Math.min(numPages, p + 1))
    }
  }, [numPages])

  // Ctrl+scroll wheel zoom handler
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      // Only zoom when Ctrl (or Cmd on Mac) is pressed
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        // deltaY negative = scroll up = zoom in, positive = scroll down = zoom out
        if (e.deltaY < 0) {
          setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
        } else {
          setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
        }
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Empty state
  if (!imageUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted rounded-lg',
          className
        )}
        role="img"
        aria-label="Không có hình ảnh"
      >
        <p className="text-muted-foreground text-sm">Không có hình ảnh</p>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden bg-muted rounded-lg', className)}>
      {/* Controls toolbar */}
      {showControls && (
        <div
          className="absolute top-2 right-2 z-10 flex gap-1 bg-black/60 rounded-full px-2 py-1"
          role="toolbar"
          aria-label="Điều khiển xem ảnh"
        >
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Thu nhỏ"
            title="Thu nhỏ"
          >
            <ZoomOut className="h-4 w-4 text-white" />
          </button>
          <span
            className="text-white text-xs flex items-center min-w-[3rem] justify-center"
            aria-live="polite"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Phóng to"
            title="Phóng to"
          >
            <ZoomIn className="h-4 w-4 text-white" />
          </button>
          <div className="w-px bg-white/30 mx-1" aria-hidden="true" />
          <button
            onClick={handleRotate}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Xoay"
            title="Xoay"
          >
            <RotateCw className="h-4 w-4 text-white" />
          </button>
        </div>
      )}

      {/* Main content area - scrollable in both directions when zoomed */}
      <div ref={containerRef} className="w-full h-full overflow-auto">
        <div
          className={cn(
            'min-w-full min-h-full flex p-4',
            // Center only when not zoomed, allow scroll from top-left when zoomed
            zoom <= 1 ? 'items-center justify-center' : 'items-start justify-start'
          )}
        >
        {error && (
          <div className="text-center p-4" role="alert">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {!error && isPdf ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              </div>
            }
          >
            <PdfViewer
              fileUrl={imageUrl}
              zoom={zoom}
              rotation={rotation}
              currentPage={currentPage}
              onLoadSuccess={handlePdfLoadSuccess}
              onLoadError={handlePdfLoadError}
            />
          </Suspense>
        ) : (
          !error && (
            <img
              src={imageUrl}
              alt="Document preview"
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                // Use top-left origin when zoomed for proper scroll, center when not zoomed
                transformOrigin: zoom > 1 ? 'top left' : 'center',
              }}
              draggable={false}
              onError={() => setError('Không thể tải hình ảnh')}
            />
          )
        )}
        </div>
      </div>

      {/* PDF page navigation */}
      {isPdf && numPages && numPages > 1 && showControls && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5"
          role="navigation"
          aria-label="Điều hướng trang PDF"
        >
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-1 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Trang trước"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          <span
            className="text-white text-xs min-w-[4rem] text-center"
            aria-live="polite"
          >
            {currentPage} / {numPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
            className="p-1 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Trang sau"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
