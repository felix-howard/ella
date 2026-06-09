/**
 * Overview "Payments" summary card — total paid, most recent payment line,
 * and a PENDING chip when an unpaid deposit exists. Links to the Payments
 * tab. Hidden entirely while the client has no payments (zero-state).
 */
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { CreditCard, ChevronRight } from 'lucide-react'
import { useClientPayments, PaymentStatusBadge, formatUsdAmount, sumPaidAmount } from '../client-payments-tab'
import { formatFullDateTime } from '../../../lib/formatters'

interface Props {
  clientId: string
}

export function ClientPaymentsSummaryCard({ clientId }: Props) {
  const { t } = useTranslation()
  const query = useClientPayments(clientId)
  const payments = query.data?.data ?? []

  // No payments yet → keep the Overview uncluttered.
  if (query.isLoading || query.isError || payments.length === 0) return null

  const totalPaid = sumPaidAmount(payments)
  const mostRecent = payments[0] // API returns createdAt desc
  const hasPendingDeposit = payments.some((p) => p.status === 'PENDING')

  return (
    <section className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-b border-border">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <CreditCard className="w-5 h-5 text-muted-foreground" />
          {t('payments.tabTitle')}
          {hasPendingDeposit && <PaymentStatusBadge status="PENDING" />}
        </h2>
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          search={{ tab: 'payments' }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('payments.viewAll')}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="p-6 flex flex-wrap items-center gap-x-10 gap-y-3">
        <div>
          <p className="text-xs text-muted-foreground">{t('payments.totalPaid')}</p>
          <p className="text-xl font-semibold text-foreground">
            {formatUsdAmount(totalPaid)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t('payments.mostRecent')}</p>
          <p className="text-sm text-foreground truncate">
            {formatUsdAmount(mostRecent.amount)} · {t(`payments.type.${mostRecent.type}`)} ·{' '}
            {t(`payments.status.${mostRecent.status}`)} ·{' '}
            {formatFullDateTime(mostRecent.paidAt ?? mostRecent.createdAt)}
          </p>
        </div>
      </div>
    </section>
  )
}
