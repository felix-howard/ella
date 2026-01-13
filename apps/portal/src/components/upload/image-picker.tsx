/**
 * Image Picker Component
 * Mobile-friendly file input with camera and gallery support
 * Shows preview of selected images with remove functionality
 */
import { memo, useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { Camera, ImageIcon, X, Plus, AlertCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import { getText, type Language } from '../../lib/i18n'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES_COUNT = 20

// Valid file extensions and MIME types
const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']
const VALID_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

// Sanitize file name to prevent XSS
function sanitizeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 255)
}

// Validate file type by both MIME and extension
function isValidFileType(file: File): boolean {
  const mimeValid = VALID_MIME_TYPES.includes(file.type) ||
    file.type.startsWith('image/')
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  const extValid = VALID_EXTENSIONS.includes(ext)
  return mimeValid && extValid
}

interface ImagePickerProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  language: Language
  maxFiles?: number
  disabled?: boolean
}

interface ValidationError {
  type: 'size' | 'format' | 'count'
  message: string
}

export const ImagePicker = memo(function ImagePicker({
  files,
  onFilesChange,
  language,
  maxFiles = MAX_FILES_COUNT,
  disabled = false,
}: ImagePickerProps) {
  const t = getText(language)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [validationError, setValidationError] = useState<ValidationError | null>(null)

  // Clear validation error after 3 seconds
  useEffect(() => {
    if (validationError) {
      const timer = setTimeout(() => setValidationError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [validationError])

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files || [])
      if (selectedFiles.length === 0) return

      let invalidReason: ValidationError | null = null

      // Filter and validate files
      const validFiles = selectedFiles.filter((file) => {
        const isValidType = isValidFileType(file)
        const isValidSize = file.size <= MAX_FILE_SIZE

        if (!isValidType && !invalidReason) {
          invalidReason = {
            type: 'format',
            message: language === 'VI'
              ? 'Chỉ chấp nhận ảnh (JPEG, PNG) và PDF'
              : 'Only images (JPEG, PNG) and PDF accepted'
          }
        }
        if (!isValidSize && !invalidReason) {
          invalidReason = {
            type: 'size',
            message: language === 'VI'
              ? 'File quá lớn (tối đa 10MB)'
              : 'File too large (max 10MB)'
          }
        }
        return isValidType && isValidSize
      })

      // Check count limit
      const spaceLeft = maxFiles - files.length
      if (validFiles.length > spaceLeft) {
        invalidReason = {
          type: 'count',
          message: language === 'VI'
            ? `Chỉ có thể thêm ${spaceLeft} file nữa`
            : `Can only add ${spaceLeft} more files`
        }
      }

      if (invalidReason) {
        setValidationError(invalidReason)
      }

      const newFiles = [...files, ...validFiles].slice(0, maxFiles)
      if (newFiles.length !== files.length) {
        onFilesChange(newFiles)
      }

      // Reset input
      event.target.value = ''
    },
    [files, maxFiles, onFilesChange, language]
  )

  const handleRemoveFile = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index)
      onFilesChange(newFiles)
    },
    [files, onFilesChange]
  )

  const handleCameraClick = () => cameraInputRef.current?.click()
  const handleGalleryClick = () => galleryInputRef.current?.click()

  return (
    <div className="space-y-4" role="region" aria-label={t.uploadTitle}>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
        multiple
        aria-hidden="true"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
        multiple
        aria-hidden="true"
      />

      {/* Validation error message */}
      {validationError && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center gap-2 p-3 bg-error/10 text-error text-sm rounded-xl animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{validationError.message}</span>
        </div>
      )}

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2" role="list" aria-label="Selected files">
          {files.map((file, index) => (
            <FilePreview
              key={`${sanitizeFileName(file.name)}-${index}-${file.size}`}
              file={file}
              index={index}
              onRemove={() => handleRemoveFile(index)}
              disabled={disabled}
            />
          ))}

          {/* Add more button (if under limit) */}
          {files.length < maxFiles && (
            <button
              type="button"
              onClick={handleGalleryClick}
              disabled={disabled}
              className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors disabled:opacity-50 touch-manipulation"
              aria-label={t.chooseFromGallery}
            >
              <Plus className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Action buttons (when no files selected) */}
      {files.length === 0 && (
        <div className="space-y-3">
          {/* Camera button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-14 gap-3 rounded-xl text-base"
            onClick={handleCameraClick}
            disabled={disabled}
          >
            <Camera className="w-5 h-5" aria-hidden="true" />
            {t.takePhoto}
          </Button>

          {/* Gallery button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-14 gap-3 rounded-xl text-base"
            onClick={handleGalleryClick}
            disabled={disabled}
          >
            <ImageIcon className="w-5 h-5" aria-hidden="true" />
            {t.chooseFromGallery}
          </Button>
        </div>
      )}

      {/* Selected count */}
      {files.length > 0 && (
        <p
          className="text-sm text-center text-muted-foreground"
          aria-live="polite"
        >
          {files.length} {t.selectedFiles}
        </p>
      )}
    </div>
  )
})

// File preview thumbnail component with memory cleanup
const FilePreview = memo(function FilePreview({
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
  const safeName = sanitizeFileName(file.name)

  // Memoize ObjectURL and cleanup on unmount/file change
  const previewUrl = useMemo(() => {
    if (isPDF) return null
    return URL.createObjectURL(file)
  }, [file, isPDF])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <div
      className="relative aspect-square group"
      role="listitem"
      aria-label={`File ${index + 1}: ${safeName}`}
    >
      {isPDF ? (
        <div
          className="w-full h-full rounded-xl bg-muted flex items-center justify-center"
          aria-label="PDF document"
        >
          <span className="text-xs font-medium text-muted-foreground">PDF</span>
        </div>
      ) : (
        <img
          src={previewUrl || ''}
          alt={`Preview of ${safeName}`}
          className="w-full h-full object-cover rounded-xl"
        />
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error text-error-foreground flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50 touch-manipulation"
        aria-label={`Remove ${safeName}`}
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>

      {/* File name tooltip on hover */}
      <div
        className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      >
        <p className="text-[10px] text-white truncate px-1">{safeName}</p>
      </div>
    </div>
  )
})

export default ImagePicker
