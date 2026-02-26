/**
 * PDF Controls - Floating page indicator
 * Features: auto-hide after 3s, smooth fade transitions
 * Mobile-first design with minimal UI
 */
import { cn } from '@ella/ui'

export interface PdfControlsProps {
  currentPage: number
  totalPages: number
  visible: boolean
}

export function PdfControls({
  currentPage,
  totalPages,
  visible,
}: PdfControlsProps) {
  return (
    <>
      {/* Page indicator pill - bottom center */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'absolute bottom-4 left-1/2 -translate-x-1/2',
          'px-3 py-1.5 rounded-full',
          'bg-black/60 backdrop-blur-sm',
          'text-white text-sm font-medium',
          'transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {currentPage} / {totalPages}
      </div>
    </>
  )
}
