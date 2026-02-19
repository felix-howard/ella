/**
 * PdfViewer - Mobile PDF rendering with DPI-aware scaling
 * Features: fit-to-width default, devicePixelRatio scaling, scroll fix
 * Uses react-pdf scale prop for re-rendering at zoom resolution
 * Lazy loaded to avoid bundling react-pdf (~150KB) for non-PDF users
 */

import { Document, Page, pdfjs } from 'react-pdf'
import { Loader2 } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'

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
  /** Enable fit-to-width mode (calculates scale from container) */
  fitToWidth?: boolean
  /** Callback with calculated fit scale */
  onFitScaleCalculated?: (scale: number) => void
}

export default function PdfViewer({
  fileUrl,
  scale,
  rotation,
  currentPage,
  onLoadSuccess,
  onLoadError,
  fitToWidth = false,
  onFitScaleCalculated,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidthRef = useRef<number>(0)
  const [fitScale, setFitScale] = useState<number>(1)
  const [isCalculatingFit, setIsCalculatingFit] = useState(fitToWidth)
  const hasCalculatedFit = useRef(false)

  // Track container width via ref (avoids race condition)
  useEffect(() => {
    if (!containerRef.current) return

    const updateWidth = () => {
      if (containerRef.current) {
        containerWidthRef.current = containerRef.current.clientWidth
      }
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Calculate fit-to-width scale using Page's onRenderSuccess
  const handlePageRenderSuccess = useCallback(() => {
    if (!fitToWidth || hasCalculatedFit.current) return

    const width = containerWidthRef.current
    if (width <= 0) return

    // Use the rendered page canvas to get actual dimensions
    const canvas = containerRef.current?.querySelector('canvas')
    if (canvas) {
      // Get natural width at scale 1 (current scale is applied)
      const naturalWidth = canvas.width / (scale * (window.devicePixelRatio || 1))
      const calculatedScale = width / naturalWidth
      setFitScale(calculatedScale)
      setIsCalculatingFit(false)
      hasCalculatedFit.current = true
      onFitScaleCalculated?.(calculatedScale)
    }
  }, [fitToWidth, scale, onFitScaleCalculated])

  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      onLoadSuccess(numPages)
    },
    [onLoadSuccess]
  )

  const handleLoadError = useCallback(
    (error: Error) => {
      console.error('PDF load error:', error.message)
      onLoadError()
    },
    [onLoadError]
  )

  // DPI multiplier for crisp rendering on retina displays
  const dpiMultiplier =
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  // Effective scale: fitScale * user zoom * DPI
  // When fitToWidth enabled, fitScale is base, scale is multiplier (zoom)
  // When disabled, scale is absolute
  const baseScale = fitToWidth ? fitScale * scale : scale
  const renderScale = baseScale * dpiMultiplier

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <Document
        file={fileUrl}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleLoadError}
        loading={
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          </div>
        }
        className="inline-block"
      >
        <Page
          pageNumber={currentPage}
          scale={renderScale}
          rotate={rotation}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="shadow-md"
          onRenderSuccess={handlePageRenderSuccess}
          loading={
            // Responsive skeleton for mobile
            <div className="w-full aspect-[8.5/11] max-w-[400px] bg-muted animate-pulse rounded" />
          }
        />
      </Document>
      {/* Show loading overlay while calculating fit scale */}
      {isCalculatingFit && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      )}
    </div>
  )
}
