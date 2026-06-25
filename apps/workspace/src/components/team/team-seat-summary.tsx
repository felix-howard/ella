import { AlertCircle, Clock, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TeamReconciliationResponse } from '../../lib/api-client'

interface TeamSeatSummaryProps {
  reconciliation?: TeamReconciliationResponse
  isLoading?: boolean
  isError?: boolean
  fallbackActiveCount: number
}

function getStaffCounts(reconciliation: TeamReconciliationResponse | undefined) {
  if (!reconciliation) return null

  const staffRows = new Map<string, boolean>()
  for (const member of reconciliation.members) {
    if (!member.staffId || staffRows.has(member.staffId)) continue
    staffRows.set(member.staffId, member.isActive === true)
  }

  const activeCount = Array.from(staffRows.values()).filter(Boolean).length
  return {
    activeCount,
    archivedCount: Math.max(reconciliation.staffCount - activeCount, 0),
    staffCount: reconciliation.staffCount,
  }
}

export function TeamSeatSummary({
  reconciliation,
  isLoading = false,
  isError = false,
  fallbackActiveCount,
}: TeamSeatSummaryProps) {
  const { t } = useTranslation()
  const counts = getStaffCounts(reconciliation)

  if (isLoading && !reconciliation) {
    return (
      <div className="mb-6 rounded-xl border border-border/50 bg-card p-4 text-sm text-muted-foreground shadow-sm">
        {t('team.seatSummaryLoading', 'Checking Clerk seats...')}
      </div>
    )
  }

  if (isError && !reconciliation) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertCircle className="h-4 w-4" />
        {t('team.seatSummaryUnavailable', 'Clerk seat status is unavailable right now.')}
      </div>
    )
  }

  const activeCount = counts?.activeCount ?? fallbackActiveCount
  const staffCount = counts?.staffCount ?? fallbackActiveCount
  const archivedCount = counts?.archivedCount ?? 0

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {t('team.staffRecords', 'Staff records')}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {t('team.staffRecordsSummary', {
            activeCount,
            staffCount,
            defaultValue: '{{activeCount}} active / {{staffCount}} total',
          })}
        </p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {t('team.archivedStaff', 'Archived staff')}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {t('team.archivedStaffCount', {
            count: archivedCount,
            defaultValue: '{{count}} archived',
          })}
        </p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-normal text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {t('team.clerkSeats', 'Clerk seats')}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {t('team.clerkSeatsUsed', {
            count: reconciliation?.seatsUsed ?? 0,
            defaultValue: '{{count}} used',
          })}
        </p>
        {Boolean(reconciliation?.pendingInvitationCount) && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {t('team.pendingInvitationCount', {
              count: reconciliation?.pendingInvitationCount,
              defaultValue: '{{count}} pending invites',
            })}
          </p>
        )}
      </div>
    </div>
  )
}
