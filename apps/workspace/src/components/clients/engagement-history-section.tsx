/**
 * EngagementHistorySection - Displays client's tax filing history across years
 * Shows engagements with tax year, status, and case count
 * Supports clicking to switch between engagements and creating new ones
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, FileText, Loader2, Plus } from 'lucide-react'
import { cn } from '@ella/ui'
import { api, type TaxEngagement, type EngagementStatus } from '../../lib/api-client'
import { CreateEngagementModal } from './create-engagement-modal'

interface EngagementHistorySectionProps {
  clientId: string
  /** Currently selected engagement ID */
  currentEngagementId?: string
  /** Callback when user clicks on an engagement row */
  onEngagementSelect?: (engagementId: string) => void
}

// Status display config
const STATUS_CONFIG: Record<EngagementStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-muted text-muted-foreground' },
  ACTIVE: { label: 'Đang xử lý', className: 'bg-primary-light text-primary' },
  COMPLETE: { label: 'Hoàn thành', className: 'bg-success-light text-success' },
  ARCHIVED: { label: 'Lưu trữ', className: 'bg-muted text-muted-foreground' },
}

export function EngagementHistorySection({
  clientId,
  currentEngagementId,
  onEngagementSelect,
}: EngagementHistorySectionProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['engagements', clientId],
    queryFn: () => api.engagements.list({ clientId, limit: 10 }),
  })

  const engagements = data?.data ?? []
  const existingYears = engagements.map((e) => e.taxYear)

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary">Lịch sử khai thuế</h2>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary">Lịch sử khai thuế</h2>
        </div>
        <p className="text-sm text-muted-foreground py-4 text-center">
          Không thể tải lịch sử khai thuế
        </p>
      </div>
    )
  }

  if (engagements.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-primary">Lịch sử khai thuế</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary-light rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm năm
          </button>
        </div>
        <p className="text-sm text-muted-foreground py-4 text-center">
          Chưa có lịch sử khai thuế
        </p>

        {showCreateModal && (
          <CreateEngagementModal
            clientId={clientId}
            existingYears={existingYears}
            onClose={() => setShowCreateModal(false)}
            onCreated={(newEngagementId) => {
              setShowCreateModal(false)
              onEngagementSelect?.(newEngagementId)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary">Lịch sử khai thuế</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {engagements.length} năm
          </span>
        </div>

        {/* Add year button */}
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary-light rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm năm
        </button>
      </div>

      <div className="space-y-2">
        {engagements.map((engagement) => (
          <EngagementRow
            key={engagement.id}
            engagement={engagement}
            isCurrent={engagement.id === currentEngagementId}
            onSelect={onEngagementSelect}
          />
        ))}
      </div>

      {/* Create engagement modal */}
      {showCreateModal && (
        <CreateEngagementModal
          clientId={clientId}
          existingYears={existingYears}
          latestEngagementId={engagements[0]?.id}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newEngagementId) => {
            setShowCreateModal(false)
            onEngagementSelect?.(newEngagementId)
          }}
        />
      )}
    </div>
  )
}

interface EngagementRowProps {
  engagement: TaxEngagement
  isCurrent?: boolean
  onSelect?: (engagementId: string) => void
}

function EngagementRow({ engagement, isCurrent, onSelect }: EngagementRowProps) {
  const statusConfig = STATUS_CONFIG[engagement.status]
  const caseCount = engagement._count?.taxCases ?? 0

  return (
    <button
      type="button"
      onClick={() => onSelect?.(engagement.id)}
      className={cn(
        'w-full flex items-center justify-between p-3 rounded-lg border transition-all',
        'cursor-pointer hover:border-primary/50',
        isCurrent
          ? 'border-primary bg-primary-light/30'
          : 'border-border bg-muted/20 hover:bg-muted/40'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-start">
          <span className="font-semibold text-foreground">
            {engagement.taxYear}
            {isCurrent && (
              <span className="ml-2 text-xs font-normal text-primary">(Hiện tại)</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {engagement.filingStatus || 'Chưa có tình trạng'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Case count */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="w-3.5 h-3.5" />
          <span>{caseCount} hồ sơ</span>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            statusConfig.className
          )}
        >
          {statusConfig.label}
        </span>
      </div>
    </button>
  )
}
