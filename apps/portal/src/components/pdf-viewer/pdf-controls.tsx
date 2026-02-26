/**
 * PDF Controls - Navigation and zoom controls
 * Features: page indicator, prev/next buttons, zoom +/- buttons
 * Mobile-optimized with 44px minimum touch targets for accessibility
 */
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'

export interface PdfControlsProps {
  currentPage: number
  totalPages: number
  zoom: number
  visible: boolean
  onPrevPage: () => void
  onNextPage: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

export function PdfControls({
  currentPage,
  totalPages,
  zoom,
  visible,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: PdfControlsProps) {
  const { t } = useTranslation()
  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < totalPages
  const canZoomIn = zoom < 3
  const canZoomOut = zoom > 1
  const isZoomed = zoom !== 1
  const isMultiPage = totalPages > 1

  return (
    <>
      {/* Scroll hint - shown on page 1 of multi-page docs */}
      {isMultiPage && currentPage === 1 && visible && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs animate-pulse">
          {t('draft.scrollHint', { defaultValue: 'Scroll down for more pages' })}
        </div>
      )}

      {/* Page indicator pill with navigation - bottom center */}
      <div
        className={cn(
          'absolute bottom-4 left-1/2 -translate-x-1/2',
          'flex items-center gap-0.5',
          'px-1.5 py-1 rounded-full',
          'bg-black/70 backdrop-blur-sm',
          'transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Previous page button - 44px touch target */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPrevPage()
          }}
          disabled={!canGoPrev}
          aria-label="Previous page"
          className={cn(
            'w-11 h-11 flex items-center justify-center rounded-full transition-colors',
            canGoPrev
              ? 'text-white hover:bg-white/20 active:bg-white/30'
              : 'text-white/30 cursor-not-allowed'
          )}
        >
          <ChevronUp className="w-6 h-6" />
        </button>

        {/* Page indicator */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="px-2 text-white text-sm font-medium min-w-[56px] text-center"
        >
          {currentPage} / {totalPages}
        </div>

        {/* Next page button - 44px touch target */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNextPage()
          }}
          disabled={!canGoNext}
          aria-label="Next page"
          className={cn(
            'w-11 h-11 flex items-center justify-center rounded-full transition-colors',
            canGoNext
              ? 'text-white hover:bg-white/20 active:bg-white/30'
              : 'text-white/30 cursor-not-allowed'
          )}
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>

      {/* Zoom controls - bottom right */}
      <div
        className={cn(
          'absolute bottom-4 right-3',
          'flex flex-col items-center gap-0.5',
          'p-1 rounded-2xl',
          'bg-black/70 backdrop-blur-sm',
          'transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Zoom in - 44px touch target */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onZoomIn()
          }}
          disabled={!canZoomIn}
          aria-label="Zoom in"
          className={cn(
            'w-11 h-11 flex items-center justify-center rounded-xl transition-colors',
            canZoomIn
              ? 'text-white hover:bg-white/20 active:bg-white/30'
              : 'text-white/30 cursor-not-allowed'
          )}
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        {/* Zoom percentage indicator */}
        <div className="text-white text-xs font-medium text-center py-0.5 min-w-[44px]">
          {Math.round(zoom * 100)}%
        </div>

        {/* Zoom out - 44px touch target */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onZoomOut()
          }}
          disabled={!canZoomOut}
          aria-label="Zoom out"
          className={cn(
            'w-11 h-11 flex items-center justify-center rounded-xl transition-colors',
            canZoomOut
              ? 'text-white hover:bg-white/20 active:bg-white/30'
              : 'text-white/30 cursor-not-allowed'
          )}
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        {/* Reset zoom (only show when zoomed) - 44px touch target */}
        {isZoomed && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onZoomReset()
            }}
            aria-label="Reset zoom"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-white hover:bg-white/20 active:bg-white/30 transition-colors border-t border-white/20"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
    </>
  )
}
