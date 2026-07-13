/**
 * Status + type badges for client Payment rows.
 * Status colors mirror agreement deposit badges: PENDING=amber, PAID=green,
 * FAILED/CANCELED=red/gray, REFUNDED=blue.
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { ClientQuotePaymentState, PaymentStatus, PaymentType } from '../../../lib/api-client'

const statusStyles: Record<PaymentStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  PAID: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  FAILED: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  REFUNDED: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  CANCELED: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

const baseBadge =
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border'

const quoteStatusStyles: Record<ClientQuotePaymentState, string> = {
  sent:
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  processing_bank_payment:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  payment_failed_retryable:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  paid:
    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  duplicate_paid_review:
    'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-800',
  subscription_canceled_after_payment:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  canceled_before_payment:
    'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn(baseBadge, statusStyles[status])}>
      {t(`payments.status.${status}`)}
    </span>
  )
}

export function PaymentTypeBadge({ type }: { type: PaymentType }) {
  const { t } = useTranslation()
  return (
    <span className={cn(baseBadge, 'bg-muted text-muted-foreground border-border')}>
      {t(`payments.type.${type}`)}
    </span>
  )
}

export function QuotePaymentStatusBadge({ state }: { state: ClientQuotePaymentState }) {
  const { t } = useTranslation()
  return (
    <span className={cn(baseBadge, quoteStatusStyles[state])}>
      {t(`payments.quoteStatus.${state}`)}
    </span>
  )
}
