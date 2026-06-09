/**
 * Final bulk SMS result view with recipient-level immediate failures.
 */
import { AlertTriangle, CheckCircle2, Clock3, RotateCcw, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { BulkSmsResponse } from '../../lib/api-client'

interface BulkSmsResultSummaryProps {
  result: BulkSmsResponse
  attemptedCount: number
  onRetryFailed: () => void
  onClose: () => void
}

export function BulkSmsResultSummary({
  result, attemptedCount, onRetryFailed, onClose,
}: BulkSmsResultSummaryProps) {
  const { t } = useTranslation()
  const failedResults = result.results.filter((item) => item.status === 'failed')
  const warningResults = result.results.filter((item) => item.status === 'sent' && item.error)
  const acceptedCount = result.sent
  const failedCount = result.failed
  const hasConcern = failedCount > 0 || warningResults.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        {hasConcern ? (
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-yellow-600" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
        )}
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {hasConcern ? t('bulkSms.result.partialTitle') : t('bulkSms.result.successTitle')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('bulkSms.result.deliveryNote')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ResultMetric label={t('bulkSms.result.attempted')} value={attemptedCount} />
        <ResultMetric label={t('bulkSms.result.accepted')} value={acceptedCount} icon={CheckCircle2} />
        <ResultMetric label={t('bulkSms.result.failed')} value={failedCount} icon={XCircle} />
        <ResultMetric label={t('bulkSms.result.pending')} value={acceptedCount} icon={Clock3} />
      </div>

      {failedResults.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">
            {t('bulkSms.result.failedRecipients')}
          </h4>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-border">
            {failedResults.map((item) => (
              <div key={item.leadId} className="border-b border-border/60 px-3 py-2 last:border-b-0">
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.error || t('bulkSms.result.unknownFailure')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {warningResults.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">
            {t('bulkSms.result.warningRecipients')}
          </h4>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
            {warningResults.map((item) => (
              <div key={item.leadId} className="border-b border-border/60 px-3 py-2 last:border-b-0">
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.error || t('bulkSms.result.unknownWarning')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {t('common.close')}
        </button>
        {failedResults.length > 0 && (
          <button
            type="button"
            onClick={onRetryFailed}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('bulkSms.result.retryFailed', { count: failedResults.length })}
          </button>
        )}
      </div>
    </div>
  )
}

function ResultMetric({
  label, value, icon: Icon,
}: {
  label: string
  value: number
  icon?: LucideIcon
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
