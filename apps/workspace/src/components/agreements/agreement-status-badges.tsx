/**
 * Status badges for Agreement state + deposit state + agreement type.
 * Status colors: SENT=blue, SIGNED=green, EXPIRED=gray, VOIDED=red;
 * Deposit colors: PENDING=amber, PAID=green, REFUNDED=blue, FORFEITED=red;
 * Type colors: NDA=blue, EL=purple, SA=green, CONSENT_7216=cyan, CUSTOM=gray.
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { AgreementType, NdaStatus, NdaDepositStatus } from '../../lib/api-client'

const ndaStatusStyles: Record<NdaStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-border',
  SENT: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  SIGNED:
    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  EXPIRED:
    'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  VOIDED:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
}

const depositStatusStyles: Record<NdaDepositStatus, string> = {
  PENDING:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  PAID: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  REFUNDED:
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  FORFEITED:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
}

const baseBadge = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border'

export function NdaStatusBadge({ status }: { status: NdaStatus }) {
  const { t } = useTranslation()
  return <span className={cn(baseBadge, ndaStatusStyles[status])}>{t(`nda.status.${status}`)}</span>
}

export function DepositStatusBadge({ status }: { status: NdaDepositStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn(baseBadge, depositStatusStyles[status])}>{t(`nda.deposit.${status}`)}</span>
  )
}

const agreementTypeStyles: Record<AgreementType, string> = {
  NDA: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  ENGAGEMENT_LETTER:
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  SERVICE_AGREEMENT:
    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  CONSENT_7216:
    'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
  CUSTOM:
    'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
}

export function AgreementTypeBadge({ type }: { type: AgreementType }) {
  const { t } = useTranslation()
  return (
    <span className={cn(baseBadge, agreementTypeStyles[type])}>{t(`agreements.type.${type}`)}</span>
  )
}
