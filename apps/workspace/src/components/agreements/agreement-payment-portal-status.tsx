import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { Agreement } from '../../lib/api-client'
import {
  getAgreementPaymentPortalView,
  type PaymentPortalKind,
} from './agreement-payment-portal-view'

const paymentPortalBadgeStyles: Record<PaymentPortalKind, string> = {
  pending_review:
    'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  sent:
    'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  paid:
    'border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed:
    'border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
  canceled:
    'border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
}

export function AgreementPaymentPortalBadge({ agreement }: { agreement: Agreement }) {
  const { t } = useTranslation()
  const view = getAgreementPaymentPortalView(agreement)
  if (!view) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        paymentPortalBadgeStyles[view.kind],
      )}
    >
      {t(`agreements.paymentPortal.badge.${view.kind}`)}
    </span>
  )
}
