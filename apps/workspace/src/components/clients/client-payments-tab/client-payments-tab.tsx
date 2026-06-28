/**
 * Client detail "Payments" tab — lists deposit/balance payments for the
 * client: amount, type, description, status badge, paid date, source
 * agreement link, and copy-pay-link action while PENDING.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CreditCard, Loader2 } from 'lucide-react'
import { CardSection } from '../../shared/card-section'
import { ClientPaymentRow } from './client-payment-row'
import { useClientPayments } from './use-client-payments'
import { useReconcilePaymentReceipt } from './use-reconcile-payment-receipt'

interface Props {
  clientId: string
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
  const receiptRefreshMutation = useReconcilePaymentReceipt(clientId)
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
        <p className="py-8 text-center text-sm text-muted-foreground">{t('payments.loadError')}</p>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">{t('payments.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('payments.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <ClientPaymentRow
              key={payment.id}
              payment={payment}
              clientId={clientId}
              isRefreshingReceipt={
                receiptRefreshMutation.isPending && receiptRefreshMutation.variables === payment.id
              }
              onRefreshReceipt={receiptRefreshMutation.mutate}
            />
          ))}
        </div>
      )}
    </CardSection>
  )
}
