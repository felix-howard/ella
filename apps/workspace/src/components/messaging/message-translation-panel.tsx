import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { AlertCircle, Languages, Loader2 } from 'lucide-react'
import { api, ApiError, type TranslateMessageResponse } from '../../lib/api-client'
import { isLikelyVietnamese } from '../../lib/message-language-detection'

interface MessageTranslationPanelProps {
  messageId: string
  content: string
  isOutbound: boolean
}

export function MessageTranslationPanel({
  messageId,
  content,
  isOutbound,
}: MessageTranslationPanelProps) {
  const { t } = useTranslation()
  const [translation, setTranslation] = useState<TranslateMessageResponse | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const prominent = isLikelyVietnamese(content)

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

  return (
    <div
      className={cn(
        'mt-2 flex max-w-full flex-col gap-1.5',
        isOutbound ? 'items-end' : 'items-start'
      )}
    >
      <button
        type="button"
        onClick={handleTranslate}
        disabled={isTranslating}
        className={cn(
          'inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',
          prominent
            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          isTranslating && 'cursor-wait'
        )}
        aria-busy={isTranslating}
      >
        {isTranslating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isTranslating
          ? t('messages.translating')
          : translation && isVisible
            ? t('messages.hideTranslation')
            : t('messages.translate')}
      </button>

      {translation && isVisible && (
        <div
          className="max-w-full rounded-md border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-[13px] leading-relaxed text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
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
          className="flex max-w-full items-start gap-1.5 text-[11px] text-destructive"
        >
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
