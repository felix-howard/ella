/**
 * Floating Bulk Action Bar - Bottom-center slide-up bar shown when rows selected.
 */
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { MessageSquare, X } from 'lucide-react'

interface FloatingBulkBarProps {
  selectedCount: number
  onSendSms: () => void
  onClear: () => void
}

const KEYFRAMES = `
@keyframes ella-bulk-bar-slide-up {
  from { transform: translate(-50%, 20px); opacity: 0; }
  to   { transform: translate(-50%, 0);    opacity: 1; }
}
`

export function FloatingBulkBar({ selectedCount, onSendSms, onClear }: FloatingBulkBarProps) {
  const { t } = useTranslation()

  if (selectedCount === 0) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <style>{KEYFRAMES}</style>
      <div
        role="toolbar"
        aria-label={t('leads.bulkActions', 'Bulk actions')}
        className="fixed bottom-6 left-1/2 z-50"
        style={{
          transform: 'translateX(-50%)',
          animation: 'ella-bulk-bar-slide-up 200ms ease-out',
        }}
      >
        <div className="flex items-center gap-3 bg-foreground text-background rounded-full shadow-xl ring-1 ring-black/10 px-4 py-2.5">
          <span className="text-sm font-medium pl-1" aria-live="polite">
            {t('leads.selected', { count: selectedCount })}
          </span>
          <span className="h-5 w-px bg-background/20" aria-hidden="true" />
          <button
            type="button"
            onClick={onSendSms}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/10 hover:bg-background/20 text-sm font-medium transition-colors"
          >
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
            {t('leads.sendSms')}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-background/10 transition-colors"
            aria-label={t('common.clear', 'Clear')}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
