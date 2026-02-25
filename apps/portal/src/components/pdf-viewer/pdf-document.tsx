/**
 * PDF Document - Core react-pdf wrapper with fit-to-width and DPI scaling
 * Renders single page at a time for mobile UX
 * Uses ResizeObserver for responsive fit-to-width calculation
 */
import { Document, Page } from 'react-pdf'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertTriangle, ExternalLink, FileDown } from 'lucide-react'
import { buttonVariants, cn } from '@ella/ui'

export interface PdfDocumentProps {
  url: string
  filename: string
  currentPage: number
  zoom?: number
  gestureBindings?: ReturnType<() => Record<string, unknown>>
  onLoadSuccess: (numPages: number) => void
  onLoadError: () => void
}

export function PdfDocument({
  url,
  filename,
  currentPage,
  zoom = 1,
  gestureBindings,
  onLoadSuccess,
  onLoadError,
}: PdfDocumentProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidthRef = useRef<number>(0)

  const [fitScale, setFitScale] = useState<number>(1)
  const [isCalculatingFit, setIsCalculatingFit] = useState(true)
  const [hasError, setHasError] = useState(false)
  const hasCalculatedFit = useRef(false)

  // Track container width via ResizeObserver
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

  // Calculate fit-to-width scale after page renders
  const handlePageRenderSuccess = useCallback(() => {
    if (hasCalculatedFit.current) return

    const width = containerWidthRef.current
    if (width <= 0) return

    // Get the rendered canvas to calculate natural dimensions
    const canvas = containerRef.current?.querySelector('canvas')
    if (canvas) {
      const dpi = window.devicePixelRatio || 1
      // Natural width at scale 1 (current scale is applied)
      const naturalWidth = canvas.width / (1 * dpi)
      const calculatedScale = width / naturalWidth
      setFitScale(calculatedScale)
      setIsCalculatingFit(false)
      hasCalculatedFit.current = true
    }
  }, [])

  // Handle document load success
  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      onLoadSuccess(numPages)
    },
    [onLoadSuccess]
  )

  // Handle document load error
  const handleLoadError = useCallback(
    (error: Error) => {
      console.error('PDF load error:', error.message)
      setHasError(true)
      onLoadError()
    },
    [onLoadError]
  )

  // DPI multiplier for crisp rendering on retina displays
  const dpiMultiplier =
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  // Effective scale: fitScale * zoom * DPI
  const renderScale = fitScale * zoom * dpiMultiplier

  // Error state - show fallback UI
  if (hasError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-muted/30 h-full">
        <AlertTriangle className="w-12 h-12 text-warning mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {t('draft.viewerUnsupported')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          {t('draft.viewerFallback')}
        </p>
        <div className="flex gap-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
          >
            <ExternalLink className="w-4 h-4" />
            {t('draft.openInNewTab')}
          </a>
          <a
            href={url}
            download={filename}
            className={cn(buttonVariants({ variant: 'default' }), 'gap-2')}
          >
            <FileDown className="w-4 h-4" />
            {t('draft.download')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ touchAction: 'none' }}
      {...(gestureBindings || {})}
    >
      <Document
        file={url}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleLoadError}
        loading={
          <div className="flex items-center justify-center py-8 h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('draft.loadingPdf')}</p>
            </div>
          </div>
        }
        className="flex justify-center"
      >
        <Page
          pageNumber={currentPage}
          scale={renderScale}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="shadow-md"
          onRenderSuccess={handlePageRenderSuccess}
          loading={
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
