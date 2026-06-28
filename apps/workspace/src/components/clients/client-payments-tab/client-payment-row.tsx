import { Link } from '@tanstack/react-router'
import { Copy, ExternalLink, FileSignature, Loader2, ReceiptText, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type ClientPayment } from '../../../lib/api-client'
import { copyToClipboard } from '../../../lib/clipboard'
import { formatFullDateTime } from '../../../lib/formatters'
import { formatUsdAmount } from './payment-format'
import { PaymentStatusBadge, PaymentTypeBadge } from './payment-status-badge'

interface ClientPaymentRowProps {
  payment: ClientPayment
  clientId: string
  isRefreshingReceipt: boolean
  onRefreshReceipt: (paymentId: string) => void
}

const allowedStripeReceiptHosts = new Set(['invoice.stripe.com', 'pay.stripe.com'])

function getSafeReceiptUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') return null
    if (!allowedStripeReceiptHosts.has(parsed.hostname)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function ClientPaymentRow({
  payment,
  clientId,
  isRefreshingReceipt,
  onRefreshReceipt,
}: ClientPaymentRowProps) {
  const { t } = useTranslation()
  const receiptHref =
    getSafeReceiptUrl(payment.hostedInvoiceUrl) ||
    getSafeReceiptUrl(payment.invoicePdfUrl) ||
    getSafeReceiptUrl(payment.receiptUrl) ||
    null
  const showReceiptRefresh = payment.status === 'PAID' && payment.receiptStatus === 'pending'

  const handleCopyPayLink = () => {
    void copyToClipboard(payment.payUrl, { successMsg: t('payments.payLinkCopied') })
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-foreground">
              {formatUsdAmount(payment.amount)}
            </span>
            <PaymentTypeBadge type={payment.type} />
            <PaymentStatusBadge status={payment.status} />
          </div>
          {payment.description && (
            <p className="mt-1 text-sm text-muted-foreground truncate">{payment.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t('payments.requestedOn')} {formatFullDateTime(payment.createdAt)}
            </span>
            {payment.paidAt && (
              <span className="text-green-700 dark:text-green-400">
                {t('payments.paidOn')} {formatFullDateTime(payment.paidAt)}
              </span>
            )}
            {payment.paymentMethodLabel && payment.status === 'PAID' && (
              <span>{t('payments.paymentMethod', { method: payment.paymentMethodLabel })}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {payment.status === 'PENDING' && (
            <button
              type="button"
              onClick={handleCopyPayLink}
              className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Copy className="w-3.5 h-3.5" />
              {t('payments.copyPayLink')}
            </button>
          )}
          {payment.status === 'PAID' && receiptHref && (
            <a
              href={receiptHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('payments.openReceiptAria')}
              className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <ReceiptText className="w-3.5 h-3.5" aria-hidden />
              {t('payments.receiptAction')}
              <ExternalLink className="w-3 h-3" aria-hidden />
            </a>
          )}
          {showReceiptRefresh && (
            <button
              type="button"
              onClick={() => onRefreshReceipt(payment.id)}
              disabled={isRefreshingReceipt}
              aria-label={t('payments.refreshReceiptAria')}
              className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70"
            >
              {isRefreshingReceipt ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" aria-hidden />
              )}
              {isRefreshingReceipt ? t('payments.refreshingReceipt') : t('payments.refreshReceipt')}
            </button>
          )}
        </div>
      </div>

      {payment.agreement && (
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          search={{ tab: 'agreements' }}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileSignature className="w-3.5 h-3.5" />
          {payment.agreement.title}
        </Link>
      )}
    </div>
  )
}
