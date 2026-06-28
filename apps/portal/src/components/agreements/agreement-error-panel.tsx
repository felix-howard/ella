/**
 * Shared error display for agreement portal flow. Maps each error code to a
 * distinct user message + optional retry affordance.
 */
import { useTranslation } from 'react-i18next'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'

export type AgreementErrorCode =
  | 'invalid'
  | 'expired'
  | 'signed'
  | 'voided'
  | 'rate_limited'
  | 'server'

interface AgreementErrorPanelProps {
  code: AgreementErrorCode
  documentLabel?: string
  onRetry?: () => void
}

export function AgreementErrorPanel({ code, documentLabel, onRetry }: AgreementErrorPanelProps) {
  const { t } = useTranslation()
  const retryable = code === 'server' || code === 'rate_limited'
  const label = documentLabel?.trim() || t('nda.documentLabel.generic')

  return (
    <section
      className="flex-1 flex items-center justify-center"
      role="alert"
      aria-live="polite"
    >
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-9 h-9 text-destructive" aria-hidden="true" />
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight mb-2">
          {t(`nda.error.${code}.title`)}
        </h2>

        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
          {t(`nda.error.${code}.message`, { documentLabel: label })}
        </p>

        {retryable && onRetry && (
          <Button onClick={onRetry} size="lg" className="gap-2 shadow-md">
            <RefreshCw className="w-4 h-4" />
            {t('common.tryAgain')}
          </Button>
        )}

        <p className="text-sm text-muted-foreground mt-6">
          {t('nda.contactHint')}
        </p>
      </div>
    </section>
  )
}
