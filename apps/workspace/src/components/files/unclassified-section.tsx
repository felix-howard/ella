/**
 * UnclassifiedSection - Collapsible list display of processing documents
 * Shows at top of Files Tab when docs are still being processed by AI
 * AI-failed docs now go directly to "Khác" category instead of here
 */

import { useState, memo, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@ella/ui'
import type { RawImage } from '../../lib/api-client'
import { sanitizeText } from '../../lib/formatters'
import { ImageThumbnail } from './image-thumbnail'

export interface UnclassifiedSectionProps {
  images: RawImage[]
}

/**
 * Section displaying unclassified documents awaiting manual classification
 * Collapsible list layout consistent with FileCategorySection
 */
export function UnclassifiedSection({ images }: UnclassifiedSectionProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)

  if (images.length === 0) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 overflow-hidden">
      {/* Header - Collapsible with primary color for processing state */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-label={`${t('uploads.statusProcessing')} - ${images.length} documents`}
        className={cn(
          'w-full flex items-center gap-3 p-4',
          'hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset transition-all',
          'bg-primary/10'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="font-semibold text-primary">{t('uploads.statusProcessing')}</span>
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
          />
        ))}
      </div>
    </div>
  )
}

interface UnclassifiedFileRowProps {
  image: RawImage
}

/**
 * Single unclassified file row with thumbnail and processing status
 */
const UnclassifiedFileRow = memo(function UnclassifiedFileRow({
  image,
}: UnclassifiedFileRowProps) {
  const { t } = useTranslation()
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
          {t('common.loading')}
        </p>
      </div>
    </div>
  )
})
