/**
 * ImageViewer - Zoomable, pannable, rotatable image/PDF viewer
 * Uses react-zoom-pan-pinch for smooth pan/zoom/pinch gestures
 * Features: zoom (0.5-4x), pan, rotation, PDF page navigation
 */

import { useState, useCallback, lazy, Suspense } from 'react'
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch'
import { cn } from '@ella/ui'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'

// Lazy load PDF components to reduce initial bundle size
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

// Zoom configuration
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

// Controls component that uses the transform context
function ViewerControls({
  zoom,
  onRotate,
  showControls,
}: {
  zoom: number
  onRotate: () => void
  showControls: boolean
}) {
  const { zoomIn, zoomOut, resetTransform } = useControls()

  if (!showControls) return null

  return (
    <div
      className="absolute top-2 right-2 z-10 flex gap-1 bg-black/70 rounded-full px-2 py-1"
      role="toolbar"
      aria-label="Điều khiển xem ảnh"
    >
      <button
        onClick={() => zoomOut(ZOOM_STEP)}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Thu nhỏ"
        title="Thu nhỏ (-)"
      >
        <ZoomOut className="h-4 w-4 text-white" />
      </button>
      <span
        className="text-white text-xs flex items-center min-w-[3rem] justify-center font-medium"
        aria-live="polite"
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => zoomIn(ZOOM_STEP)}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Phóng to"
        title="Phóng to (+)"
      >
        <ZoomIn className="h-4 w-4 text-white" />
      </button>
      <div className="w-px bg-white/30 mx-1" aria-hidden="true" />
      <button
        onClick={() => resetTransform()}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Đặt lại"
        title="Đặt lại (0)"
      >
        <Maximize2 className="h-4 w-4 text-white" />
      </button>
      <button
        onClick={onRotate}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Xoay"
        title="Xoay (R)"
      >
        <RotateCw className="h-4 w-4 text-white" />
      </button>
    </div>
  )
}

export function ImageViewer({
  imageUrl,
  isPdf = false,
  className,
  showControls = true,
}: ImageViewerProps) {
  const [rotation, setRotation] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentZoom, setCurrentZoom] = useState(1)

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
    <div className={cn('relative overflow-hidden bg-muted/50 rounded-lg', className)}>
      <TransformWrapper
        initialScale={1}
        minScale={MIN_ZOOM}
        maxScale={MAX_ZOOM}
        centerOnInit
        // Allow panning beyond boundaries when zoomed in (critical for viewing full document)
        limitToBounds={false}
        wheel={{ step: 0.2 }}
        doubleClick={{ mode: 'reset' }}
        panning={{ velocityDisabled: true }}
        onTransformed={(_, state) => {
          setCurrentZoom(state.scale)
        }}
      >
        {/* Controls toolbar */}
        <ViewerControls
          zoom={currentZoom}
          onRotate={handleRotate}
          showControls={showControls}
        />

        {/* Main content area */}
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="!w-full !h-full flex items-center justify-center"
        >
          {error && (
            <div className="flex items-center justify-center">
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
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: rotation ? `rotate(${rotation}deg)` : undefined,
                  imageRendering: 'crisp-edges',
                }}
                draggable={false}
                onError={() => setError('Không thể tải hình ảnh')}
              />
            )
          )}
        </TransformComponent>
      </TransformWrapper>

      {/* PDF page navigation */}
      {isPdf && numPages && numPages > 1 && showControls && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 rounded-full px-3 py-1.5 z-10"
          role="navigation"
          aria-label="Điều hướng trang PDF"
        >
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-1 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Trang trước"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          <span
            className="text-white text-xs min-w-[4rem] text-center font-medium"
            aria-live="polite"
          >
            {currentPage} / {numPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
            className="p-1 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Trang sau"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
