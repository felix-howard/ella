/**
 * TieredChecklist - Category-based checklist view grouped by document type
 * Features: Staff override (add/skip items), category-based visual hierarchy
 * Redesigned for Document Tab UX - Phase 02
 */

import { useState, useMemo } from 'react'
import { cn, Button, Badge } from '@ella/ui'
import {
  ChevronRight,
  ChevronDown,
  Plus,
  SkipForward,
  RotateCcw,
  FileText,
  Check,
  Circle,
  Minus,
  MessageSquare,
} from 'lucide-react'
import { CATEGORY_STYLES, SIMPLIFIED_STATUS_DISPLAY, type CategoryKey } from '../../lib/checklist-tier-constants'
import { DOC_TYPE_LABELS, DOC_TYPE_CATEGORIES } from '../../lib/constants'
import { ChecklistProgress } from './checklist-progress'
import { SkipItemModal } from './skip-item-modal'
import { useSignedUrl } from '../../hooks/use-signed-url'
import type { ChecklistItem, ChecklistItemStatus, DigitalDoc } from '../../lib/api-client'

interface TieredChecklistProps {
  items: ChecklistItem[]
  /** All digital docs for the case - used to display docs under checklist items */
  digitalDocs?: DigitalDoc[]
  isLoading?: boolean
  isStaffView?: boolean
  onAddItem?: () => void
  onSkip?: (itemId: string, reason: string) => void
  onUnskip?: (itemId: string) => void
  /** Called when a document under a checklist item is double-clicked */
  onDocVerify?: (doc: DigitalDoc) => void
  onViewNotes?: (item: ChecklistItem) => void
}

// Category group structure for rendering
interface CategoryGroup {
  key: CategoryKey
  label: string
  items: ChecklistItem[]
}

/**
 * Find which category a docType belongs to
 */
function findCategoryForDocType(docType: string | undefined): CategoryKey {
  if (!docType) return 'other'
  for (const [key, config] of Object.entries(DOC_TYPE_CATEGORIES)) {
    if (config.docTypes.includes(docType)) {
      return key as CategoryKey
    }
  }
  return 'other'
}

/**
 * Group checklist items by document category (personal, income, deductions, business, other)
 * Order follows DOC_TYPE_CATEGORIES definition order
 */
function groupItemsByCategory(items: ChecklistItem[]): CategoryGroup[] {
  const groups: Record<string, ChecklistItem[]> = {}

  for (const item of items) {
    const docType = item.template?.docType
    const category = findCategoryForDocType(docType)
    if (!groups[category]) groups[category] = []
    groups[category].push(item)
  }

  // Return in DOC_TYPE_CATEGORIES order, filter empty groups
  return Object.keys(DOC_TYPE_CATEGORIES)
    .map(key => ({
      key: key as CategoryKey,
      label: DOC_TYPE_CATEGORIES[key].label,
      items: groups[key] || [],
    }))
    .filter(g => g.items.length > 0)
}

/**
 * Get simplified status display - consolidates 5 statuses into 3 visual states
 */
function getSimplifiedStatus(status: ChecklistItemStatus) {
  if (status === 'MISSING') return SIMPLIFIED_STATUS_DISPLAY.MISSING
  if (status === 'VERIFIED') return SIMPLIFIED_STATUS_DISPLAY.VERIFIED
  if (status === 'HAS_RAW' || status === 'HAS_DIGITAL') return SIMPLIFIED_STATUS_DISPLAY.SUBMITTED
  return SIMPLIFIED_STATUS_DISPLAY.NOT_REQUIRED
}

export function TieredChecklist({
  items,
  digitalDocs = [],
  isLoading,
  isStaffView = false,
  onAddItem,
  onSkip,
  onUnskip,
  onDocVerify,
  onViewNotes,
}: TieredChecklistProps) {
  // Skip modal state
  const [skipItem, setSkipItem] = useState<{ id: string; label: string } | null>(null)

  // Group items by category
  const categoryGroups = useMemo(() => groupItemsByCategory(items), [items])

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

      {/* Category sections */}
      {categoryGroups.map(group => (
        <CategorySection
          key={group.key}
          categoryKey={group.key}
          label={group.label}
          items={group.items}
          digitalDocs={digitalDocs}
          isStaffView={isStaffView}
          onSkip={handleOpenSkipModal}
          onUnskip={onUnskip}
          onDocVerify={onDocVerify}
          onViewNotes={onViewNotes}
        />
      ))}

      {/* Skip item modal */}
      <SkipItemModal
        isOpen={!!skipItem}
        onClose={() => setSkipItem(null)}
        onSubmit={handleSkipSubmit}
        itemLabel={skipItem?.label}
      />
    </div>
  )
}

/**
 * CategorySection - Collapsible section for document category grouping
 */
interface CategorySectionProps {
  categoryKey: CategoryKey
  label: string
  items: ChecklistItem[]
  digitalDocs?: DigitalDoc[]
  isStaffView?: boolean
  onSkip?: (itemId: string, itemLabel: string) => void
  onUnskip?: (itemId: string) => void
  onDocVerify?: (doc: DigitalDoc) => void
  onViewNotes?: (item: ChecklistItem) => void
}

function CategorySection({
  categoryKey,
  label,
  items,
  digitalDocs = [],
  isStaffView,
  onSkip,
  onUnskip,
  onDocVerify,
  onViewNotes,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const style = CATEGORY_STYLES[categoryKey]

  // Calculate category stats
  const stats = useMemo(() => {
    const active = items.filter(i => i.status !== 'NOT_REQUIRED')
    const received = active.filter(i => ['HAS_RAW', 'HAS_DIGITAL', 'VERIFIED'].includes(i.status))
    return { total: active.length, received: received.length }
  }, [items])

  return (
    <div className={cn('rounded-lg border', style.borderColor)}>
      {/* Category header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 text-left',
          style.bgColor,
          'rounded-t-lg',
          !isExpanded && 'rounded-b-lg'
        )}
      >
        {isExpanded ? (
          <ChevronDown className={cn('w-4 h-4', style.color)} />
        ) : (
          <ChevronRight className={cn('w-4 h-4', style.color)} />
        )}
        <span className="text-sm mr-1">{style.icon}</span>
        <span className={cn('text-sm font-semibold flex-1', style.color)}>
          {label}
        </span>
        <span className={cn('text-xs font-medium', style.color)}>
          {stats.received}/{stats.total}
        </span>
      </button>

      {/* Category content */}
      {isExpanded && (
        <div className="divide-y divide-border/50">
          {items.map(item => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              digitalDocs={digitalDocs}
              isStaffView={isStaffView}
              onSkip={onSkip}
              onUnskip={onUnskip}
              onDocVerify={onDocVerify}
              onViewNotes={onViewNotes}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * ChecklistItemRow - Row for checklist item with expandable documents section
 * Documents under the item can be double-clicked to open verification modal
 */
interface ChecklistItemRowProps {
  item: ChecklistItem
  digitalDocs?: DigitalDoc[]
  isStaffView?: boolean
  onSkip?: (itemId: string, itemLabel: string) => void
  onUnskip?: (itemId: string) => void
  onDocVerify?: (doc: DigitalDoc) => void
  onViewNotes?: (item: ChecklistItem) => void
}

function ChecklistItemRow({
  item,
  digitalDocs = [],
  isStaffView,
  onSkip,
  onUnskip,
  onDocVerify,
  onViewNotes,
}: ChecklistItemRowProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const status = item.status as ChecklistItemStatus
  const simplifiedStatus = getSimplifiedStatus(status)
  const docLabel = DOC_TYPE_LABELS[item.template?.docType] || item.template?.labelVi || 'Tài liệu'
  const isSkipped = status === 'NOT_REQUIRED'
  const isManuallyAdded = item.isManuallyAdded
  const hasNotes = item.notes || item.addedReason || item.skippedReason

  // Count info for multi-doc items
  const expectedCount = item.expectedCount || 1
  const receivedCount = item.receivedCount || 0
  const needsMore = expectedCount > 1 && receivedCount < expectedCount

  // Find documents associated with this checklist item by docType
  const itemDocs = useMemo(() => {
    const docType = item.template?.docType
    if (!docType) return []
    return digitalDocs.filter(doc => doc.docType === docType)
  }, [digitalDocs, item.template?.docType])

  const hasDocuments = itemDocs.length > 0

  return (
    <div className={cn('group', isSkipped && 'opacity-60')}>
      {/* Main row - shows checklist item info */}
      <div
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5',
          hasDocuments && 'cursor-pointer hover:bg-muted/30',
          !hasDocuments && 'cursor-default'
        )}
        onClick={() => hasDocuments && setIsExpanded(!isExpanded)}
      >
        {/* Expand/collapse indicator for items with docs */}
        {hasDocuments ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )
        ) : (
          <div className="w-4" /> // Spacer for alignment
        )}

        {/* Status indicator */}
        <span
          className={cn('flex items-center justify-center w-5 h-5 rounded-full text-xs', simplifiedStatus.bgColor)}
          title={simplifiedStatus.labelVi}
        >
          {status === 'VERIFIED' && <Check className={cn('w-3.5 h-3.5', simplifiedStatus.color)} />}
          {(status === 'HAS_DIGITAL' || status === 'HAS_RAW') && (
            <Circle className={cn('w-3 h-3 fill-current', simplifiedStatus.color)} />
          )}
          {status === 'MISSING' && <span className={cn('text-xs font-medium', simplifiedStatus.color)}>✗</span>}
          {status === 'NOT_REQUIRED' && <Minus className={cn('w-3.5 h-3.5', simplifiedStatus.color)} />}
        </span>

        {/* Doc type label */}
        <span className={cn(
          'text-sm truncate flex-1 text-left',
          isSkipped ? 'text-muted-foreground line-through' : 'text-foreground'
        )}>
          {docLabel}
        </span>

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

        {/* Status badge */}
        <span className={cn('text-xs px-2 py-0.5 rounded', simplifiedStatus.bgColor, simplifiedStatus.color)}>
          {simplifiedStatus.labelVi}
        </span>
      </div>

      {/* Documents section - shown when item has documents and is expanded */}
      {hasDocuments && isExpanded && (
        <div className="px-3 pb-2 pl-10">
          <div className="flex flex-wrap gap-2">
            {itemDocs.map(doc => (
              <DocumentThumbnail
                key={doc.id}
                doc={doc}
                onDoubleClick={() => onDocVerify?.(doc)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action buttons row */}
      {(hasNotes || isStaffView) && (
        <div className="flex items-center gap-1 px-3 pb-2 justify-end">
          {/* Notes indicator */}
          {hasNotes && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewNotes?.(item) }}
              className="p-1 rounded hover:bg-muted"
              title="Xem ghi chú"
            >
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}

          {/* Staff actions */}
          {isStaffView && (
            <>
              {!isSkipped && onSkip && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSkip(item.id, docLabel) }}
                  className="p-1 rounded hover:bg-warning/10"
                  title="Bỏ qua"
                  aria-label={`Bỏ qua ${docLabel}`}
                >
                  <SkipForward className="w-4 h-4 text-warning" />
                </button>
              )}
              {isSkipped && onUnskip && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUnskip(item.id) }}
                  className="p-1 rounded hover:bg-primary/10"
                  title="Khôi phục"
                >
                  <RotateCcw className="w-4 h-4 text-primary" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Skipped reason */}
      {isSkipped && item.skippedReason && (
        <div className="px-3 pb-2 text-xs text-muted-foreground italic">
          Lý do: {item.skippedReason}
        </div>
      )}
    </div>
  )
}

/**
 * DocumentThumbnail - Thumbnail preview of a document with filename
 * Double-click to open verification modal
 */
interface DocumentThumbnailProps {
  doc: DigitalDoc
  onDoubleClick: () => void
}

function DocumentThumbnail({ doc, onDoubleClick }: DocumentThumbnailProps) {
  const [imgError, setImgError] = useState(false)
  // Get signed URL for the raw image
  const rawImageId = doc.rawImageId || doc.rawImage?.id
  const { data: signedUrlData, isLoading: isUrlLoading } = useSignedUrl(rawImageId || null)

  const filename = doc.rawImage?.filename || 'Document'

  const showImage = signedUrlData?.url && !imgError

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 p-2 rounded-lg border border-border cursor-pointer',
        'hover:bg-muted/50 hover:border-primary/50 transition-all',
        'bg-background w-28'
      )}
      onDoubleClick={onDoubleClick}
      title={`Nhấp đúp để xem: ${filename}`}
    >
      {/* Image preview */}
      <div className="w-24 h-24 rounded overflow-hidden bg-muted/30 flex items-center justify-center">
        {isUrlLoading ? (
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : showImage ? (
          <img
            src={signedUrlData.url}
            alt={filename}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <FileText className="w-10 h-10 text-muted-foreground" />
        )}
      </div>
      {/* Filename - wrap to multiple lines */}
      <span className="text-xs text-muted-foreground text-center w-full break-words leading-tight line-clamp-2">
        {filename}
      </span>
    </div>
  )
}

/**
 * Skeleton loader for category-based checklist
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

      {/* Category sections skeleton - 5 categories */}
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="rounded-lg border border-muted">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
            <div className="w-4 h-4 bg-muted rounded animate-pulse" />
            <div className="w-5 h-5 bg-muted rounded animate-pulse" />
            <div className="w-24 h-4 bg-muted rounded animate-pulse" />
            <div className="ml-auto w-8 h-4 bg-muted rounded animate-pulse" />
          </div>
          <div className="divide-y divide-border/50">
            {[1, 2].map(j => (
              <div key={j} className="flex items-center gap-2 px-3 py-2.5">
                <div className="w-5 h-5 bg-muted rounded-full animate-pulse" />
                <div className="w-32 h-4 bg-muted rounded animate-pulse flex-1" />
                <div className="w-16 h-5 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
