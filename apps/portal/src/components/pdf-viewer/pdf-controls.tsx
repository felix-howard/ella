/**
 * PDF Controls - Floating page indicator and download button
 * Features: auto-hide after 3s, smooth fade transitions
 * Mobile-first design with minimal UI
 */
import { FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'

export interface PdfControlsProps {
  currentPage: number
  totalPages: number
  url: string
  filename: string
  visible: boolean
}

export function PdfControls({
  currentPage,
  totalPages,
  url,
  filename,
  visible,
}: PdfControlsProps) {
  const { t } = useTranslation()

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

      {/* Download button - bottom right */}
      <a
        href={url}
        download={filename}
        tabIndex={visible ? 0 : -1}
        className={cn(
          'absolute bottom-4 right-4',
          'p-2 rounded-full',
          'bg-black/60 backdrop-blur-sm',
          'text-white hover:bg-black/80',
          'focus:outline-none focus:ring-2 focus:ring-white/50',
          'transition-all duration-300',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        aria-label={t('draft.download')}
      >
        <FileDown className="w-5 h-5" />
      </a>
    </>
  )
}
