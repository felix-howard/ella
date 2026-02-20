/**
 * Schedule C Summary - Shows submitted/locked expense data with totals
 * Displays income, expenses, net profit, and version history
 */
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ScheduleCExpense, ScheduleCMagicLink, ScheduleCTotals, NecBreakdownItem } from '../../../../lib/api-client'
import { formatDateTime } from './format-utils'
import { IncomeTable } from './income-table'
import { ExpenseTable } from './expense-table'
import { NetProfitCard } from './net-profit-card'
import { VersionHistory } from './version-history'
import { ScheduleCActions } from './schedule-c-actions'
import { StatusBadge } from './status-badge'

interface ScheduleCSummaryProps {
  expense: ScheduleCExpense
  magicLink: ScheduleCMagicLink | null
  totals: ScheduleCTotals | null
  caseId: string
  necBreakdown?: NecBreakdownItem[]
}

export function ScheduleCSummary({ expense, magicLink, totals, caseId, necBreakdown = [] }: ScheduleCSummaryProps) {
  const { t } = useTranslation()
  const isLocked = expense.status === 'LOCKED'

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Schedule C</h2>
          <p className="text-xs text-muted-foreground">
            {t('scheduleC.lastUpdated', { datetime: formatDateTime(expense.updatedAt, 'DATETIME_FULL'), version: expense.version })}
          </p>
        </div>
        <StatusBadge status={expense.status} />
      </div>

      {/* Locked Notice */}
      {isLocked && expense.lockedAt && (
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-3">
          <Lock className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('scheduleC.formLockedNotice')}</p>
            <p className="text-xs text-muted-foreground">
              {t('scheduleC.formLockedAt', { datetime: formatDateTime(expense.lockedAt, 'DATETIME_FULL') })}
            </p>
          </div>
        </div>
      )}

      {/* Part I - Income */}
      <div>
        <h3 className="text-sm font-medium text-foreground uppercase tracking-wide mb-3 pb-2 border-b border-border">
          {t('scheduleC.partIIncome')}
        </h3>
        <IncomeTable expense={expense} totals={totals} showGrossIncome necBreakdown={necBreakdown} />
      </div>

      {/* Part II - Expenses */}
      <div>
        <h3 className="text-sm font-medium text-foreground uppercase tracking-wide mb-3 pb-2 border-b border-border">
          {t('scheduleC.partIIExpenses')}
        </h3>
        <ExpenseTable expense={expense} totals={totals} />
      </div>

      {/* Net Profit */}
      {totals && (
        <NetProfitCard netProfit={totals.netProfit} />
      )}

      {/* Version History */}
      {expense.versionHistory && expense.versionHistory.length > 0 && (
        <VersionHistory history={expense.versionHistory} />
      )}

      {/* Actions */}
      <ScheduleCActions caseId={caseId} status={expense.status} magicLinkToken={magicLink?.token} />
    </div>
  )
}
