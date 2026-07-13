/**
 * Terminal/transient state panels for the portal pay page:
 *  - PaymentPaidPanel       — payment confirmed (already-paid or post-checkout)
 *  - PaymentConfirmingPanel — returned from Stripe, waiting for webhook to land
 *  - PaymentBankProcessingPanel — ACH submitted, waiting for settlement
 *  - PaymentErrorPanel      — invalid/canceled/rate-limited/server errors
 */
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Landmark, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'

export type PaymentErrorCode =
  | 'invalid'
  | 'canceled'
  | 'canceled_before_payment'
  | 'rate_limited'
  | 'server'

interface PaymentPaidPanelProps {
  orgName: string
  amountFormatted: string
  /** ISO timestamp; null when webhook confirmed PAID but view not refetched yet. */
  paidAt: string | null
  variant?: 'paid' | 'subscriptionCanceledAfterPayment'
}

export function PaymentPaidPanel({
  orgName,
  amountFormatted,
  paidAt,
  variant = 'paid',
}: PaymentPaidPanelProps) {
  const { t, i18n } = useTranslation()
  const copyPrefix = variant === 'subscriptionCanceledAfterPayment'
    ? 'pay.subscriptionCanceledAfterPayment'
    : 'pay.paid'
  const formattedDate = paidAt
    ? new Date(paidAt).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : null

  return (
    <section
      className="flex-1 flex items-center justify-center py-8"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-center shadow-lg">
        <div className="h-1.5 bg-primary" aria-hidden="true" />
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-light">
            <CheckCircle2 className="h-10 w-10 text-primary-dark" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t(`${copyPrefix}.title`)}
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-muted-foreground">
            {t(`${copyPrefix}.message`, { orgName, amount: amountFormatted })}
          </p>
          {formattedDate && (
            <p className="mt-5 inline-flex items-center rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground">
              {t('pay.paid.paidOn', { date: formattedDate })}
            </p>
          )}
          <p className="mt-6 text-sm text-muted-foreground">{t(`${copyPrefix}.receiptHint`)}</p>
        </div>
      </div>
    </section>
  )
}

interface PaymentConfirmingPanelProps {
  /** True once automatic polling gave up — shows the manual "Check again" button. */
  pollExhausted: boolean
  onRefresh: () => void
}

export function PaymentConfirmingPanel({ pollExhausted, onRefresh }: PaymentConfirmingPanelProps) {
  const { t } = useTranslation()

  return (
    <section
      className="flex-1 flex items-center justify-center py-8"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <Loader2 className="h-8 w-8 animate-spin text-primary-dark" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {t('pay.confirming.title')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t('pay.confirming.message')}
        </p>
        {pollExhausted && (
          <Button onClick={onRefresh} size="lg" className="mt-6 gap-2">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {t('pay.confirming.refresh')}
          </Button>
        )}
      </div>
    </section>
  )
}

interface PaymentBankProcessingPanelProps {
  onRefresh: () => void
  refreshing: boolean
}

export function PaymentBankProcessingPanel({
  onRefresh,
  refreshing,
}: PaymentBankProcessingPanelProps) {
  const { t } = useTranslation()

  return (
    <section
      className="flex-1 flex items-center justify-center py-8"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <Landmark className="h-8 w-8 text-primary-dark" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {t('pay.bankProcessing.title')}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t('pay.bankProcessing.message')}
        </p>
        <div className="mt-5 rounded-lg border border-primary/20 bg-primary-light/40 px-4 py-3 text-left text-sm leading-relaxed text-foreground">
          <p className="font-semibold">{t('pay.bankProcessing.doNotPayAgain')}</p>
          <p className="mt-2 text-muted-foreground">{t('pay.bankProcessing.receiptHint')}</p>
        </div>
        <Button
          onClick={onRefresh}
          disabled={refreshing}
          size="lg"
          className="mt-6 min-h-11 w-full gap-2 sm:w-auto"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          {t('pay.bankProcessing.refresh')}
        </Button>
      </div>
    </section>
  )
}

interface PaymentErrorPanelProps {
  code: PaymentErrorCode
  onRetry?: () => void
}

export function PaymentErrorPanel({ code, onRetry }: PaymentErrorPanelProps) {
  const { t } = useTranslation()
  const retryable = code === 'server' || code === 'rate_limited'

  return (
    <section className="flex-1 flex items-center justify-center" role="alert" aria-live="polite">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-9 h-9 text-destructive" aria-hidden="true" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight mb-2">
          {t(`pay.error.${code}.title`)}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
          {t(`pay.error.${code}.message`)}
        </p>
        {retryable && onRetry && (
          <Button onClick={onRetry} size="lg" className="gap-2 shadow-md">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {t('common.tryAgain')}
          </Button>
        )}
        <p className="text-sm text-muted-foreground mt-6">{t('pay.contactHint')}</p>
      </div>
    </section>
  )
}
