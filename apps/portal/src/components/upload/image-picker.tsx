/**
 * Image Picker Component
 * Mobile-friendly file input with camera and gallery support
 * Shows preview of selected images with remove functionality
 */
import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { Camera, ImageIcon, X, Plus, AlertCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import { getText, type Language } from '../../lib/i18n'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES_COUNT = 20

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

export function ImagePicker({
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
        const isValidType =
          file.type.startsWith('image/') || file.type === 'application/pdf'
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
    <div className="space-y-4">
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
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled}
        multiple
      />

      {/* Validation error message */}
      {validationError && (
        <div className="flex items-center gap-2 p-3 bg-error/10 text-error text-sm rounded-xl animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError.message}</span>
        </div>
      )}

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((file, index) => (
            <FilePreview
              key={`${file.name}-${index}-${file.size}`}
              file={file}
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
              className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors disabled:opacity-50"
              aria-label={t.chooseFromGallery}
            >
              <Plus className="w-6 h-6 text-muted-foreground" />
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
            <Camera className="w-5 h-5" />
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
            <ImageIcon className="w-5 h-5" />
            {t.chooseFromGallery}
          </Button>
        </div>
      )}

      {/* Selected count */}
      {files.length > 0 && (
        <p className="text-sm text-center text-muted-foreground">
          {files.length} {t.selectedFiles}
        </p>
      )}
    </div>
  )
}

// File preview thumbnail component with memory cleanup
function FilePreview({
  file,
  onRemove,
  disabled,
}: {
  file: File
  onRemove: () => void
  disabled: boolean
}) {
  const isPDF = file.type === 'application/pdf'

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
    <div className="relative aspect-square group">
      {isPDF ? (
        <div className="w-full h-full rounded-xl bg-muted flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">PDF</span>
        </div>
      ) : (
        <img
          src={previewUrl || ''}
          alt={file.name}
          className="w-full h-full object-cover rounded-xl"
        />
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error text-error-foreground flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        aria-label="Remove file"
      >
        <X className="w-4 h-4" />
      </button>

      {/* File name tooltip on hover */}
      <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-white truncate px-1">{file.name}</p>
      </div>
    </div>
  )
}
