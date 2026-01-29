/**
 * FileCategorySection - Collapsible folder view for categorized documents
 * Shows category with color styling and displayName for files
 * Supports drag-and-drop between categories
 */

import { useState, useRef, useEffect, memo, type KeyboardEvent, type DragEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, Clock, GripVertical, Check, X, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { api, type RawImage, type DigitalDoc } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { sanitizeText } from '../../lib/formatters'
import { ImageThumbnail } from './image-thumbnail'
import { FileActionDropdown } from './file-action-dropdown'
import type { DocCategoryKey, DocCategoryConfig } from '../../lib/doc-categories'

export interface FileCategorySectionProps {
  categoryKey: DocCategoryKey
  config: DocCategoryConfig
  images: RawImage[]
  docs: DigitalDoc[]
  caseId: string
  onVerify: (doc: DigitalDoc) => void
  onFileDrop?: (imageId: string, targetCategory: DocCategoryKey) => void
}

/**
 * Collapsible category section with color styling
 */
export function FileCategorySection({
  categoryKey,
  config,
  images,
  docs,
  caseId,
  onVerify,
  onFileDrop,
}: FileCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isDragOver, setIsDragOver] = useState(false)
  const Icon = config.icon

  // Count verified documents
  const verifiedCount = images.filter((img) => {
    const doc = docs.find((d) => d.rawImageId === img.id)
    return doc?.status === 'VERIFIED'
  }).length

  if (images.length === 0) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsExpanded(!isExpanded)
    }
  }

  // Drag and drop handlers for the category header (drop target)
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Check if this is a file drag from our app
    if (e.dataTransfer.types.includes('application/x-ella-file')) {
      setIsDragOver(true)
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const imageId = e.dataTransfer.getData('application/x-ella-file')
    const sourceCategory = e.dataTransfer.getData('application/x-ella-category')

    if (imageId && sourceCategory !== categoryKey && onFileDrop) {
      onFileDrop(imageId, categoryKey)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all',
        config.borderColor,
        isDragOver && 'ring-2 ring-primary ring-offset-2'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header - Collapsible with category color, also drop target */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-label={`${config.labelVi} - ${verifiedCount} of ${images.length} verified`}
        className={cn(
          'w-full flex items-center gap-3 p-4',
          'hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset transition-all',
          config.bgColor,
          isDragOver && 'bg-primary/20'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <Icon className={cn('w-5 h-5', config.textColor)} />
        <span className={cn('font-semibold', config.textColor)}>
          {config.labelVi}
        </span>
        <span className="text-sm text-muted-foreground">
          ({verifiedCount}/{images.length})
        </span>
        {isDragOver && (
          <span className="ml-auto text-xs text-primary font-medium">
            Thả vào đây
          </span>
        )}
      </button>

      {/* File list - Use hidden instead of unmounting to prevent thumbnail reload flash */}
      <div className={cn(
        'border-t border-border divide-y divide-border bg-card',
        !isExpanded && 'hidden'
      )}>
        {images.map((img) => (
          <FileItemRow
            key={img.id}
            image={img}
            doc={docs.find((d) => d.rawImageId === img.id)}
            caseId={caseId}
            categoryKey={categoryKey}
            onVerify={onVerify}
          />
        ))}
      </div>
    </div>
  )
}

interface FileItemRowProps {
  image: RawImage
  doc?: DigitalDoc
  caseId: string
  categoryKey: DocCategoryKey
  onVerify: (doc: DigitalDoc) => void
}

/**
 * Single file row with thumbnail, displayName, and status/action
 * Supports drag to move between categories and inline renaming
 */
const FileItemRow = memo(function FileItemRow({
  image,
  doc,
  caseId,
  categoryKey,
  onVerify,
}: FileItemRowProps) {
  const queryClient = useQueryClient()
  const [isDragging, setIsDragging] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newFilename, setNewFilename] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isVerified = doc?.status === 'VERIFIED'
  const needsVerification = doc && doc.status !== 'VERIFIED'
  const docLabel = DOC_TYPE_LABELS[image.classifiedType ?? ''] ?? image.classifiedType ?? 'Chưa phân loại'

  // Show displayName if available, fallback to original filename
  // Sanitize to prevent XSS (extra safety layer beyond React's default escaping)
  const displayName = sanitizeText(image.displayName || image.filename)

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: (filename: string) => api.images.rename(image.id, filename),
    onSuccess: () => {
      toast.success('Đã đổi tên tệp')
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      setIsRenaming(false)
    },
    onError: () => {
      toast.error('Lỗi đổi tên tệp')
    },
  })

  // Start inline rename
  const handleStartRename = () => {
    setNewFilename(image.displayName || image.filename)
    setIsRenaming(true)
  }

  // Save rename
  const handleSaveRename = () => {
    const trimmed = newFilename.trim()
    if (!trimmed || trimmed === (image.displayName || image.filename)) {
      setIsRenaming(false)
      return
    }
    renameMutation.mutate(trimmed)
  }

  // Cancel rename
  const handleCancelRename = () => {
    setIsRenaming(false)
    setNewFilename('')
  }

  // Drag handlers for file row
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (isRenaming) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('application/x-ella-file', image.id)
    e.dataTransfer.setData('application/x-ella-category', categoryKey)
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  return (
    <div
      draggable={!isRenaming}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'flex items-center gap-4 p-3',
        'hover:bg-muted/30 transition-colors',
        !isRenaming && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      {/* Drag Handle */}
      <div className={cn(
        'flex-shrink-0 transition-opacity',
        isRenaming ? 'opacity-20' : 'opacity-40 hover:opacity-70'
      )}>
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        <ImageThumbnail imageId={image.id} filename={image.filename} />
      </div>

      {/* Info - Show displayName as primary, docType as secondary */}
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          // Inline rename input
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename()
                if (e.key === 'Escape') handleCancelRename()
              }}
              onBlur={() => {
                // Auto-save on blur if changed, otherwise cancel
                if (newFilename.trim() && newFilename.trim() !== (image.displayName || image.filename)) {
                  handleSaveRename()
                } else {
                  handleCancelRename()
                }
              }}
              disabled={renameMutation.isPending}
              className={cn(
                'flex-1 min-w-0 px-2 py-1 text-sm font-medium',
                'border border-primary rounded bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary/30',
                'disabled:opacity-50'
              )}
              placeholder="Nhập tên tệp..."
            />
            <button
              onClick={handleSaveRename}
              disabled={renameMutation.isPending}
              className="p-1.5 rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex-shrink-0"
              title="Lưu"
            >
              {renameMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={handleCancelRename}
              disabled={renameMutation.isPending}
              className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-50 flex-shrink-0"
              title="Hủy"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          // Normal display
          <>
            <p className="font-medium text-foreground truncate" title={displayName}>
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {docLabel}
            </p>
          </>
        )}
      </div>

      {/* Status & Action - hide when renaming */}
      {!isRenaming && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {isVerified && (
            <button
              onClick={() => onVerify(doc)}
              aria-label={`Xác minh lại ${docLabel}`}
              className="flex items-center gap-1 text-xs text-success hover:text-success/80 focus:outline-none focus:ring-2 focus:ring-success/50 rounded px-1 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đã xác minh</span>
            </button>
          )}
          {needsVerification && (
            <button
              onClick={() => onVerify(doc)}
              aria-label={`Xác minh ${docLabel}`}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-1 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xác minh</span>
            </button>
          )}
          {!doc && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đang xử lý</span>
            </span>
          )}

          {/* File Actions Dropdown */}
          <FileActionDropdown
            image={image}
            caseId={caseId}
            currentCategory={categoryKey}
            onRenameClick={handleStartRename}
          />
        </div>
      )}
    </div>
  )
})
