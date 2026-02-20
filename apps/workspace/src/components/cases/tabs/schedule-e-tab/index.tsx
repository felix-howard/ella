/**
 * Schedule E Tab - Main component for managing Schedule E rental property forms
 * Routes between states: Empty, Waiting, Summary, Locked
 * Unlike Schedule C, this tab is always visible (no 1099-NEC detection needed)
 */
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'
import { useScheduleE } from '../../../../hooks/use-schedule-e'
import { ScheduleEEmptyState } from './schedule-e-empty-state'
import { ScheduleEWaiting } from './schedule-e-waiting'
import { ScheduleESummary } from './schedule-e-summary'

interface ScheduleETabProps {
  caseId: string
  clientName: string
}

export function ScheduleETab({ caseId, clientName }: ScheduleETabProps) {
  const { expense, magicLink, totals, properties, isLoading, error, refetch } = useScheduleE({
    caseId,
    enabled: true,
  })

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-card rounded-xl border border-destructive/30 p-6">
        <div className="flex flex-col items-center text-center py-6">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">Lỗi tải dữ liệu</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Không thể tải dữ liệu Schedule E'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </Button>
        </div>
      </div>
    )
  }

  // State 1: No Schedule E exists → Show empty state with send button
  if (!expense) {
    return <ScheduleEEmptyState caseId={caseId} clientName={clientName} />
  }

  // State 2: Schedule E exists but status is DRAFT → Show waiting state
  if (expense.status === 'DRAFT') {
    return <ScheduleEWaiting expense={expense} magicLink={magicLink} caseId={caseId} />
  }

  // State 3 & 4: Schedule E is SUBMITTED or LOCKED → Show summary
  return (
    <ScheduleESummary
      expense={expense}
      magicLink={magicLink}
      totals={totals}
      properties={properties}
      caseId={caseId}
    />
  )
}

export { ScheduleEEmptyState } from './schedule-e-empty-state'
export { ScheduleEWaiting } from './schedule-e-waiting'
export { ScheduleESummary } from './schedule-e-summary'
