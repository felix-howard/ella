/**
 * Schedule C Empty State - Shows when 1099-NEC detected but no form sent yet
 * Displays detection notice and send button
 */
import { FileText, Send, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { useScheduleCActions } from '../../../../hooks/use-schedule-c-actions'
import type { NecBreakdownItem } from '../../../../lib/api-client'
import { formatUSD } from './format-utils'

interface ScheduleCEmptyStateProps {
  caseId: string
  count1099NEC: number
  necBreakdown?: NecBreakdownItem[]
}

export function ScheduleCEmptyState({ caseId, count1099NEC, necBreakdown = [] }: ScheduleCEmptyStateProps) {
  const { sendForm } = useScheduleCActions({ caseId })

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex flex-col items-center text-center py-8">
        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4" aria-hidden="true">
          <FileText className="w-6 h-6 text-primary" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Phát hiện 1099-NEC
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Đã phát hiện {count1099NEC} mẫu 1099-NEC đã xác minh.
          Gửi form thu thập chi phí để hoàn thành Schedule C cho khách hàng này.
        </p>

        {/* Payer Breakdown Preview */}
        {necBreakdown.length > 0 && (
          <div className="w-full max-w-sm mb-6 text-left">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
              {necBreakdown.map((item) => (
                <div key={item.docId} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground truncate mr-2">
                    {item.payerName || 'Không rõ'}
                  </span>
                  <span className="font-medium text-foreground whitespace-nowrap">
                    {formatUSD(item.nonemployeeCompensation)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Send Button */}
        <Button
          onClick={() => sendForm.mutate()}
          disabled={sendForm.isPending}
          size="lg"
          className="gap-2 px-16"
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
