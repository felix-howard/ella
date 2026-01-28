/**
 * Schedule C Empty State - Shows when 1099-NEC detected but no form sent yet
 * Displays detection notice and send button
 */
import { AlertTriangle, Send, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { useScheduleCActions } from '../../../../hooks/use-schedule-c-actions'

interface ScheduleCEmptyStateProps {
  caseId: string
  count1099NEC: number
}

export function ScheduleCEmptyState({ caseId, count1099NEC }: ScheduleCEmptyStateProps) {
  const { sendForm } = useScheduleCActions({ caseId })

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex flex-col items-center text-center py-8">
        {/* Alert Icon */}
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4" aria-hidden="true">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Phát hiện 1099-NEC
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Đã phát hiện {count1099NEC} mẫu 1099-NEC đã xác minh.
          Gửi form thu thập chi phí để hoàn thành Schedule C cho khách hàng này.
        </p>

        {/* Send Button */}
        <Button
          onClick={() => sendForm.mutate()}
          disabled={sendForm.isPending}
          size="lg"
          className="gap-2"
          aria-label="Gửi form thu thập chi phí Schedule C"
        >
          {sendForm.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Đang gửi...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" aria-hidden="true" />
              Gửi Form Schedule C
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
