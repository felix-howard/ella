/**
 * Schedule C Waiting State - Shows when form sent but client hasn't submitted
 * Displays magic link status and prefilled income
 */
import { Send, Eye, Clock } from 'lucide-react'
import type { ScheduleCExpense, ScheduleCMagicLink } from '../../../../lib/api-client'
import { formatDateTime } from './format-utils'
import { IncomeTable } from './income-table'
import { ScheduleCActions } from './schedule-c-actions'
import { StatusBadge } from './status-badge'

interface ScheduleCWaitingProps {
  expense: ScheduleCExpense
  magicLink: ScheduleCMagicLink | null
  caseId: string
}

export function ScheduleCWaiting({ expense, magicLink, caseId }: ScheduleCWaitingProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Schedule C</h2>
        <StatusBadge status="DRAFT" />
      </div>

      {/* Magic Link Timeline */}
      <div className="space-y-3">
        {/* Sent */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Form đã gửi</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(expense.createdAt, 'DATETIME_FULL')}
            </p>
          </div>
        </div>

        {/* No magic link fallback */}
        {!magicLink && (
          <p className="text-xs text-muted-foreground italic">
            Link đã hết hạn hoặc không khả dụng. Nhấn "Gửi lại link" để tạo link mới.
          </p>
        )}

        {/* Accessed */}
        {magicLink?.lastUsedAt && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <Eye className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Đã truy cập {magicLink.usageCount} lần
              </p>
              <p className="text-xs text-muted-foreground">
                Lần cuối: {formatDateTime(magicLink.lastUsedAt, 'SHORT_DATETIME')}
              </p>
            </div>
          </div>
        )}

        {/* Expiry */}
        {magicLink?.expiresAt && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Hết hạn</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(magicLink.expiresAt, 'DATE_ONLY')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Waiting Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Khách hàng chưa gửi form. Đợi khách hàng điền chi phí kinh doanh.
        </p>
      </div>

      {/* Prefilled Income */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Thu nhập đã điền sẵn (từ 1099-NEC)
        </h3>
        <IncomeTable expense={expense} />
      </div>

      {/* Actions */}
      <ScheduleCActions caseId={caseId} status={expense.status} />
    </div>
  )
}
