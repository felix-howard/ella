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
  onRetry?: () => void
}

export function AgreementErrorPanel({ code, onRetry }: AgreementErrorPanelProps) {
  const { t } = useTranslation()
  const retryable = code === 'server' || code === 'rate_limited'

  return (
    <div
      className="flex-1 flex items-center justify-center p-6"
      role="alert"
      aria-live="polite"
    >
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {t(`nda.error.${code}.title`)}
        </h2>

        <p className="text-muted-foreground mb-6">
          {t(`nda.error.${code}.message`)}
        </p>

        {retryable && onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {t('common.tryAgain')}
          </Button>
        )}

        <p className="text-sm text-muted-foreground mt-6">
          {t('nda.contactHint')}
        </p>
      </div>
    </div>
  )
}
