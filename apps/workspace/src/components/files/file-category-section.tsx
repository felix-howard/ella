/**
 * FileCategorySection - Collapsible folder view for categorized documents
 * Shows verified/total count with file rows
 */

import { useState, memo, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronRight, Folder, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@ella/ui'
import type { RawImage, DigitalDoc } from '../../lib/api-client'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { ImageThumbnail } from './image-thumbnail'
import type { LucideIcon } from 'lucide-react'

export interface FileCategorySectionProps {
  categoryKey: string
  label: string
  Icon: LucideIcon
  images: RawImage[]
  docs: DigitalDoc[]
  onVerify: (doc: DigitalDoc) => void
}

/**
 * Collapsible category section showing files grouped by document type
 */
export function FileCategorySection({
  categoryKey: _categoryKey,
  label,
  Icon,
  images,
  docs,
  onVerify,
}: FileCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

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
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-label={`${label} - ${verifiedCount} of ${images.length} verified`}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <Folder className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">{label}</span>
          <span className="text-sm text-muted-foreground">
            ({verifiedCount}/{images.length})
          </span>
        </div>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* File list */}
      {isExpanded && (
        <div className="border-t border-border divide-y divide-border">
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
 * Single file row with thumbnail, name, and status/action
 */
const FileItemRow = memo(function FileItemRow({
  image,
  doc,
  onVerify,
}: FileItemRowProps) {
  const isVerified = doc?.status === 'VERIFIED'
  const needsVerification = doc && doc.status !== 'VERIFIED'
  const docLabel = DOC_TYPE_LABELS[image.classifiedType ?? ''] ?? image.classifiedType ?? 'Chưa phân loại'

  return (
    <div className={cn(
      'flex items-center gap-4 p-3',
      'hover:bg-muted/30 transition-colors'
    )}>
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        <ImageThumbnail imageId={image.id} filename={image.filename} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{docLabel}</p>
        <p className="text-xs text-muted-foreground truncate">{image.filename}</p>
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
