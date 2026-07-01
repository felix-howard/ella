import type { ChangeEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'

interface ReplyTranslationPreviewProps {
  value: string
  disabled?: boolean
  isLoading: boolean
  isEdited: boolean
  isStale: boolean
  error: string | null
  onChange: (value: string) => void
  onRegenerate: () => void
}

export function ReplyTranslationPreview({
  value,
  disabled,
  isLoading,
  isEdited,
  isStale,
  error,
  onChange,
  onRegenerate,
}: ReplyTranslationPreviewProps) {
  const { t } = useTranslation()
  const showRegenerate = !isLoading && !error && (isEdited || isStale)

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value)
  }

  return (
    <div className="mb-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="text-xs font-medium text-foreground">
          {t('messages.replyTranslationPreviewLabel')}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-[11px] text-muted-foreground">
              {t('messages.translating')}
            </span>
          )}
          {error && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={disabled || isLoading}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-dark disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              {t('messages.retryTranslation')}
            </button>
          )}
          {showRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-dark disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              {t('messages.regenerateTranslation')}
            </button>
          )}
        </div>
      </div>

      <textarea
        value={value}
        onChange={handleChange}
        disabled={disabled || isLoading}
        rows={2}
        maxLength={1000}
        aria-label={t('messages.replyTranslationPreviewLabel')}
        placeholder={t('messages.replyTranslationPreviewPlaceholder')}
        className={cn(
          'w-full min-h-16 max-h-28 px-3 py-2 rounded-lg bg-card border border-border/70',
          'resize-y text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
          'disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      />

      {error && (
        <div className="mt-1.5 text-xs text-destructive">
          {t(error)}
        </div>
      )}
      {!error && isStale && (
        <div className="mt-1.5 text-xs text-muted-foreground">
          {t('messages.replyTranslationStale')}
        </div>
      )}
    </div>
  )
}
