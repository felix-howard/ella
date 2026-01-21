/**
 * Checklist Grid Component - Visual cards showing document checklist status
 * Displays checklist items with status badges, thumbnail strips, and quick actions
 * Supports drag & drop for moving images between checklist items
 */

import { useState } from 'react'
import { cn } from '@ella/ui'
import {
  Check,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Loader2,
  GripVertical,
  Plus,
} from 'lucide-react'
import {
  DOC_TYPE_LABELS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_COLORS,
  UI_TEXT,
} from '../../lib/constants'
import { useSignedUrl } from '../../hooks/use-signed-url'
import type { ChecklistItem, ChecklistItemStatus, RawImage } from '../../lib/api-client'

interface ChecklistGridProps {
  items: ChecklistItem[]
  isLoading?: boolean
  onItemClick?: (item: ChecklistItem) => void
  onVerify?: (item: ChecklistItem) => void
  onImageDrop?: (imageId: string, targetChecklistItemId: string) => void
  enableDragDrop?: boolean
}

// Icon mapping for each status
const STATUS_ICONS: Record<ChecklistItemStatus, typeof Check> = {
  VERIFIED: Check,
  HAS_DIGITAL: FileText,
  HAS_RAW: ImageIcon,
  MISSING: AlertCircle,
  NOT_REQUIRED: MoreHorizontal,
}

export function ChecklistGrid({
  items,
  isLoading,
  onItemClick,
  onVerify,
  onImageDrop,
  enableDragDrop = false,
}: ChecklistGridProps) {
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)

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

  // Handle drag over checklist item
  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    if (!enableDragDrop) return
    e.preventDefault()
    setDragOverItemId(itemId)
  }

  const handleDragLeave = () => {
    setDragOverItemId(null)
  }

  const handleDrop = (e: React.DragEvent, targetItemId: string) => {
    if (!enableDragDrop) return
    e.preventDefault()
    setDragOverItemId(null)
    const imageId = e.dataTransfer.getData('imageId')
    if (imageId && onImageDrop) {
      onImageDrop(imageId, targetItemId)
    }
  }

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
            enableDragDrop={enableDragDrop}
            isDragOver={dragOverItemId === item.id}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item.id)}
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
  enableDragDrop?: boolean
  isDragOver?: boolean
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent) => void
}

function ChecklistCard({
  item,
  onClick,
  onVerify,
  enableDragDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: ChecklistCardProps) {
  const status = item.status as ChecklistItemStatus
  const colors = CHECKLIST_STATUS_COLORS[status] || { bg: 'bg-muted', text: 'text-muted-foreground' }
  const Icon = STATUS_ICONS[status] || FileText
  const docLabel = DOC_TYPE_LABELS[item.template?.docType] || item.template?.labelVi || 'Tài liệu'
  const canVerify = status === 'HAS_DIGITAL' || status === 'HAS_RAW'
  const hasImages = (item.rawImages?.length || 0) > 0

  return (
    <div
      className={cn(
        'group relative bg-card rounded-xl border p-4 transition-all',
        'hover:shadow-md hover:border-primary/30',
        onClick && 'cursor-pointer',
        isDragOver && 'border-primary border-2 bg-primary/5'
      )}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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

      {/* Thumbnail Strip - Show images for this checklist item */}
      {hasImages && (
        <div className="mt-2 mb-2">
          <ThumbnailStrip
            images={item.rawImages || []}
            enableDragDrop={enableDragDrop}
          />
        </div>
      )}

      {/* Linked items count (shown when no thumbnails) */}
      {!hasImages && (item.digitalDocs?.length) ? (
        <p className="text-xs text-muted-foreground">
          {item.digitalDocs.length} tài liệu
        </p>
      ) : null}

      {/* Drop zone indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-xl pointer-events-none">
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <Plus className="w-4 h-4" />
            Thả ảnh vào đây
          </div>
        </div>
      )}

      {/* Quick Actions - Show on hover */}
      {canVerify && !isDragOver && (
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

/**
 * Thumbnail Strip - Shows small image previews for multi-page documents
 */
interface ThumbnailStripProps {
  images: RawImage[]
  enableDragDrop?: boolean
  maxVisible?: number
}

function ThumbnailStrip({ images, enableDragDrop, maxVisible = 4 }: ThumbnailStripProps) {
  const visibleImages = images.slice(0, maxVisible)
  const hiddenCount = images.length - maxVisible

  return (
    <div className="flex items-center gap-1.5">
      {visibleImages.map((image) => (
        <ThumbnailItem
          key={image.id}
          image={image}
          enableDragDrop={enableDragDrop}
        />
      ))}
      {hiddenCount > 0 && (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
          +{hiddenCount}
        </div>
      )}
    </div>
  )
}

/**
 * Single draggable thumbnail
 */
interface ThumbnailItemProps {
  image: RawImage
  enableDragDrop?: boolean
}

function ThumbnailItem({ image, enableDragDrop }: ThumbnailItemProps) {
  const { data: signedUrlData, isLoading } = useSignedUrl(image.id, {
    staleTime: 55 * 60 * 1000,
  })

  const handleDragStart = (e: React.DragEvent) => {
    if (!enableDragDrop) return
    e.dataTransfer.setData('imageId', image.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const isPdf = image.filename?.toLowerCase().endsWith('.pdf')

  return (
    <div
      draggable={enableDragDrop}
      onDragStart={handleDragStart}
      className={cn(
        'relative w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0',
        'border border-border',
        enableDragDrop && 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary/50'
      )}
      title={image.filename}
    >
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
        </div>
      ) : isPdf ? (
        <div className="w-full h-full flex items-center justify-center bg-red-50">
          <FileText className="w-4 h-4 text-red-500" />
        </div>
      ) : signedUrlData?.url ? (
        <img
          src={signedUrlData.url}
          alt={image.filename}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      {/* Drag handle indicator */}
      {enableDragDrop && (
        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
          <GripVertical className="w-3 h-3 text-white" />
        </div>
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
