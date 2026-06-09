/**
 * Floating Bulk Action Bar - Bottom-center slide-up bar shown when rows selected.
 */
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { MessageSquare, X } from 'lucide-react'

interface FloatingBulkBarProps {
  selectedCount: number
  maxRecipients: number
  onSendSms: () => void
  onClear: () => void
}

const KEYFRAMES = `
@keyframes ella-bulk-bar-slide-up {
  from { transform: translate(-50%, 20px); opacity: 0; }
  to   { transform: translate(-50%, 0);    opacity: 1; }
}
`

export function FloatingBulkBar({ selectedCount, maxRecipients, onSendSms, onClear }: FloatingBulkBarProps) {
  const { t } = useTranslation()

  if (selectedCount === 0) return null
  if (typeof document === 'undefined') return null

  const showLimitHint = selectedCount >= Math.floor(maxRecipients * 0.8)
  const maxReached = selectedCount >= maxRecipients
  const overMax = selectedCount > maxRecipients
  const limitHint = overMax
    ? t('leads.bulkSmsSelectedOverLimit', { count: selectedCount, limit: maxRecipients })
    : maxReached
      ? t('leads.bulkSmsMaxReached', { limit: maxRecipients })
      : t('leads.bulkSmsLimitHint', { limit: maxRecipients })

  return createPortal(
    <>
      <style>{KEYFRAMES}</style>
      <div
        role="toolbar"
        aria-label={t('leads.bulkActions', 'Bulk actions')}
        className="fixed bottom-4 left-1/2 z-50 sm:bottom-6"
        style={{
          transform: 'translateX(-50%)',
          animation: 'ella-bulk-bar-slide-up 200ms ease-out',
        }}
      >
        <div className="flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-2 rounded-2xl bg-foreground px-3 py-2.5 text-background shadow-xl ring-1 ring-black/10 sm:gap-3 sm:rounded-full sm:px-4">
          <div className="min-w-0 pl-1" aria-live="polite">
            <span className="block text-sm font-medium">
              {t('leads.selected', { count: selectedCount })}
            </span>
            {showLimitHint && (
              <span className="block text-xs text-background/70">
                {limitHint}
              </span>
            )}
          </div>
          <span className="h-5 w-px bg-background/20" aria-hidden="true" />
          <button
            type="button"
            onClick={onSendSms}
            disabled={overMax}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-background/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-background/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
            {t('leads.sendSms')}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-background/10"
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
