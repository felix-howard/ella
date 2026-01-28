/**
 * UnclassifiedSection - Collapsible list display of pending classification documents
 * Shows at top of Files Tab when unclassified docs exist
 * Consistent UI with FileCategorySection
 */

import { useState, memo, type KeyboardEvent } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Tag } from 'lucide-react'
import { cn } from '@ella/ui'
import type { RawImage } from '../../lib/api-client'
import { sanitizeText } from '../../lib/formatters'
import { ImageThumbnail } from './image-thumbnail'

export interface UnclassifiedSectionProps {
  images: RawImage[]
  onClassify: (image: RawImage) => void
}

/**
 * Section displaying unclassified documents awaiting manual classification
 * Collapsible list layout consistent with FileCategorySection
 */
export function UnclassifiedSection({ images, onClassify }: UnclassifiedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (images.length === 0) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <div className="rounded-xl border border-warning/30 overflow-hidden">
      {/* Header - Collapsible with warning color */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-label={`Chờ phân loại - ${images.length} documents`}
        className={cn(
          'w-full flex items-center gap-3 p-4',
          'hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-warning/50 focus:ring-inset transition-all',
          'bg-warning/10'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <AlertTriangle className="w-5 h-5 text-warning" />
        <span className="font-semibold text-warning">Chờ phân loại</span>
        <span className="text-sm text-muted-foreground">
          ({images.length})
        </span>
      </button>

      {/* File list - Use hidden instead of unmounting to prevent thumbnail reload flash */}
      <div className={cn(
        'border-t border-border divide-y divide-border bg-card',
        !isExpanded && 'hidden'
      )}>
        {images.map((img) => (
          <UnclassifiedFileRow
            key={img.id}
            image={img}
            onClick={() => onClassify(img)}
          />
        ))}
      </div>
    </div>
  )
}

interface UnclassifiedFileRowProps {
  image: RawImage
  onClick: () => void
}

/**
 * Single unclassified file row with thumbnail and classify action
 */
const UnclassifiedFileRow = memo(function UnclassifiedFileRow({
  image,
  onClick,
}: UnclassifiedFileRowProps) {
  // Sanitize filename for display
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

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate" title={displayName}>
          {displayName}
        </p>
        <p className="text-xs text-muted-foreground">
          Chưa phân loại
        </p>
      </div>

      {/* Classify Action */}
      <div className="flex-shrink-0">
        <button
          onClick={onClick}
          aria-label={`Phân loại ${displayName}`}
          className="flex items-center gap-1 text-xs text-warning hover:text-warning/80 focus:outline-none focus:ring-2 focus:ring-warning/50 rounded px-1 transition-colors"
        >
          <Tag className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Phân loại</span>
        </button>
      </div>
    </div>
  )
})
