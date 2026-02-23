/**
 * ImageViewer - Zoomable, pannable, rotatable image/PDF viewer
 * PDF Desktop: Uses native iframe (zero bundle, native controls)
 * PDF Mobile: Uses react-pdf with DPI scaling (fit-to-width)
 * Images: Uses react-zoom-pan-pinch for smooth gestures
 */

import { useState, useCallback, useRef, lazy, Suspense } from 'react'
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
import { useIsMobile } from '../../hooks'

// Lazy load PDF components to reduce initial bundle size
const PdfViewer = lazy(() => import('./pdf-viewer'))
const PdfViewerDesktop = lazy(() => import('./pdf-viewer-desktop'))

/**
 * Detect iOS Safari - iframe PDFs don't render properly on iOS
 * Must use react-pdf for iOS devices regardless of viewport size
 */
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

export interface ImageViewerProps {
  /** Image or PDF URL to display */
  imageUrl: string | null
  /** Whether the file is a PDF */
  isPdf?: boolean
  /** Additional CSS classes */
  className?: string
  /** Show controls (default true) */
  showControls?: boolean
  /** Initial rotation (persisted from DB) */
  initialRotation?: 0 | 90 | 180 | 270
  /** Callback when rotation changes (to persist to DB) */
  onRotationChange?: (rotation: 0 | 90 | 180 | 270) => void
}

// Zoom configuration
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

// PDF zoom controls (standalone, no TransformWrapper context)
function PdfControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onRotate,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onRotate: () => void
}) {
  return (
    <div
      className="absolute top-2 right-2 z-10 flex gap-1 bg-black/70 rounded-full px-2 py-1"
      role="toolbar"
      aria-label="Điều khiển xem PDF"
    >
      <button
        onClick={onZoomOut}
        disabled={zoom <= MIN_ZOOM}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
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
        onClick={onZoomIn}
        disabled={zoom >= MAX_ZOOM}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
        aria-label="Phóng to"
        title="Phóng to (+)"
      >
        <ZoomIn className="h-4 w-4 text-white" />
      </button>
      <div className="w-px bg-white/30 mx-1" aria-hidden="true" />
      <button
        onClick={onReset}
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

// Image controls (uses TransformWrapper context)
function ImageControls({
  zoom,
  onRotate,
}: {
  zoom: number
  onRotate: () => void
}) {
  const { zoomIn, zoomOut, resetTransform } = useControls()

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
  initialRotation = 0,
  onRotationChange,
}: ImageViewerProps) {
  // Platform detection (hooks must be at top level)
  const isMobile = useIsMobile()
  const isIOS = isIOSSafari()
  // Force mobile viewer on mobile devices or iOS (iframe PDFs don't work on iOS)
  const useMobileViewer = isMobile || isIOS

  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(initialRotation)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfZoom, setPdfZoom] = useState(1)
  const [imageZoom, setImageZoom] = useState(1)

  const handleRotate = useCallback(() => {
    setRotation((r) => {
      const newRotation = ((r + 90) % 360) as 0 | 90 | 180 | 270
      // Notify parent to persist rotation
      onRotationChange?.(newRotation)
      return newRotation
    })
  }, [onRotationChange])

  const handlePdfZoomIn = useCallback(() => {
    setPdfZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  }, [])

  const handlePdfZoomOut = useCallback(() => {
    setPdfZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
  }, [])

  const handlePdfZoomReset = useCallback(() => {
    setPdfZoom(1)
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

  // Handle mouse wheel zoom for PDF (mobile only)
  const handlePdfWheel = useCallback(
    (e: React.WheelEvent) => {
      // Only zoom when Ctrl is NOT pressed (native scroll when Ctrl+wheel)
      // deltaY < 0 = scroll up = zoom in, deltaY > 0 = scroll down = zoom out
      if (e.ctrlKey) return // Let browser handle Ctrl+wheel (native zoom)

      e.preventDefault()
      if (e.deltaY < 0) {
        setPdfZoom((z) => Math.min(MAX_ZOOM, z + 0.2))
      } else {
        setPdfZoom((z) => Math.max(MIN_ZOOM, z - 0.2))
      }
    },
    []
  )

  // Drag-to-pan for PDF viewer (mobile only)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  const handlePdfMouseDown = useCallback((e: React.MouseEvent) => {
    if (!pdfContainerRef.current) return
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: pdfContainerRef.current.scrollLeft,
      scrollTop: pdfContainerRef.current.scrollTop,
    }
  }, [])

  const handlePdfMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !pdfContainerRef.current) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      pdfContainerRef.current.scrollLeft = dragStart.current.scrollLeft - dx
      pdfContainerRef.current.scrollTop = dragStart.current.scrollTop - dy
    },
    [isDragging]
  )

  const handlePdfMouseUp = useCallback(() => {
    setIsDragging(false)
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

  // PDF Viewer - platform-aware routing
  // Desktop: Native iframe (zero bundle, native controls)
  // Mobile/iOS: react-pdf with DPI scaling
  if (isPdf) {
    return (
      <div className={cn('relative overflow-hidden bg-muted/50 rounded-lg', className)}>
        {/* PDF Controls - only show for mobile viewer (desktop has its own rotate button) */}
        {showControls && useMobileViewer && (
          <PdfControls
            zoom={pdfZoom}
            onZoomIn={handlePdfZoomIn}
            onZoomOut={handlePdfZoomOut}
            onReset={handlePdfZoomReset}
            onRotate={handleRotate}
          />
        )}

        {/* Platform-specific PDF viewer */}
        <div
          ref={pdfContainerRef}
          className={cn(
            'w-full h-full overflow-auto select-none',
            // Only show grab cursor on mobile (desktop uses native scroll)
            useMobileViewer && (isDragging ? 'cursor-grabbing' : 'cursor-grab')
          )}
          // Only attach drag/wheel handlers for mobile viewer
          onWheel={useMobileViewer ? handlePdfWheel : undefined}
          onMouseDown={useMobileViewer ? handlePdfMouseDown : undefined}
          onMouseMove={useMobileViewer ? handlePdfMouseMove : undefined}
          onMouseUp={useMobileViewer ? handlePdfMouseUp : undefined}
          onMouseLeave={useMobileViewer ? handlePdfMouseUp : undefined}
        >
          {error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-error text-sm">{error}</p>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                </div>
              }
            >
              {useMobileViewer ? (
                <PdfViewer
                  fileUrl={imageUrl}
                  scale={pdfZoom}
                  rotation={rotation}
                  currentPage={currentPage}
                  onLoadSuccess={handlePdfLoadSuccess}
                  onLoadError={handlePdfLoadError}
                  fitToWidth
                />
              ) : (
                <PdfViewerDesktop
                  fileUrl={imageUrl}
                  rotation={rotation as 0 | 90 | 180 | 270}
                  onRotate={handleRotate}
                  showControls={showControls}
                />
              )}
            </Suspense>
          )}
        </div>

        {/* PDF page navigation - mobile only (desktop has native nav) */}
        {useMobileViewer && numPages && numPages > 1 && showControls && (
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

  // Image Viewer - uses react-zoom-pan-pinch (CSS transform OK for images)
  return (
    <div className={cn('relative overflow-hidden bg-muted/50 rounded-lg', className)}>
      <TransformWrapper
        initialScale={1}
        minScale={MIN_ZOOM}
        maxScale={MAX_ZOOM}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.2 }}
        doubleClick={{ mode: 'reset' }}
        panning={{ velocityDisabled: true }}
        onTransformed={(_, state) => {
          setImageZoom(state.scale)
        }}
      >
        {showControls && (
          <ImageControls zoom={imageZoom} onRotate={handleRotate} />
        )}

        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="!w-full !h-full flex items-center justify-center"
        >
          {error ? (
            <div className="flex items-center justify-center">
              <p className="text-error text-sm">{error}</p>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt="Document preview"
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
              }}
              draggable={false}
              onError={() => setError('Không thể tải hình ảnh')}
            />
          )}
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
