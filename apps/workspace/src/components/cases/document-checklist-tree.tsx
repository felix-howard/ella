/**
 * DocumentChecklistTree - Tree view for document checklist
 * Features: expandable categories, file names visible, preview modal, minimal status dots
 */

import { useState, useMemo } from 'react'
import { cn } from '@ella/ui'
import {
  ChevronRight,
  ChevronDown,
  Eye,
  FileText,
  Image as ImageIcon,
  Check,
  Circle,
  Minus,
} from 'lucide-react'
import {
  DOC_TYPE_LABELS,
  DOC_TYPE_CATEGORIES,
  CHECKLIST_STATUS_LABELS,
} from '../../lib/constants'
import { useSignedUrl } from '../../hooks/use-signed-url'
import { FileViewerModal } from '../file-viewer/file-viewer-modal'
import type { ChecklistItem, ChecklistItemStatus, RawImage } from '../../lib/api-client'

interface DocumentChecklistTreeProps {
  items: ChecklistItem[]
  isLoading?: boolean
  onVerify?: (item: ChecklistItem) => void
  onImageDrop?: (imageId: string, targetChecklistItemId: string) => void
  enableDragDrop?: boolean
  /** Hide internal header (progress circle + dots) when shown externally */
  showHeader?: boolean
}

/** Calculate checklist progress percentage */
export function calculateChecklistProgress(items: ChecklistItem[]): number {
  const total = items.filter(i => i.status !== 'NOT_REQUIRED').length
  const verified = items.filter(i => i.status === 'VERIFIED').length
  return total > 0 ? Math.round((verified / total) * 100) : 0
}

/** Get status counts for progress dots */
export function getChecklistStatusCounts(items: ChecklistItem[]) {
  return {
    verified: items.filter(i => i.status === 'VERIFIED').length,
    hasDigital: items.filter(i => i.status === 'HAS_DIGITAL').length,
    hasRaw: items.filter(i => i.status === 'HAS_RAW').length,
    missing: items.filter(i => i.status === 'MISSING').length,
    notRequired: items.filter(i => i.status === 'NOT_REQUIRED').length,
  }
}

// Status dot component - minimal indicator
function StatusDot({ status }: { status: ChecklistItemStatus }) {
  const config: Record<ChecklistItemStatus, { icon: typeof Check; color: string; title: string }> = {
    VERIFIED: { icon: Check, color: 'text-success', title: CHECKLIST_STATUS_LABELS.VERIFIED },
    HAS_DIGITAL: { icon: Circle, color: 'text-primary fill-primary', title: CHECKLIST_STATUS_LABELS.HAS_DIGITAL },
    HAS_RAW: { icon: Circle, color: 'text-warning fill-warning', title: CHECKLIST_STATUS_LABELS.HAS_RAW },
    MISSING: { icon: Circle, color: 'text-muted-foreground', title: CHECKLIST_STATUS_LABELS.MISSING },
    NOT_REQUIRED: { icon: Minus, color: 'text-muted-foreground', title: CHECKLIST_STATUS_LABELS.NOT_REQUIRED },
  }

  const { icon: Icon, color, title } = config[status] || config.MISSING

  return (
    <span title={title} className="flex-shrink-0">
      <Icon className={cn('w-3.5 h-3.5', color)} />
    </span>
  )
}

// Progress dots for header - shows distribution
export function ProgressDots({ items }: { items: ChecklistItem[] }) {
  const counts = useMemo(() => ({
    verified: items.filter(i => i.status === 'VERIFIED').length,
    hasDigital: items.filter(i => i.status === 'HAS_DIGITAL').length,
    hasRaw: items.filter(i => i.status === 'HAS_RAW').length,
    missing: items.filter(i => i.status === 'MISSING').length,
    notRequired: items.filter(i => i.status === 'NOT_REQUIRED').length,
  }), [items])

  return (
    <div className="flex items-center gap-1" title={`${counts.verified} xác minh, ${counts.hasDigital} trích xuất, ${counts.hasRaw} nhận ảnh, ${counts.missing} thiếu`}>
      {counts.verified > 0 && <span className="w-2 h-2 rounded-full bg-success" />}
      {counts.hasDigital > 0 && <span className="w-2 h-2 rounded-full bg-primary" />}
      {counts.hasRaw > 0 && <span className="w-2 h-2 rounded-full bg-warning" />}
      {counts.missing > 0 && <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />}
    </div>
  )
}

export function DocumentChecklistTree({
  items,
  isLoading,
  onVerify,
  onImageDrop,
  enableDragDrop = false,
  showHeader = true,
}: DocumentChecklistTreeProps) {
  // File viewer modal state
  const [viewerFile, setViewerFile] = useState<{ imageId: string; filename: string } | null>(null)

  // Group items by category
  const categorizedItems = useMemo(() => {
    const result: Record<string, ChecklistItem[]> = {}

    // Initialize all categories
    Object.keys(DOC_TYPE_CATEGORIES).forEach(cat => {
      result[cat] = []
    })

    // Group items by docType into categories
    items.forEach(item => {
      const docType = item.template?.docType
      let assigned = false

      for (const [catKey, catConfig] of Object.entries(DOC_TYPE_CATEGORIES)) {
        if (catConfig.docTypes.includes(docType)) {
          result[catKey].push(item)
          assigned = true
          break
        }
      }

      // Fallback to 'other' if not found
      if (!assigned) {
        result.other.push(item)
      }
    })

    return result
  }, [items])

  // Calculate progress
  const progress = useMemo(() => {
    const total = items.filter(i => i.status !== 'NOT_REQUIRED').length
    const verified = items.filter(i => i.status === 'VERIFIED').length
    return total > 0 ? Math.round((verified / total) * 100) : 0
  }, [items])

  if (isLoading) {
    return <DocumentChecklistTreeSkeleton />
  }

  if (!items.length) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Không có tài liệu cần thu thập</p>
      </div>
    )
  }

  const handleOpenFile = (imageId: string, filename: string) => {
    setViewerFile({ imageId, filename })
  }

  return (
    <div className="space-y-2">
      {/* Simplified header - conditionally rendered */}
      {showHeader && (
        <div className="flex items-center justify-between px-2 py-2 border-b border-border">
          <div className="flex items-center gap-3">
            {/* Progress circle */}
            <div className="relative w-10 h-10">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${progress * 0.88} 100`} className="text-primary" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-foreground">{progress}%</span>
              </div>
            </div>
            <ProgressDots items={items} />
          </div>
        </div>
      )}

      {/* Category tree */}
      <div className="divide-y divide-border/50">
        {Object.entries(DOC_TYPE_CATEGORIES).map(([catKey, catConfig]) => {
          const categoryItems = categorizedItems[catKey] || []
          if (categoryItems.length === 0) return null

          return (
            <CategoryNode
              key={catKey}
              label={catConfig.label}
              items={categoryItems}
              onVerify={onVerify}
              onOpenFile={handleOpenFile}
              onImageDrop={onImageDrop}
              enableDragDrop={enableDragDrop}
            />
          )
        })}
      </div>

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

interface CategoryNodeProps {
  label: string
  items: ChecklistItem[]
  onVerify?: (item: ChecklistItem) => void
  onOpenFile: (imageId: string, filename: string) => void
  onImageDrop?: (imageId: string, targetChecklistItemId: string) => void
  enableDragDrop?: boolean
}

function CategoryNode({
  label,
  items,
  onVerify,
  onOpenFile,
  onImageDrop,
  enableDragDrop,
}: CategoryNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Calculate category stats
  const stats = useMemo(() => {
    const required = items.filter(i => i.status !== 'NOT_REQUIRED').length
    const done = items.filter(i => i.status === 'VERIFIED' || i.status === 'HAS_DIGITAL').length
    return { done, required }
  }, [items])

  // Get category status color
  const categoryStatus = useMemo(() => {
    if (stats.required === 0) return 'text-muted-foreground'
    if (stats.done === stats.required) return 'text-success'
    if (stats.done > 0) return 'text-primary'
    return 'text-muted-foreground'
  }, [stats])

  return (
    <div>
      {/* Category header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-2 py-2.5 hover:bg-muted/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-foreground flex-1">{label}</span>
        <span className={cn('text-xs font-medium', categoryStatus)}>
          {stats.done}/{stats.required}
        </span>
      </button>

      {/* Category content */}
      {isExpanded && (
        <div className="pl-6 pb-1">
          {items.map(item => (
            <DocTypeNode
              key={item.id}
              item={item}
              onVerify={onVerify}
              onOpenFile={onOpenFile}
              onImageDrop={onImageDrop}
              enableDragDrop={enableDragDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface DocTypeNodeProps {
  item: ChecklistItem
  onVerify?: (item: ChecklistItem) => void
  onOpenFile: (imageId: string, filename: string) => void
  onImageDrop?: (imageId: string, targetChecklistItemId: string) => void
  enableDragDrop?: boolean
}

function DocTypeNode({
  item,
  onVerify,
  onOpenFile,
  onImageDrop,
  enableDragDrop,
}: DocTypeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const status = item.status as ChecklistItemStatus
  const docLabel = DOC_TYPE_LABELS[item.template?.docType] || item.template?.labelVi || 'Tài liệu'
  const hasFiles = (item.rawImages?.length || 0) > 0
  const canVerify = status === 'HAS_DIGITAL' || status === 'HAS_RAW'

  // Auto-expand if has files
  const shouldShowFiles = hasFiles && isExpanded

  const handleDragOver = (e: React.DragEvent) => {
    if (!enableDragDrop) return
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    if (!enableDragDrop) return
    e.preventDefault()
    setIsDragOver(false)
    const imageId = e.dataTransfer.getData('imageId')
    if (imageId && onImageDrop) {
      onImageDrop(imageId, item.id)
    }
  }

  return (
    <div
      className={cn(
        'border-l-2 border-transparent',
        isDragOver && 'border-l-primary bg-primary/5'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Doc type row */}
      <div className="flex items-center gap-2 px-2 py-1.5 group">
        {/* Expand toggle for files */}
        {hasFiles ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4.5" /> // Spacer
        )}

        {/* Status dot */}
        <StatusDot status={status} />

        {/* Doc type label */}
        <span className="text-sm text-foreground flex-1 truncate">{docLabel}</span>

        {/* File count */}
        {hasFiles && (
          <span className="text-xs text-muted-foreground">
            {item.rawImages?.length} file
          </span>
        )}

        {/* Verify button */}
        {canVerify && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onVerify?.(item)
            }}
            className="p-1 rounded hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Xác minh"
          >
            <Eye className="w-3.5 h-3.5 text-primary" />
          </button>
        )}
      </div>

      {/* Files list */}
      {shouldShowFiles && (
        <div className="pl-8 pb-1">
          {item.rawImages?.map(image => (
            <FileNode
              key={image.id}
              image={image}
              onOpenFile={onOpenFile}
              enableDragDrop={enableDragDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileNodeProps {
  image: RawImage
  onOpenFile: (imageId: string, filename: string) => void
  enableDragDrop?: boolean
}

function FileNode({ image, onOpenFile, enableDragDrop }: FileNodeProps) {
  const isPdf = image.filename?.toLowerCase().endsWith('.pdf')

  const handleDragStart = (e: React.DragEvent) => {
    if (!enableDragDrop) return
    e.dataTransfer.setData('imageId', image.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDoubleClick = () => {
    onOpenFile(image.id, image.filename)
  }

  return (
    <div
      draggable={enableDragDrop}
      onDragStart={handleDragStart}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded group hover:bg-muted/50 cursor-pointer',
        enableDragDrop && 'cursor-grab active:cursor-grabbing'
      )}
      title="Double-click để xem file"
    >
      {/* File icon */}
      {isPdf ? (
        <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
      ) : (
        <ImageIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
      )}

      {/* Filename */}
      <span className="text-xs text-muted-foreground flex-1 truncate" title={image.filename}>
        {image.filename}
      </span>

      {/* Preview button - still available for single click */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onOpenFile(image.id, image.filename)
        }}
        className="p-1 rounded hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Xem file"
      >
        <Eye className="w-3 h-3 text-primary" />
      </button>
    </div>
  )
}

/**
 * Skeleton loader
 */
export function DocumentChecklistTreeSkeleton() {
  return (
    <div className="space-y-2">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-2 py-2 border-b border-border">
        <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
        <div className="flex gap-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-muted animate-pulse" />
          ))}
        </div>
      </div>

      {/* Categories skeleton */}
      {[1, 2, 3].map(i => (
        <div key={i} className="px-2 py-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted rounded animate-pulse" />
            <div className="w-32 h-4 bg-muted rounded animate-pulse" />
            <div className="ml-auto w-8 h-4 bg-muted rounded animate-pulse" />
          </div>
          <div className="pl-6 mt-2 space-y-1">
            {[1, 2].map(j => (
              <div key={j} className="flex items-center gap-2 py-1">
                <div className="w-3.5 h-3.5 bg-muted rounded-full animate-pulse" />
                <div className="w-24 h-3 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
