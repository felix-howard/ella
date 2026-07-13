import { Link } from '@tanstack/react-router'
import { AlertTriangle, Copy, FileSignature } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ClientQuotePayment } from '../../../lib/api-client'
import { copyToClipboard } from '../../../lib/clipboard'
import { formatFullDateTime } from '../../../lib/formatters'
import { formatUsdAmount } from './payment-format'
import { QuotePaymentStatusBadge } from './payment-status-badge'

interface ClientQuotePaymentRowProps {
  quote: ClientQuotePayment
  clientId: string
}

export function ClientQuotePaymentRow({ quote, clientId }: ClientQuotePaymentRowProps) {
  const { t } = useTranslation()
  const canCopyPayLink = Boolean(quote.payUrl && quote.mayStartCheckout)
  const hasRecurringAmount = Number(quote.recurringAmount) > 0
  const billingLabel = quote.billingInterval
    ? t(`payments.billingInterval.${quote.billingInterval}`)
    : null

  const handleCopyPayLink = () => {
    if (!quote.payUrl) return
    void copyToClipboard(quote.payUrl, { successMsg: t('payments.payLinkCopied') })
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-foreground">
              {formatUsdAmount(quote.amount)}
            </span>
            <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {t(`payments.quoteSource.${quote.source}`)}
            </span>
            <QuotePaymentStatusBadge state={quote.state} />
          </div>
          {hasRecurringAmount && billingLabel && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('payments.quoteRecurringAmount', {
                amount: formatUsdAmount(quote.recurringAmount),
                interval: billingLabel,
              })}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t('payments.quoteSentOn')} {formatFullDateTime(quote.sentAt ?? quote.createdAt)}
            </span>
            {quote.paidAt && (
              <span className="text-green-700 dark:text-green-400">
                {t('payments.paidOn')} {formatFullDateTime(quote.paidAt)}
              </span>
            )}
            {quote.latestStripeSessionId && (
              <span>{t('payments.stripeSession', { id: quote.latestStripeSessionId })}</span>
            )}
          </div>
        </div>

        {canCopyPayLink && (
          <button
            type="button"
            onClick={handleCopyPayLink}
            className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Copy className="h-3.5 w-3.5" />
            {quote.state === 'payment_failed_retryable'
              ? t('payments.copyRetryLink')
              : t('payments.copyPayLink')}
          </button>
        )}
      </div>

      {(quote.state === 'processing_bank_payment' ||
        quote.state === 'duplicate_paid_review' ||
        quote.staleProcessing) && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {quote.state === 'duplicate_paid_review'
              ? t('payments.quoteDuplicateDesc')
              : quote.staleProcessing
                ? t('payments.quoteStaleProcessingDesc')
                : t('payments.quoteBankProcessingDesc')}
          </span>
        </div>
      )}

      {quote.agreement && (
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          search={{ tab: 'agreements' }}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <FileSignature className="h-3.5 w-3.5" />
          {quote.agreement.title}
        </Link>
      )}
    </div>
  )
}
