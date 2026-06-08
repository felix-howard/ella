/**
 * Client detail "Payments" tab — lists deposit/balance payments for the
 * client: amount, type, description, status badge, paid date, source
 * agreement link, and copy-pay-link action while PENDING.
 */
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Loader2, CreditCard, Copy, FileSignature, AlertTriangle } from 'lucide-react'
import { type ClientPayment } from '../../../lib/api-client'
import { CardSection } from '../../shared/card-section'
import { copyToClipboard } from '../../../lib/clipboard'
import { formatFullDateTime } from '../../../lib/formatters'
import { PaymentStatusBadge, PaymentTypeBadge } from './payment-status-badge'
import { formatUsdAmount } from './payment-format'
import { useClientPayments } from './use-client-payments'

interface Props {
  clientId: string
}

function PaymentRow({ payment, clientId }: { payment: ClientPayment; clientId: string }) {
  const { t } = useTranslation()

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
          </div>
        </div>

        <div className="flex items-center gap-2">
          {payment.status === 'PENDING' && (
            <button
              type="button"
              onClick={handleCopyPayLink}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70"
            >
              <Copy className="w-3.5 h-3.5" />
              {t('payments.copyPayLink')}
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

function PastDueBanner() {
  const { t } = useTranslation()
  return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900/50 dark:bg-red-950/40">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
      <div className="min-w-0">
        <p className="font-medium text-red-800 dark:text-red-300">{t('payments.pastDueTitle')}</p>
        <p className="mt-0.5 text-xs text-red-700/90 dark:text-red-400/80">
          {t('payments.pastDueDesc')}
        </p>
      </div>
    </div>
  )
}

export function ClientPaymentsTab({ clientId }: Props) {
  const { t } = useTranslation()
  const query = useClientPayments(clientId)
  const payments = query.data?.data ?? []
  const pastDue = query.data?.pastDue ?? false

  return (
    <CardSection title={t('payments.tabTitle')} icon={CreditCard}>
      {pastDue && <PastDueBanner />}
      {query.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : query.isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('payments.loadError')}
        </p>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">{t('payments.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('payments.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <PaymentRow key={payment.id} payment={payment} clientId={clientId} />
          ))}
        </div>
      )}
    </CardSection>
  )
}
