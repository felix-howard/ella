/**
 * EmptyCategoryDropZone - Drop target for empty categories during drag
 * Shows as a compact row that accepts file drops
 */

import { useState, type DragEvent } from 'react'
import { cn } from '@ella/ui'
import { DOC_CATEGORIES, type DocCategoryKey } from '../../lib/doc-categories'

export interface EmptyCategoryDropZoneProps {
  categoryKey: DocCategoryKey
  onFileDrop: (imageId: string, targetCategory: DocCategoryKey) => void
}

/**
 * Compact drop zone for empty categories
 * Only visible when a file is being dragged
 */
export function EmptyCategoryDropZone({
  categoryKey,
  onFileDrop,
}: EmptyCategoryDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const config = DOC_CATEGORIES[categoryKey]
  const Icon = config.icon

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
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

    if (imageId && sourceCategory !== categoryKey) {
      onFileDrop(imageId, categoryKey)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'rounded-xl border-2 border-dashed p-3 transition-all',
        isDragOver
          ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2'
          : 'border-border/50 bg-muted/20 opacity-60 hover:opacity-80'
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', isDragOver ? 'text-primary' : config.textColor)} />
        <span className={cn('text-sm font-medium', isDragOver ? 'text-primary' : 'text-muted-foreground')}>
          {config.labelVi}
        </span>
        {isDragOver && (
          <span className="ml-auto text-xs text-primary font-medium">
            Thả vào đây
          </span>
        )}
      </div>
    </div>
  )
}
