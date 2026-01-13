/**
 * Image Preview Grid Component
 * Displays selected images in a responsive grid with remove functionality
 * Used in upload flow to show selected files before submission
 */
import { memo, useMemo, useEffect } from 'react'
import { X, FileText, Image as ImageIcon } from 'lucide-react'

// Sanitize file name to prevent XSS in display
function sanitizeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 255)
}

interface ImagePreviewGridProps {
  files: File[]
  onRemove: (index: number) => void
  disabled?: boolean
  maxDisplay?: number
}

export const ImagePreviewGrid = memo(function ImagePreviewGrid({
  files,
  onRemove,
  disabled = false,
  maxDisplay = 9,
}: ImagePreviewGridProps) {
  // Calculate if we have overflow
  const displayFiles = files.slice(0, maxDisplay)
  const overflowCount = files.length - maxDisplay

  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="list"
      aria-label="Selected files preview"
    >
      {displayFiles.map((file, index) => (
        <PreviewThumbnail
          key={`${sanitizeFileName(file.name)}-${index}-${file.size}`}
          file={file}
          index={index}
          onRemove={() => onRemove(index)}
          disabled={disabled}
        />
      ))}

      {/* Overflow indicator */}
      {overflowCount > 0 && (
        <div
          className="aspect-square rounded-xl bg-muted/50 flex items-center justify-center"
          role="listitem"
          aria-label={`${overflowCount} more files`}
        >
          <span className="text-sm font-medium text-muted-foreground">
            +{overflowCount}
          </span>
        </div>
      )}
    </div>
  )
})

// Individual preview thumbnail with memory cleanup
const PreviewThumbnail = memo(function PreviewThumbnail({
  file,
  index,
  onRemove,
  disabled,
}: {
  file: File
  index: number
  onRemove: () => void
  disabled: boolean
}) {
  const isPDF = file.type === 'application/pdf'
  const isImage = file.type.startsWith('image/')
  const safeName = sanitizeFileName(file.name)

  // Memoize ObjectURL and cleanup on unmount/file change
  const previewUrl = useMemo(() => {
    if (!isImage) return null
    return URL.createObjectURL(file)
  }, [file, isImage])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Get file size display
  const fileSizeKB = Math.round(file.size / 1024)
  const fileSizeDisplay = fileSizeKB > 1024
    ? `${(fileSizeKB / 1024).toFixed(1)}MB`
    : `${fileSizeKB}KB`

  return (
    <div
      className="relative aspect-square group"
      role="listitem"
      aria-label={`File ${index + 1}: ${safeName}`}
    >
      {/* Preview content */}
      {isPDF ? (
        <div
          className="w-full h-full rounded-xl bg-muted flex flex-col items-center justify-center gap-1"
          aria-label="PDF document"
        >
          <FileText className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">PDF</span>
        </div>
      ) : isImage && previewUrl ? (
        <img
          src={previewUrl}
          alt={`Preview of ${safeName}`}
          className="w-full h-full object-cover rounded-xl bg-muted"
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full rounded-xl bg-muted flex flex-col items-center justify-center gap-1"
          aria-label={`File: ${fileSizeDisplay}`}
        >
          <ImageIcon className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">{fileSizeDisplay}</span>
        </div>
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-error text-white flex items-center justify-center shadow-md hover:bg-error/90 transition-colors disabled:opacity-50 touch-manipulation"
        aria-label={`Remove ${safeName}`}
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {/* File info overlay on hover/touch */}
      <div
        className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent rounded-b-xl opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity pointer-events-none"
        aria-hidden="true"
      >
        <p className="text-[10px] text-white truncate">{safeName}</p>
      </div>
    </div>
  )
})

export default ImagePreviewGrid
