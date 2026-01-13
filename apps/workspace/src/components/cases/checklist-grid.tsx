/**
 * Checklist Grid Component - Visual cards showing document checklist status
 * Displays checklist items with status badges and quick actions
 */

import { cn } from '@ella/ui'
import {
  Check,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  MoreHorizontal,
  Eye,
} from 'lucide-react'
import {
  DOC_TYPE_LABELS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_COLORS,
  UI_TEXT,
} from '../../lib/constants'
import type { ChecklistItem, ChecklistItemStatus } from '../../lib/api-client'

interface ChecklistGridProps {
  items: ChecklistItem[]
  isLoading?: boolean
  onItemClick?: (item: ChecklistItem) => void
  onVerify?: (item: ChecklistItem) => void
}

// Icon mapping for each status
const STATUS_ICONS: Record<ChecklistItemStatus, typeof Check> = {
  VERIFIED: Check,
  HAS_DIGITAL: FileText,
  HAS_RAW: ImageIcon,
  MISSING: AlertCircle,
  NOT_REQUIRED: MoreHorizontal,
}

export function ChecklistGrid({ items, isLoading, onItemClick, onVerify }: ChecklistGridProps) {
  if (isLoading) {
    return <ChecklistGridSkeleton />
  }

  if (!items.length) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{UI_TEXT.noData}</p>
      </div>
    )
  }

  // Group by status for better overview (available for future grouped view)
  const _groupedItems = groupByStatus(items)

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <ChecklistSummary items={items} />

      {/* Grid View */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <ChecklistCard
            key={item.id}
            item={item}
            onClick={() => onItemClick?.(item)}
            onVerify={() => onVerify?.(item)}
          />
        ))}
      </div>
    </div>
  )
}

interface ChecklistCardProps {
  item: ChecklistItem
  onClick?: () => void
  onVerify?: () => void
}

function ChecklistCard({ item, onClick, onVerify }: ChecklistCardProps) {
  const status = item.status as ChecklistItemStatus
  const colors = CHECKLIST_STATUS_COLORS[status] || { bg: 'bg-muted', text: 'text-muted-foreground' }
  const Icon = STATUS_ICONS[status] || FileText
  const docLabel = DOC_TYPE_LABELS[item.template?.docType] || item.template?.labelVi || 'Tài liệu'
  const canVerify = status === 'HAS_DIGITAL' || status === 'HAS_RAW'

  return (
    <div
      className={cn(
        'group relative bg-card rounded-xl border p-4 transition-all',
        'hover:shadow-md hover:border-primary/30',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Status Indicator */}
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg', colors.bg)}>
          <Icon className={cn('w-4 h-4', colors.text)} aria-hidden="true" />
        </div>
        <span
          className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            colors.bg,
            colors.text
          )}
        >
          {CHECKLIST_STATUS_LABELS[status]}
        </span>
      </div>

      {/* Document Type */}
      <h4 className="font-medium text-foreground text-sm mb-1 line-clamp-2">
        {docLabel}
      </h4>

      {/* Linked items count */}
      {(item.rawImages?.length || item.digitalDocs?.length) ? (
        <p className="text-xs text-muted-foreground">
          {item.rawImages?.length ? `${item.rawImages.length} ảnh` : ''}
          {item.rawImages?.length && item.digitalDocs?.length ? ' • ' : ''}
          {item.digitalDocs?.length ? `${item.digitalDocs.length} tài liệu` : ''}
        </p>
      ) : null}

      {/* Quick Actions - Show on hover */}
      {canVerify && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onVerify?.()
          }}
          className={cn(
            'absolute bottom-3 right-3 p-1.5 rounded-lg',
            'bg-primary text-white opacity-0 group-hover:opacity-100',
            'transition-opacity hover:bg-primary-dark'
          )}
          aria-label="Xác minh tài liệu"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

interface ChecklistSummaryProps {
  items: ChecklistItem[]
}

function ChecklistSummary({ items }: ChecklistSummaryProps) {
  const summary = {
    total: items.length,
    verified: items.filter((i) => i.status === 'VERIFIED').length,
    hasDigital: items.filter((i) => i.status === 'HAS_DIGITAL').length,
    hasRaw: items.filter((i) => i.status === 'HAS_RAW').length,
    missing: items.filter((i) => i.status === 'MISSING').length,
  }

  const progress = summary.total > 0
    ? Math.round((summary.verified / summary.total) * 100)
    : 0

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-xl">
      {/* Progress Circle */}
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-border"
          />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${progress * 0.88} 100`}
            className="text-primary"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-foreground">{progress}%</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        <SummaryItem
          label="Đã xác minh"
          count={summary.verified}
          color="text-success"
          bgColor="bg-success/10"
        />
        <SummaryItem
          label="Đã trích xuất"
          count={summary.hasDigital}
          color="text-primary"
          bgColor="bg-primary-light"
        />
        <SummaryItem
          label="Đã nhận ảnh"
          count={summary.hasRaw}
          color="text-warning"
          bgColor="bg-warning-light"
        />
        <SummaryItem
          label="Còn thiếu"
          count={summary.missing}
          color="text-error"
          bgColor="bg-error-light"
        />
      </div>
    </div>
  )
}

interface SummaryItemProps {
  label: string
  count: number
  color: string
  bgColor: string
}

function SummaryItem({ label, count, color, bgColor }: SummaryItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', bgColor, color)}>
        {count}
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

function groupByStatus(items: ChecklistItem[]): Record<ChecklistItemStatus, ChecklistItem[]> {
  return items.reduce(
    (acc, item) => {
      const status = item.status as ChecklistItemStatus
      if (!acc[status]) acc[status] = []
      acc[status].push(item)
      return acc
    },
    {} as Record<ChecklistItemStatus, ChecklistItem[]>
  )
}

/**
 * Skeleton loader for Checklist Grid
 */
export function ChecklistGridSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary Skeleton */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
        <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
              <div className="w-16 h-4 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
              <div className="w-16 h-5 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="w-3/4 h-4 bg-muted rounded animate-pulse mb-2" />
            <div className="w-1/2 h-3 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
