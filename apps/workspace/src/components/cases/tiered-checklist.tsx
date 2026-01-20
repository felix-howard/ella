/**
 * TieredChecklist - 3-tier checklist view with Required/Applicable/Optional grouping
 * Features: Staff override (add/skip items), tier-based visual hierarchy
 */

import { useState, useMemo } from 'react'
import { cn, Button, Badge } from '@ella/ui'
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Eye,
  SkipForward,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  Check,
  Circle,
  Minus,
  MessageSquare,
} from 'lucide-react'
import { CHECKLIST_TIERS, CHECKLIST_STATUS_DISPLAY, type ChecklistTierKey } from '../../lib/checklist-tier-constants'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { useSignedUrl } from '../../hooks/use-signed-url'
import { FileViewerModal } from '../file-viewer/file-viewer-modal'
import { ChecklistProgress } from './checklist-progress'
import { SkipItemModal } from './skip-item-modal'
import type { ChecklistItem, ChecklistItemStatus, ChecklistTemplate, RawImage } from '../../lib/api-client'

interface TieredChecklistProps {
  items: ChecklistItem[]
  isLoading?: boolean
  isStaffView?: boolean
  onAddItem?: () => void
  onSkip?: (itemId: string, reason: string) => void
  onUnskip?: (itemId: string) => void
  onVerify?: (item: ChecklistItem) => void
  onViewNotes?: (item: ChecklistItem) => void
}

export interface ChecklistItemWithTier extends ChecklistItem {
  tier: ChecklistTierKey
}

// Context label mappings for multi-entity doc types
const CONTEXT_LABEL_MAPPINGS: Record<string, { countKey: string; labelPrefix: string }> = {
  RENTAL_STATEMENT: { countKey: 'rentalPropertyCount', labelPrefix: 'Bất động sản' },
  RENTAL_PL: { countKey: 'rentalPropertyCount', labelPrefix: 'Bất động sản' },
  LEASE_AGREEMENT: { countKey: 'rentalPropertyCount', labelPrefix: 'Bất động sản' },
  SCHEDULE_K1: { countKey: 'k1Count', labelPrefix: 'K-1' },
  SCHEDULE_K1_1065: { countKey: 'k1Count', labelPrefix: 'K-1' },
  SCHEDULE_K1_1120S: { countKey: 'k1Count', labelPrefix: 'K-1' },
  SCHEDULE_K1_1041: { countKey: 'k1Count', labelPrefix: 'K-1' },
  W2: { countKey: 'w2Count', labelPrefix: 'W-2' },
}

/**
 * Group checklist items by tier based on template properties:
 * - Required: isRequired=true AND no condition
 * - Applicable: has condition (matched based on intake)
 * - Optional: isRequired=false AND no condition
 */
function groupItemsByTier(items: ChecklistItem[]): Record<ChecklistTierKey, ChecklistItem[]> {
  const result: Record<ChecklistTierKey, ChecklistItem[]> = {
    REQUIRED: [],
    APPLICABLE: [],
    OPTIONAL: [],
  }

  items.forEach(item => {
    const template = item.template as ChecklistTemplate | undefined
    if (!template) return

    // Required: isRequired=true AND no condition
    if (template.isRequired && !template.condition) {
      result.REQUIRED.push(item)
    }
    // Applicable: has condition (matched based on intake)
    else if (template.condition) {
      result.APPLICABLE.push(item)
    }
    // Optional: isRequired=false AND no condition
    else {
      result.OPTIONAL.push(item)
    }
  })

  return result
}

export function TieredChecklist({
  items,
  isLoading,
  isStaffView = false,
  onAddItem,
  onSkip,
  onUnskip,
  onVerify,
  onViewNotes,
}: TieredChecklistProps) {
  // File viewer modal state
  const [viewerFile, setViewerFile] = useState<{ imageId: string; filename: string } | null>(null)

  // Skip modal state
  const [skipItem, setSkipItem] = useState<{ id: string; label: string } | null>(null)

  // Group items by tier
  const groupedItems = useMemo(() => groupItemsByTier(items), [items])

  if (isLoading) {
    return <TieredChecklistSkeleton />
  }

  if (!items.length) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Không có tài liệu cần thu thập</p>
        {isStaffView && onAddItem && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onAddItem}>
            <Plus className="w-4 h-4 mr-1" /> Thêm mục
          </Button>
        )}
      </div>
    )
  }

  const handleOpenFile = (imageId: string, filename: string) => {
    setViewerFile({ imageId, filename })
  }

  // Handler for opening skip modal
  const handleOpenSkipModal = (itemId: string, itemLabel: string) => {
    setSkipItem({ id: itemId, label: itemLabel })
  }

  // Handler for submitting skip with reason
  const handleSkipSubmit = (reason: string) => {
    if (skipItem && onSkip) {
      onSkip(skipItem.id, reason)
    }
    setSkipItem(null)
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <ChecklistProgress items={items} />

      {/* Staff actions */}
      {isStaffView && onAddItem && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAddItem}>
            <Plus className="w-4 h-4 mr-1" /> Thêm mục
          </Button>
        </div>
      )}

      {/* Tier sections */}
      {Object.entries(CHECKLIST_TIERS).map(([tierKey, tierConfig]) => {
        const tierItems = groupedItems[tierKey as ChecklistTierKey]
        if (tierItems.length === 0) return null

        return (
          <TierSection
            key={tierKey}
            tier={tierConfig}
            items={tierItems}
            isStaffView={isStaffView}
            onSkip={handleOpenSkipModal}
            onUnskip={onUnskip}
            onVerify={onVerify}
            onViewNotes={onViewNotes}
            onOpenFile={handleOpenFile}
          />
        )
      })}

      {/* Skip item modal */}
      <SkipItemModal
        isOpen={!!skipItem}
        onClose={() => setSkipItem(null)}
        onSubmit={handleSkipSubmit}
        itemLabel={skipItem?.label}
      />

      {/* File viewer modal */}
      {viewerFile && (
        <FileViewerWrapper
          imageId={viewerFile.imageId}
          filename={viewerFile.filename}
          isOpen={!!viewerFile}
          onClose={() => setViewerFile(null)}
        />
      )}
    </div>
  )
}

// Wrapper to fetch signed URL for file viewer
function FileViewerWrapper({
  imageId,
  filename,
  isOpen,
  onClose,
}: {
  imageId: string
  filename: string
  isOpen: boolean
  onClose: () => void
}) {
  const { data: signedUrlData, isLoading, error } = useSignedUrl(imageId, {
    enabled: isOpen,
    staleTime: 55 * 60 * 1000,
  })

  return (
    <FileViewerModal
      url={signedUrlData?.url || null}
      filename={filename}
      isOpen={isOpen}
      onClose={onClose}
      isLoading={isLoading}
      error={error ? 'Không thể tải file' : null}
    />
  )
}

type TierConfig = typeof CHECKLIST_TIERS[ChecklistTierKey]

interface TierSectionProps {
  tier: TierConfig
  items: ChecklistItem[]
  isStaffView?: boolean
  onSkip?: (itemId: string, itemLabel: string) => void
  onUnskip?: (itemId: string) => void
  onVerify?: (item: ChecklistItem) => void
  onViewNotes?: (item: ChecklistItem) => void
  onOpenFile: (imageId: string, filename: string) => void
}

function TierSection({
  tier,
  items,
  isStaffView,
  onSkip,
  onUnskip,
  onVerify,
  onViewNotes,
  onOpenFile,
}: TierSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Calculate tier stats
  const stats = useMemo(() => {
    const active = items.filter(i => i.status !== 'NOT_REQUIRED')
    const received = active.filter(i => ['HAS_RAW', 'HAS_DIGITAL', 'VERIFIED'].includes(i.status))
    return { total: active.length, received: received.length }
  }, [items])

  return (
    <div className={cn('rounded-lg border', tier.borderColor)}>
      {/* Tier header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 text-left',
          tier.bgColor,
          'rounded-t-lg',
          !isExpanded && 'rounded-b-lg'
        )}
      >
        {isExpanded ? (
          <ChevronDown className={cn('w-4 h-4', tier.color)} />
        ) : (
          <ChevronRight className={cn('w-4 h-4', tier.color)} />
        )}
        <span className="text-sm mr-1">{tier.icon}</span>
        <span className={cn('text-sm font-semibold flex-1', tier.color)}>
          {tier.labelVi}
        </span>
        <span className={cn('text-xs font-medium', tier.color)}>
          {stats.received}/{stats.total}
        </span>
      </button>

      {/* Tier content */}
      {isExpanded && (
        <div className="divide-y divide-border/50">
          {items.map(item => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              isStaffView={isStaffView}
              onSkip={onSkip}
              onUnskip={onUnskip}
              onVerify={onVerify}
              onViewNotes={onViewNotes}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ChecklistItemRowProps {
  item: ChecklistItem
  isStaffView?: boolean
  onSkip?: (itemId: string, itemLabel: string) => void
  onUnskip?: (itemId: string) => void
  onVerify?: (item: ChecklistItem) => void
  onViewNotes?: (item: ChecklistItem) => void
  onOpenFile: (imageId: string, filename: string) => void
}

function ChecklistItemRow({
  item,
  isStaffView,
  onSkip,
  onUnskip,
  onVerify,
  onViewNotes,
  onOpenFile,
}: ChecklistItemRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const status = item.status as ChecklistItemStatus
  const statusConfig = CHECKLIST_STATUS_DISPLAY[status] || CHECKLIST_STATUS_DISPLAY.MISSING
  const docLabel = DOC_TYPE_LABELS[item.template?.docType] || item.template?.labelVi || 'Tài liệu'
  const hasFiles = (item.rawImages?.length || 0) > 0
  const canVerify = status === 'HAS_DIGITAL' || status === 'HAS_RAW'
  const isSkipped = status === 'NOT_REQUIRED'
  const isManuallyAdded = item.isManuallyAdded
  const hasNotes = item.notes || item.addedReason || item.skippedReason

  // Count info for multi-doc items
  const expectedCount = item.expectedCount || 1
  const receivedCount = item.receivedCount || 0
  const needsMore = expectedCount > 1 && receivedCount < expectedCount

  // Context label for multi-entity items (e.g., "Rental #1", "K-1 #2")
  // Note: Context is shown when expectedCount > 1 for multi-entity doc types
  const contextLabel = useMemo(() => {
    const docType = item.template?.docType
    if (!docType) return null

    const mapping = CONTEXT_LABEL_MAPPINGS[docType]
    if (!mapping) return null

    // Only show context if expectedCount > 1 (multi-entity)
    if (expectedCount <= 1) return null

    // Show the label prefix to indicate this is a multi-entity item
    return mapping.labelPrefix
  }, [item.template?.docType, expectedCount])

  return (
    <div className={cn(
      'group',
      isSkipped && 'opacity-60'
    )}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Expand toggle */}
        {hasFiles ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Status indicator */}
        <span
          className={cn('flex items-center justify-center w-5 h-5 rounded-full text-xs', statusConfig.bgColor)}
          title={statusConfig.labelVi}
        >
          {status === 'VERIFIED' && <Check className={cn('w-3.5 h-3.5', statusConfig.color)} />}
          {status === 'HAS_DIGITAL' && <Circle className={cn('w-3 h-3 fill-current', statusConfig.color)} />}
          {status === 'HAS_RAW' && <Circle className={cn('w-3 h-3', statusConfig.color)} />}
          {status === 'MISSING' && <span className={cn('text-xs font-medium', statusConfig.color)}>✗</span>}
          {status === 'NOT_REQUIRED' && <Minus className={cn('w-3.5 h-3.5', statusConfig.color)} />}
        </span>

        {/* Doc type label with context */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn(
            'text-sm truncate',
            isSkipped ? 'text-muted-foreground line-through' : 'text-foreground'
          )}>
            {docLabel}
          </span>
          {contextLabel && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0">
              {contextLabel}
            </span>
          )}
        </div>

        {/* Badges */}
        {isManuallyAdded && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            Thêm thủ công
          </Badge>
        )}
        {needsMore && (
          <span className="text-xs text-warning">
            {receivedCount}/{expectedCount}
          </span>
        )}

        {/* Notes indicator */}
        {hasNotes && (
          <button
            onClick={() => onViewNotes?.(item)}
            className="p-1 rounded hover:bg-muted"
            title="Xem ghi chú"
          >
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}

        {/* Staff actions */}
        {isStaffView && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canVerify && onVerify && (
              <button
                onClick={() => onVerify(item)}
                className="p-1 rounded hover:bg-primary/10"
                title="Xác minh"
              >
                <Eye className="w-4 h-4 text-primary" />
              </button>
            )}
            {!isSkipped && onSkip && (
              <button
                onClick={() => onSkip(item.id, docLabel)}
                className="p-1 rounded hover:bg-warning/10"
                title="Bỏ qua"
                aria-label={`Bỏ qua ${docLabel}`}
              >
                <SkipForward className="w-4 h-4 text-warning" />
              </button>
            )}
            {isSkipped && onUnskip && (
              <button
                onClick={() => onUnskip(item.id)}
                className="p-1 rounded hover:bg-primary/10"
                title="Khôi phục"
              >
                <RotateCcw className="w-4 h-4 text-primary" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Skipped reason */}
      {isSkipped && item.skippedReason && (
        <div className="px-3 pb-2 pl-10 text-xs text-muted-foreground italic">
          Lý do: {item.skippedReason}
        </div>
      )}

      {/* Manually added reason */}
      {isManuallyAdded && item.addedReason && !isExpanded && (
        <div className="px-3 pb-2 pl-10 text-xs text-muted-foreground italic">
          Lý do thêm: {item.addedReason}
        </div>
      )}

      {/* Files list */}
      {isExpanded && hasFiles && (
        <div className="pl-10 pb-2 pr-3">
          {item.rawImages?.map(image => (
            <FileItem
              key={image.id}
              image={image}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileItemProps {
  image: RawImage
  onOpenFile: (imageId: string, filename: string) => void
}

function FileItem({ image, onOpenFile }: FileItemProps) {
  const isPdf = image.filename?.toLowerCase().endsWith('.pdf')

  return (
    <div
      onClick={() => onOpenFile(image.id, image.filename)}
      className="flex items-center gap-2 px-2 py-1.5 rounded group/file hover:bg-muted/50 cursor-pointer"
    >
      {isPdf ? (
        <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
      ) : (
        <ImageIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
      )}
      <span className="text-xs text-muted-foreground flex-1 truncate">
        {image.filename}
      </span>
      <Eye className="w-3.5 h-3.5 text-primary opacity-0 group-hover/file:opacity-100 transition-opacity" />
    </div>
  )
}

/**
 * Skeleton loader
 */
export function TieredChecklistSkeleton() {
  return (
    <div className="space-y-4">
      {/* Progress skeleton */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="w-40 h-4 bg-muted rounded animate-pulse" />
          <div className="w-8 h-4 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-2 bg-muted rounded-full animate-pulse" />
      </div>

      {/* Tier sections skeleton */}
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-lg border border-muted">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
            <div className="w-4 h-4 bg-muted rounded animate-pulse" />
            <div className="w-24 h-4 bg-muted rounded animate-pulse" />
            <div className="ml-auto w-8 h-4 bg-muted rounded animate-pulse" />
          </div>
          <div className="p-2 space-y-2">
            {[1, 2].map(j => (
              <div key={j} className="flex items-center gap-2 px-3 py-2">
                <div className="w-5 h-5 bg-muted rounded-full animate-pulse" />
                <div className="w-32 h-4 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
