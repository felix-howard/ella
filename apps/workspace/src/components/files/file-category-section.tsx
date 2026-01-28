/**
 * FileCategorySection - Collapsible folder view for categorized documents
 * Shows category with color styling and displayName for files
 */

import { useState, memo, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@ella/ui'
import type { RawImage, DigitalDoc } from '../../lib/api-client'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { sanitizeText } from '../../lib/formatters'
import { ImageThumbnail } from './image-thumbnail'
import type { DocCategoryKey, DocCategoryConfig } from '../../lib/doc-categories'

export interface FileCategorySectionProps {
  categoryKey: DocCategoryKey
  config: DocCategoryConfig
  images: RawImage[]
  docs: DigitalDoc[]
  onVerify: (doc: DigitalDoc) => void
}

/**
 * Collapsible category section with color styling
 */
export function FileCategorySection({
  categoryKey: _categoryKey,
  config,
  images,
  docs,
  onVerify,
}: FileCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
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

  return (
    <div className={cn('rounded-xl border overflow-hidden', config.borderColor)}>
      {/* Header - Collapsible with category color */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-label={`${config.labelVi} - ${verifiedCount} of ${images.length} verified`}
        className={cn(
          'w-full flex items-center gap-3 p-4',
          'hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset transition-all',
          config.bgColor
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
      </button>

      {/* File list */}
      {isExpanded && (
        <div className="border-t border-border divide-y divide-border bg-card">
          {images.map((img) => (
            <FileItemRow
              key={img.id}
              image={img}
              doc={docs.find((d) => d.rawImageId === img.id)}
              onVerify={onVerify}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileItemRowProps {
  image: RawImage
  doc?: DigitalDoc
  onVerify: (doc: DigitalDoc) => void
}

/**
 * Single file row with thumbnail, displayName, and status/action
 */
const FileItemRow = memo(function FileItemRow({
  image,
  doc,
  onVerify,
}: FileItemRowProps) {
  const isVerified = doc?.status === 'VERIFIED'
  const needsVerification = doc && doc.status !== 'VERIFIED'
  const docLabel = DOC_TYPE_LABELS[image.classifiedType ?? ''] ?? image.classifiedType ?? 'Chưa phân loại'

  // Show displayName if available, fallback to original filename
  // Sanitize to prevent XSS (extra safety layer beyond React's default escaping)
  const displayName = sanitizeText(image.displayName || image.filename)

  return (
    <div className={cn(
      'flex items-center gap-4 p-3',
      'hover:bg-muted/30 transition-colors'
    )}>
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        <ImageThumbnail imageId={image.id} filename={image.filename} />
      </div>

      {/* Info - Show displayName as primary, docType as secondary */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate" title={displayName}>
          {displayName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {docLabel}
          {image.aiConfidence && (
            <span className="ml-1">• {Math.round(image.aiConfidence * 100)}%</span>
          )}
        </p>
      </div>

      {/* Status & Action */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isVerified && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Đã xác minh</span>
          </span>
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
      </div>
    </div>
  )
})
