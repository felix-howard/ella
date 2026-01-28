/**
 * Schedule C Tab - Main component for managing Schedule C expense forms
 * Routes between states: Empty (1099-NEC detected), Waiting, Summary, Locked
 */
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'
import { useScheduleC } from '../../../../hooks/use-schedule-c'
import { ScheduleCEmptyState } from './schedule-c-empty-state'
import { ScheduleCWaiting } from './schedule-c-waiting'
import { ScheduleCSummary } from './schedule-c-summary'

interface ScheduleCTabProps {
  caseId: string
}

export function ScheduleCTab({ caseId }: ScheduleCTabProps) {
  const { expense, magicLink, totals, has1099NEC, count1099NEC, isLoading, error, refetch } = useScheduleC({
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
            {error instanceof Error ? error.message : 'Không thể tải dữ liệu Schedule C'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </Button>
        </div>
      </div>
    )
  }

  // State 1: No Schedule C exists, but 1099-NEC detected → Show empty state with send button
  if (!expense && has1099NEC) {
    return <ScheduleCEmptyState caseId={caseId} count1099NEC={count1099NEC} />
  }

  // State 2: Schedule C exists but status is DRAFT → Show waiting state
  if (expense?.status === 'DRAFT') {
    return <ScheduleCWaiting expense={expense} magicLink={magicLink} caseId={caseId} />
  }

  // State 3 & 4: Schedule C is SUBMITTED or LOCKED → Show summary
  if (expense?.status === 'SUBMITTED' || expense?.status === 'LOCKED') {
    return (
      <ScheduleCSummary
        expense={expense}
        magicLink={magicLink}
        totals={totals}
        caseId={caseId}
      />
    )
  }

  // Fallback: Should not happen, but show empty state if no expense and no 1099-NEC
  return (
    <div className="text-center py-12 text-muted-foreground">
      <p>Không có dữ liệu Schedule C</p>
      <p className="text-sm mt-1">Cần có 1099-NEC đã xác minh để gửi form thu thập chi phí</p>
    </div>
  )
}

export { ScheduleCEmptyState } from './schedule-c-empty-state'
export { ScheduleCWaiting } from './schedule-c-waiting'
export { ScheduleCSummary } from './schedule-c-summary'
