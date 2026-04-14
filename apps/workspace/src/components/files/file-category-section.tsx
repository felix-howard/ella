/**
 * FileCategorySection - Collapsible folder view for categorized documents
 * Shows category with color styling and displayName for files
 * Supports drag-and-drop between categories
 * Shows NEW badge for unviewed documents (per-CPA tracking)
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback, memo, useMemo, type KeyboardEvent, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, Clock, GripVertical, Check, X, Loader2, Eye, Globe, Phone, ArrowRightLeft } from 'lucide-react'
import { cn } from '@ella/ui'
import { api, type RawImage, type DigitalDoc, type EntityInfo } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { sanitizeText } from '../../lib/formatters'
import { ImageThumbnail } from './image-thumbnail'
import { FileActionDropdown } from './file-action-dropdown'
import { useMarkDocumentViewed } from '../../hooks'
import { getEntityColor } from './entity-filter-bar'
import type { DocCategoryKey, DocCategoryConfig } from '../../lib/doc-categories'
import { groupDocuments } from '../../lib/document-grouping'
import { GroupedFileRow, GroupConnector, PageBadge } from './grouped-file-row'

export interface FileCategorySectionProps {
  categoryKey: DocCategoryKey
  config: DocCategoryConfig
  images: RawImage[]
  docs: DigitalDoc[]
  /** Pre-built map of rawImageId → DigitalDoc for O(1) lookups */
  docsMap?: Map<string, DigitalDoc>
  caseId: string
  onVerify: (doc: DigitalDoc) => void
  onViewImage?: (imageId: string) => void
  onFileDrop?: (imageIds: string | string[], targetCategory: DocCategoryKey) => void
  /** Start collapsed (for performance with many files) */
  defaultCollapsed?: boolean
  /** Entity metadata per image (unified mode only) */
  entityMap?: Map<string, { entityClientId: string; entityName: string; entityIndex: number }>
  /** All entities in group (unified mode only, for "Move to..." dropdown) */
  entities?: EntityInfo[]
}

/**
 * Collapsible category section with color styling
 */
export function FileCategorySection({
  categoryKey,
  config,
  images,
  docs,
  docsMap: externalDocsMap,
  caseId,
  onVerify,
  onViewImage,
  onFileDrop,
  defaultCollapsed,
  entityMap,
  entities,
}: FileCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed)
  const [isDragOver, setIsDragOver] = useState(false)
  const Icon = config.icon

  // Build docsMap locally if not provided (backward compat)
  const docsMap = useMemo(() => {
    if (externalDocsMap) return externalDocsMap
    const map = new Map<string, DigitalDoc>()
    for (const d of docs) {
      if (d.rawImageId) map.set(d.rawImageId, d)
    }
    return map
  }, [externalDocsMap, docs])

  // Group multi-page documents
  const { groups, ungrouped } = useMemo(() => groupDocuments(images), [images])

  // Count verified documents using O(1) map lookup
  const verifiedCount = useMemo(() => images.filter((img) => {
    const doc = docsMap.get(img.id)
    return doc?.status === 'VERIFIED'
  }).length, [images, docsMap])

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
    const groupIds = e.dataTransfer.getData('application/x-ella-group-ids')

    if (imageId && sourceCategory !== categoryKey && onFileDrop) {
      // If group IDs present, move entire group; otherwise move single file
      if (groupIds) {
        const ids = groupIds.split(',').filter(Boolean)
        onFileDrop(ids, categoryKey)
      } else {
        onFileDrop(imageId, categoryKey)
      }
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] overflow-hidden transition-all',
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
        aria-label={`${config.label} - ${verifiedCount} of ${images.length} verified`}
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
          {config.label}
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
        'border-t border-border/50 divide-y divide-border/50 bg-card',
        !isExpanded && 'hidden'
      )}>
        {/* Render grouped documents */}
        {groups.map((group) => (
          <GroupedFileRow
            key={group.groupKey}
            group={group}
            renderFileRow={(image, options) => (
              <LazyFileItemRow
                key={image.id}
                image={image}
                doc={docsMap.get(image.id)}
                caseId={caseId}
                categoryKey={categoryKey}
                onVerify={onVerify}
                onViewImage={onViewImage}
                isGrouped={options.isGrouped}
                isFirst={options.isFirst}
                isLast={options.isLast}
                pageDisplay={options.pageDisplay}
                groupKey={group.groupKey}
                groupImageIds={group.images.map((img) => img.id)}
                entityInfo={entityMap?.get(image.id)}
                entities={entities}
              />
            )}
          />
        ))}

        {/* Render ungrouped documents */}
        {ungrouped.map((img) => (
          <LazyFileItemRow
            key={img.id}
            image={img}
            doc={docsMap.get(img.id)}
            caseId={caseId}
            categoryKey={categoryKey}
            onVerify={onVerify}
            onViewImage={onViewImage}
            entityInfo={entityMap?.get(img.id)}
            entities={entities}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * LazyFileItemRow - Only renders the full FileItemRow when visible in viewport.
 * Uses IntersectionObserver to defer thumbnail fetches and event listeners
 * for off-screen rows, dramatically reducing initial load for large file lists.
 */
const LazyFileItemRow = memo(function LazyFileItemRow(props: FileItemRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect() // Once visible, stay rendered
        }
      },
      { rootMargin: '200px' } // Pre-load 200px before entering viewport
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (!isVisible) {
    // Placeholder with same height as a real row to prevent layout shift
    return <div ref={ref} className="flex items-center gap-4 p-3 h-[60px]" />
  }

  return <FileItemRow {...props} />
})

interface FileItemRowProps {
  image: RawImage
  doc?: DigitalDoc
  caseId: string
  categoryKey: DocCategoryKey
  onVerify: (doc: DigitalDoc) => void
  onViewImage?: (imageId: string) => void
  // Multi-page grouping props
  isGrouped?: boolean
  isFirst?: boolean
  isLast?: boolean
  pageDisplay?: string | null
  groupKey?: string
  groupImageIds?: string[]
  // Entity routing props (unified mode)
  entityInfo?: { entityClientId: string; entityName: string; entityIndex: number }
  entities?: EntityInfo[]
}

/**
 * Single file row with thumbnail, displayName, and status/action
 * Supports drag to move between categories and inline renaming
 * Shows NEW badge for unviewed documents (per-CPA tracking)
 */
const FileItemRow = memo(function FileItemRow({
  image,
  doc,
  caseId,
  categoryKey,
  onVerify,
  onViewImage,
  isGrouped,
  isFirst,
  isLast,
  pageDisplay,
  groupKey,
  groupImageIds,
  entityInfo,
  entities,
}: FileItemRowProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const markViewed = useMarkDocumentViewed()
  const [isDragging, setIsDragging] = useState(false)
  const [isGroupDragging, setIsGroupDragging] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newFilename, setNewFilename] = useState('')
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const moveTriggerRef = useRef<HTMLButtonElement>(null)

  const isVerified = doc?.status === 'VERIFIED'
  const needsVerification = doc && doc.status !== 'VERIFIED'
  // File is done processing but has no DigitalDoc (e.g., irrelevant files in "Khác")
  const isProcessedNoDoc = !doc && image.status !== 'UPLOADED' && image.status !== 'PROCESSING'
  const isStillProcessing = !doc && !isProcessedNoDoc
  const docLabel = DOC_TYPE_LABELS[image.classifiedType ?? ''] ?? image.classifiedType ?? t('classify.unclassified')

  // Show displayName if available, fallback to original filename
  // Sanitize to prevent XSS (extra safety layer beyond React's default escaping)
  const displayName = sanitizeText(image.displayName || image.filename)

  // Listen for group drag events to highlight all group members
  useEffect(() => {
    if (!groupKey) return

    const handleGroupDragStart = (e: Event) => {
      const customEvent = e as CustomEvent<{ groupKey: string }>
      if (customEvent.detail.groupKey === groupKey) {
        setIsGroupDragging(true)
      }
    }
    const handleGroupDragEnd = (e: Event) => {
      const customEvent = e as CustomEvent<{ groupKey: string }>
      if (customEvent.detail.groupKey === groupKey) {
        setIsGroupDragging(false)
      }
    }

    window.addEventListener('group-drag-start', handleGroupDragStart)
    window.addEventListener('group-drag-end', handleGroupDragEnd)

    return () => {
      window.removeEventListener('group-drag-start', handleGroupDragStart)
      window.removeEventListener('group-drag-end', handleGroupDragEnd)
    }
  }, [groupKey])

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
      toast.success(t('classify.fileRenamed'))
      // Invalidate both images and case queries to refresh all views
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
      setIsRenaming(false)
    },
    onError: () => {
      toast.error(t('classify.fileRenameError'))
    },
  })

  // Reassign entity mutation ("Move to..." in unified mode)
  const reassignEntityMutation = useMutation({
    mutationFn: (targetClientId: string) => api.images.reassignEntity(image.id, targetClientId),
    onSuccess: (_data, targetClientId) => {
      const targetEntity = entities?.find(e => e.clientId === targetClientId)
      toast.success(`Moved to ${targetEntity?.name ?? 'entity'}`)
      // Invalidate group images query to refresh unified view
      queryClient.invalidateQueries({ queryKey: ['group-images'] })
      queryClient.invalidateQueries({ queryKey: ['images'] })
      setShowMoveMenu(false)
    },
    onError: () => {
      toast.error('Failed to move document')
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
    // Include group IDs for multi-page document group drag
    if (groupKey && groupImageIds && groupImageIds.length > 1) {
      e.dataTransfer.setData('application/x-ella-group-ids', groupImageIds.join(','))
      e.dataTransfer.setData('application/x-ella-group-key', groupKey)
      // Emit event for visual feedback on other group members
      window.dispatchEvent(new CustomEvent('group-drag-start', { detail: { groupKey } }))
    }
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    // Emit event to clear visual state on other group members
    if (groupKey) {
      window.dispatchEvent(new CustomEvent('group-drag-end', { detail: { groupKey } }))
    }
  }

  return (
    <div
      draggable={!isRenaming}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'flex items-center gap-4 p-3',
        'hover:bg-muted/30 transition-all duration-200',
        !isRenaming && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
        isGroupDragging && !isDragging && 'opacity-50 ring-2 ring-primary ring-inset'
      )}
    >
      {/* Group Connector (for multi-page groups) */}
      {isGrouped && isFirst !== undefined && isLast !== undefined && (
        <GroupConnector isFirst={isFirst} isLast={isLast} />
      )}

      {/* Drag Handle */}
      <div className={cn(
        'flex-shrink-0 transition-opacity',
        isRenaming ? 'opacity-20' : 'opacity-40 hover:opacity-70'
      )}>
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Clickable area: thumbnail + file info - opens verification modal or image viewer */}
      <div
        className={cn(
          'flex items-center gap-4 flex-1 min-w-0',
          (doc || isProcessedNoDoc) && !isRenaming && 'cursor-pointer'
        )}
        onClick={() => {
          if (isRenaming) return
          // Mark as viewed when opening (fire and forget with optimistic update)
          if (image.isNew) {
            // Optimistic update - remove NEW badge immediately
            queryClient.setQueryData(
              ['images', caseId],
              (old: { images: RawImage[] } | undefined) => {
                if (!old) return old
                return {
                  ...old,
                  images: old.images.map((img) =>
                    img.id === image.id ? { ...img, isNew: false } : img
                  ),
                }
              }
            )
            markViewed.mutate(image.id)
          }
          if (doc) onVerify(doc)
          else if (isProcessedNoDoc) onViewImage?.(image.id)
        }}
        role={(doc || isProcessedNoDoc) && !isRenaming ? 'button' : undefined}
        tabIndex={(doc || isProcessedNoDoc) && !isRenaming ? 0 : undefined}
        onKeyDown={(e) => {
          if (isRenaming) return
          if ((e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            // Mark as viewed when opening via keyboard
            if (image.isNew) {
              queryClient.setQueryData(
                ['images', caseId],
                (old: { images: RawImage[] } | undefined) => {
                  if (!old) return old
                  return {
                    ...old,
                    images: old.images.map((img) =>
                      img.id === image.id ? { ...img, isNew: false } : img
                    ),
                  }
                }
              )
              markViewed.mutate(image.id)
            }
            if (doc) onVerify(doc)
            else if (isProcessedNoDoc) onViewImage?.(image.id)
          }
        }}
        aria-label={(doc || isProcessedNoDoc) && !isRenaming ? `Mở ${displayName}` : undefined}
      >
        {/* Thumbnail with NEW badge */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <div className="w-full h-full rounded-lg overflow-hidden bg-muted">
            <ImageThumbnail imageId={image.id} filename={image.filename} />
          </div>
          {/* NEW badge overlay */}
          {image.isNew && (
            <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded shadow-sm">
              {t('files.new')}
            </span>
          )}
        </div>

        {/* Info - Show displayName as primary, docType as secondary */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            // Inline rename input - stop click propagation so clicking input doesn't open modal
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{docLabel}</span>
                {pageDisplay && <PageBadge display={pageDisplay} />}
                <FileTypeBadge filename={image.filename} />
                <UploadSourceBadge uploadedVia={image.uploadedVia} />
                {entityInfo && <EntityBadge name={entityInfo.entityName} index={entityInfo.entityIndex} />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status & Action - hide when renaming */}
      {!isRenaming && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {isVerified && (
            <button
              onClick={() => onVerify(doc)}
              aria-label={t('docVerification.verify', { filename: docLabel })}
              className="flex items-center gap-1 text-xs text-success hover:text-success/80 focus:outline-none focus:ring-2 focus:ring-success/50 rounded px-1 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('checklistStatus.verified')}</span>
            </button>
          )}
          {needsVerification && (
            <button
              onClick={() => onVerify(doc)}
              aria-label={t('docVerification.verify', { filename: docLabel })}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-1 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('checklist.verify')}</span>
            </button>
          )}
          {isStillProcessing && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('uploads.statusProcessing')}</span>
            </span>
          )}
          {isProcessedNoDoc && (
            <button
              onClick={() => onViewImage?.(image.id)}
              aria-label={t('checklist.viewFile')}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-1 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('checklist.viewFile')}</span>
            </button>
          )}

          {/* Move to entity (unified mode) */}
          {entityInfo && entities && entities.length > 1 && (
            <div className="relative">
              <button
                ref={moveTriggerRef}
                onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu) }}
                disabled={reassignEntityMutation.isPending}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-1 transition-colors disabled:opacity-50"
                title="Move to another entity"
              >
                {reassignEntityMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Move</span>
              </button>
              {showMoveMenu && (
                <MoveToEntityMenu
                  entities={entities}
                  currentEntityId={entityInfo.entityClientId}
                  onSelect={(targetClientId) => reassignEntityMutation.mutate(targetClientId)}
                  onClose={() => setShowMoveMenu(false)}
                  triggerRef={moveTriggerRef}
                />
              )}
            </div>
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

/**
 * Small badge showing file extension (e.g. PDF, PNG, JPG)
 */
function FileTypeBadge({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toUpperCase()
  if (!ext) return null

  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium flex-shrink-0">
      {ext}
    </span>
  )
}

/**
 * Small badge indicating upload source: Portal or MMS (SMS)
 */
function UploadSourceBadge({ uploadedVia }: { uploadedVia?: string }) {
  if (!uploadedVia) return null

  if (uploadedVia === 'PORTAL') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium flex-shrink-0">
        <Globe className="w-2.5 h-2.5" />
        Portal
      </span>
    )
  }

  if (uploadedVia === 'SMS') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium flex-shrink-0">
        <Phone className="w-2.5 h-2.5" />
        MMS
      </span>
    )
  }

  return null
}

/**
 * Small colored pill showing entity name (unified mode)
 */
function EntityBadge({ name, index }: { name: string; index: number }) {
  const color = getEntityColor(index)
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0',
      color.bg, color.text
    )}>
      {name}
    </span>
  )
}

/**
 * Dropdown to move doc to another entity in the group
 */
function MoveToEntityMenu({
  entities,
  currentEntityId,
  onSelect,
  onClose,
  triggerRef,
}: {
  entities: EntityInfo[]
  currentEntityId: string
  onSelect: (targetClientId: string) => void
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 192 // w-48
    const menuHeight = 150 // approximate
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let top = rect.bottom + 4
    let left = rect.right - menuWidth

    if (left < 8) left = 8
    if (left + menuWidth > viewportWidth - 8) left = viewportWidth - menuWidth - 8
    if (top + menuHeight > viewportHeight - 8) {
      top = rect.top - menuHeight - 4
      if (top < 8) top = 8
    }

    setPosition({ top, left })
  }, [triggerRef])

  useLayoutEffect(() => {
    updatePosition()
  }, [updatePosition])

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const otherEntities = entities.filter(e => e.clientId !== currentEntityId)

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
      className="w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
    >
      <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
        Move to...
      </div>
      {otherEntities.map((entity) => {
        const entityIdx = entities.findIndex(e => e.clientId === entity.clientId)
        const color = getEntityColor(entityIdx >= 0 ? entityIdx : 0)
        return (
          <button
            key={entity.clientId}
            onClick={(e) => { e.stopPropagation(); onSelect(entity.clientId) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
          >
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', color.bg)} />
            <span className="truncate">{entity.name}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}
