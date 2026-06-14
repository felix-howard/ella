import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn, Tooltip } from '@ella/ui'
import { AlertCircle, Languages, Loader2 } from 'lucide-react'
import { api, ApiError, type TranslateMessageResponse } from '../../lib/api-client'

interface MessageTranslationPanelProps {
  messageId: string
  isOutbound: boolean
}

export function MessageTranslationPanel({
  messageId,
  isOutbound,
}: MessageTranslationPanelProps) {
  const { t } = useTranslation()
  const [translation, setTranslation] = useState<TranslateMessageResponse | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleTranslate = async () => {
    if (translation) {
      setIsVisible((current) => !current)
      setError(null)
      return
    }

    setIsTranslating(true)
    setError(null)
    try {
      const translated = await api.messages.translate(messageId, { targetLanguage: 'EN' })
      setTranslation(translated)
      setIsVisible(true)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null
      setError(
        code === 'AI_NOT_CONFIGURED'
          ? t('messages.translationUnavailable')
          : t('messages.translationError')
      )
    } finally {
      setIsTranslating(false)
    }
  }

  const actionLabel = isTranslating
    ? t('messages.translating')
    : translation && isVisible
      ? t('messages.hideTranslation')
      : t('messages.translate')

  return (
    <>
      <div className={cn('absolute top-1.5 z-10', isOutbound ? 'right-1.5' : 'right-1.5')}>
        <Tooltip content={actionLabel} position="top-right" className="whitespace-nowrap !bg-slate-800 !text-white" showArrow={false}>
          <button
            type="button"
            onClick={handleTranslate}
            disabled={isTranslating}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/70 transition-colors',
              'hover:bg-background/70 hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-60',
              translation && isVisible && 'bg-emerald-100/80 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-200',
              isTranslating && 'cursor-wait'
            )}
            aria-label={actionLabel}
            aria-busy={isTranslating}
          >
            {isTranslating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </Tooltip>
      </div>

      {translation && isVisible && (
        <div
          className="mt-2 max-w-full rounded-md border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-[13px] leading-relaxed text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
          aria-label={t('messages.translationLabel')}
          aria-live="polite"
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {t('messages.translationLabel')}
          </div>
          <p className="whitespace-pre-wrap break-words">{translation.translatedText}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-1 flex max-w-full items-start gap-1.5 text-[11px] text-destructive"
        >
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </>
  )
}
