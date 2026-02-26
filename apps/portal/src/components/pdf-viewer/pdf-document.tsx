/**
 * PDF Document - Vertical scroll PDF viewer with all pages rendered
 * Features: fit-to-width, DPI scaling, scroll-based page tracking, smooth zoom
 * Optimized for mobile UX with natural scrolling
 */
import { Document, Page } from 'react-pdf'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react'
import { buttonVariants, cn } from '@ella/ui'

export interface PdfDocumentProps {
  url: string
  zoom?: number
  numPages: number
  onLoadSuccess: (numPages: number) => void
  onLoadError: () => void
  onPageChange?: (page: number) => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

export function PdfDocument({
  url,
  zoom = 1,
  numPages,
  onLoadSuccess,
  onLoadError,
  onPageChange,
  scrollContainerRef,
}: PdfDocumentProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
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

  // Track visible page during scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current
    if (!scrollContainer || numPages === 0) return

    const handleScroll = () => {
      const containerRect = scrollContainer.getBoundingClientRect()
      const containerCenter = containerRect.top + containerRect.height / 2

      let closestPage = 1
      let closestDistance = Infinity

      pageRefs.current.forEach((pageEl, pageNum) => {
        const pageRect = pageEl.getBoundingClientRect()
        const pageCenter = pageRect.top + pageRect.height / 2
        const distance = Math.abs(pageCenter - containerCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          closestPage = pageNum
        }
      })

      onPageChange?.(closestPage)
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [scrollContainerRef, numPages, onPageChange])

  // Calculate fit-to-width scale after first page renders
  const handlePageRenderSuccess = useCallback(() => {
    if (hasCalculatedFit.current) return

    const width = containerWidthRef.current
    if (width <= 0) return

    const canvas = containerRef.current?.querySelector('canvas')
    if (canvas) {
      const dpi = window.devicePixelRatio || 1
      const naturalWidth = canvas.width / (1 * dpi)
      const calculatedScale = width / naturalWidth
      setFitScale(calculatedScale)
      setIsCalculatingFit(false)
      hasCalculatedFit.current = true
    }
  }, [])

  const handleLoadSuccess = useCallback(
    ({ numPages: pages }: { numPages: number }) => {
      onLoadSuccess(pages)
    },
    [onLoadSuccess]
  )

  const handleLoadError = useCallback(
    (error: Error) => {
      console.error('PDF load error:', error.message)
      setHasError(true)
      onLoadError()
    },
    [onLoadError]
  )

  // DPI multiplier for crisp rendering
  const dpiMultiplier =
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  // Effective scale: fitScale * zoom * DPI
  const renderScale = fitScale * zoom * dpiMultiplier

  // Generate page numbers array for rendering
  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages]
  )

  // Store page ref for scroll tracking
  const setPageRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el)
    } else {
      pageRefs.current.delete(pageNum)
    }
  }, [])

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
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'default' }), 'gap-2')}
        >
          <ExternalLink className="w-4 h-4" />
          {t('draft.openInNewTab')}
        </a>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full relative">
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
        className="flex flex-col items-center gap-4 py-4 min-w-fit"
      >
        {pageNumbers.map((pageNum) => (
          <div
            key={pageNum}
            ref={(el) => setPageRef(pageNum, el)}
            data-page={pageNum}
            className="relative"
          >
            <Page
              pageNumber={pageNum}
              scale={renderScale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-md"
              onRenderSuccess={pageNum === 1 ? handlePageRenderSuccess : undefined}
              loading={
                <div className="w-full aspect-[8.5/11] max-w-[400px] bg-muted animate-pulse rounded" />
              }
            />
            {/* Watermark overlay per page */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
              <span
                className="text-[120px] font-bold text-gray-400/20 select-none whitespace-nowrap"
                style={{ transform: 'rotate(-30deg)' }}
              >
                Ella
              </span>
            </div>
          </div>
        ))}
      </Document>

      {/* Loading overlay while calculating fit scale */}
      {isCalculatingFit && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      )}
    </div>
  )
}
