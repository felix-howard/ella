/**
 * UnclassifiedSection - Grid display of pending classification documents
 * Shows at top of Files Tab when unclassified docs exist
 */

import { memo, type KeyboardEvent } from 'react'
import { AlertTriangle, Tag } from 'lucide-react'
import { cn } from '@ella/ui'
import type { RawImage } from '../../lib/api-client'
import { ImageThumbnail } from './image-thumbnail'

export interface UnclassifiedSectionProps {
  images: RawImage[]
  onClassify: (image: RawImage) => void
}

/**
 * Section displaying unclassified documents awaiting manual classification
 * Shows warning-styled container with image grid
 */
export function UnclassifiedSection({ images, onClassify }: UnclassifiedSectionProps) {
  if (images.length === 0) return null

  return (
    <div className="bg-warning/5 border border-warning/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <span className="font-semibold text-foreground">Chờ phân loại</span>
          <span className="bg-warning text-white text-xs px-2 py-0.5 rounded-full">
            {images.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {images.map((img) => (
          <UnclassifiedDocCard
            key={img.id}
            image={img}
            onClick={() => onClassify(img)}
          />
        ))}
      </div>
    </div>
  )
}

interface UnclassifiedDocCardProps {
  image: RawImage
  onClick: () => void
}

/**
 * Single unclassified doc thumbnail with hover action
 */
const UnclassifiedDocCard = memo(function UnclassifiedDocCard({
  image,
  onClick,
}: UnclassifiedDocCardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <button
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`Phân loại ${image.filename}`}
      className={cn(
        'relative group cursor-pointer text-left',
        'bg-background rounded-lg border-2 border-dashed border-warning/50',
        'hover:border-warning focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/50',
        'transition-colors overflow-hidden'
      )}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-muted overflow-hidden">
        <ImageThumbnail imageId={image.id} filename={image.filename} />
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-white/90 px-2 py-1 rounded">
          <Tag className="w-3 h-3" />
          Phân loại
        </span>
      </div>

      {/* Filename */}
      <div className="px-1.5 py-1">
        <p className="text-[10px] text-foreground truncate" title={image.filename}>
          {image.filename}
        </p>
      </div>
    </button>
  )
})
