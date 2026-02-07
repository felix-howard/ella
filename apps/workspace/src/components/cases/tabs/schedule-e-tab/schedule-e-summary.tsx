/**
 * Schedule E Summary - Shows submitted/locked rental property data with totals
 * Displays property cards, aggregate totals, and version history
 */
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  ScheduleEExpense,
  ScheduleEMagicLink,
  ScheduleETotals,
  ScheduleEPropertyData,
} from '../../../../lib/api-client'
import { formatDateTime } from './format-utils'
import { PropertyCard } from './property-card'
import { TotalsCard } from './totals-card'
import { ScheduleEActions } from './schedule-e-actions'
import { StatusBadge } from './status-badge'

interface ScheduleESummaryProps {
  expense: ScheduleEExpense
  magicLink: ScheduleEMagicLink | null
  totals: ScheduleETotals | null
  properties: ScheduleEPropertyData[]
  caseId: string
}

export function ScheduleESummary({ expense, magicLink: _magicLink, totals, properties, caseId }: ScheduleESummaryProps) {
  const { t } = useTranslation()
  const isLocked = expense.status === 'LOCKED'

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Schedule E</h2>
          <p className="text-xs text-muted-foreground">
            {t('scheduleE.lastUpdated', {
              datetime: formatDateTime(expense.updatedAt, 'DATETIME_FULL'),
              version: expense.version,
            })}
          </p>
        </div>
        <StatusBadge status={expense.status} />
      </div>

      {/* Locked Notice */}
      {isLocked && expense.lockedAt && (
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-3">
          <Lock className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('scheduleE.formLockedNotice')}</p>
            <p className="text-xs text-muted-foreground">
              {t('scheduleE.formLockedAt', { datetime: formatDateTime(expense.lockedAt, 'DATETIME_FULL') })}
            </p>
          </div>
        </div>
      )}

      {/* Aggregate Totals */}
      {totals && properties.length > 0 && (
        <TotalsCard totals={totals} />
      )}

      {/* Property Cards */}
      {properties.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground uppercase tracking-wide mb-3 pb-2 border-b border-border">
            {t('scheduleE.rentalProperties')} ({properties.length})
          </h3>
          <div className="space-y-3">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                isLocked={isLocked}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Properties State */}
      {properties.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>{t('scheduleE.noProperties')}</p>
        </div>
      )}

      {/* Actions */}
      <ScheduleEActions caseId={caseId} status={expense.status} />
    </div>
  )
}
