/**
 * Enhanced Uploader Component
 * Mobile-first file upload with drag & drop, progress tracking
 * - Mobile: Camera + Gallery buttons
 * - Desktop: Drag & drop zone + click to browse
 * - Progress bars during upload
 */
import { memo, useRef, useCallback, useState, useEffect, useMemo } from 'react'
import {
  Camera,
  ImageIcon,
  X,
  Plus,
  AlertCircle,
  Upload,
  Loader2,
  FileText,
} from 'lucide-react'
import { Button } from '@ella/ui'
import { getText, type Language } from '../../lib/i18n'
import { portalApi, type UploadResponse, ApiError } from '../../lib/api-client'

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES_COUNT = 20
const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']
const VALID_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

// Types
type UploadState = 'idle' | 'uploading' | 'success' | 'error'

interface FileWithProgress {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  previewUrl?: string
}

interface ValidationError {
  type: 'size' | 'format' | 'count'
  message: string
}

interface EnhancedUploaderProps {
  token: string
  language: Language
  onUploadComplete: (result: UploadResponse) => void
  onError: (error: string) => void
  maxFiles?: number
  disabled?: boolean
}

// Helpers
function sanitizeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 255)
}

function isValidFileType(file: File): boolean {
  const mimeValid =
    VALID_MIME_TYPES.includes(file.type) || file.type.startsWith('image/')
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  const extValid = VALID_EXTENSIONS.includes(ext)
  return mimeValid && extValid
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

// Main Component
export const EnhancedUploader = memo(function EnhancedUploader({
  token,
  language,
  onUploadComplete,
  onError,
  maxFiles = MAX_FILES_COUNT,
  disabled = false,
}: EnhancedUploaderProps) {
  const t = getText(language)
  const isMobile = useMemo(() => isMobileDevice(), [])

  // Refs for file inputs
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // State
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [validationError, setValidationError] = useState<ValidationError | null>(
    null
  )
  const [isDragOver, setIsDragOver] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)

  // Clear validation error after 3 seconds
  useEffect(() => {
    if (validationError) {
      const timer = setTimeout(() => setValidationError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [validationError])

  // Cleanup preview URLs on unmount
  useEffect(() => {
    // Store current files for cleanup
    const currentFiles = files
    return () => {
      currentFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
      })
    }
  }, [files])

  // File validation and addition
  const addFiles = useCallback(
    (newFiles: File[]) => {
      if (newFiles.length === 0) return

      let invalidReason: ValidationError | null = null
      const validFiles: FileWithProgress[] = []

      for (const file of newFiles) {
        const isValidType = isValidFileType(file)
        const isValidSize = file.size <= MAX_FILE_SIZE

        if (!isValidType && !invalidReason) {
          invalidReason = {
            type: 'format',
            message: t.invalidFileType,
          }
          continue
        }
        if (!isValidSize && !invalidReason) {
          invalidReason = {
            type: 'size',
            message: t.fileTooLarge,
          }
          continue
        }

        if (isValidType && isValidSize) {
          const isPDF = file.type === 'application/pdf'
          validFiles.push({
            file,
            id: generateId(),
            progress: 0,
            status: 'pending',
            previewUrl: isPDF ? undefined : URL.createObjectURL(file),
          })
        }
      }

      // Check count limit
      const spaceLeft = maxFiles - files.length
      if (validFiles.length > spaceLeft) {
        invalidReason = {
          type: 'count',
          message: t.maxFilesReached.replace('{count}', String(spaceLeft)),
        }
      }

      if (invalidReason) {
        setValidationError(invalidReason)
      }

      const filesToAdd = validFiles.slice(0, spaceLeft)
      if (filesToAdd.length > 0) {
        setFiles((prev) => [...prev, ...filesToAdd])
      }
    },
    [files.length, maxFiles, t]
  )

  // Handle file input change
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files || [])
      addFiles(selectedFiles)
      event.target.value = ''
    },
    [addFiles]
  )

  // Remove file
  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      addFiles(droppedFiles)
    },
    [addFiles]
  )

  // Upload with progress and retry logic
  const handleUpload = useCallback(async () => {
    if (files.length === 0 || uploadState === 'uploading') return

    setUploadState('uploading')
    setOverallProgress(0)

    // Mark all files as uploading
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading' as const })))

    const MAX_RETRIES = 2
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await portalApi.uploadWithProgress(
          token,
          files.map((f) => f.file),
          (progress) => {
            setOverallProgress(progress)
            // Update all files with same progress (batch upload)
            setFiles((prev) =>
              prev.map((f) => ({
                ...f,
                progress: progress * 100,
                status: progress === 1 ? 'done' : 'uploading',
              }))
            )
          }
        )

        setUploadState('success')
        // Cleanup preview URLs
        files.forEach((f) => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
        })
        setFiles([])
        onUploadComplete(result)
        return // Success, exit
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error')

        // Only retry on network errors, not on server errors
        const isNetworkError =
          err instanceof ApiError && (err.code === 'NETWORK_ERROR' || err.status === 0)

        if (!isNetworkError || attempt === MAX_RETRIES) {
          break // Don't retry server errors or if max retries reached
        }

        // Reset progress for retry
        setOverallProgress(0)
        setFiles((prev) =>
          prev.map((f) => ({ ...f, progress: 0, status: 'uploading' as const }))
        )
      }
    }

    // All retries failed
    setUploadState('error')
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'error' as const })))

    if (lastError instanceof ApiError) {
      onError(lastError.message)
    } else {
      onError(t.errorUploading)
    }
  }, [files, uploadState, token, onUploadComplete, onError, t.errorUploading])

  // Button handlers
  const handleCameraClick = () => cameraInputRef.current?.click()
  const handleGalleryClick = () => galleryInputRef.current?.click()

  const isUploading = uploadState === 'uploading'
  const hasFiles = files.length > 0

  console.log('EnhancedUploader render:', { hasFiles, isUploading, isMobile, filesCount: files.length })

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
        disabled={disabled || isUploading}
        multiple
        aria-hidden="true"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        multiple
        aria-hidden="true"
      />

      {/* Validation error */}
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

      {/* Mobile: Camera + Gallery buttons (shown when no files) */}
      {!hasFiles && (
        <div className="space-y-3">
          {/* Camera button - primary on mobile */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-14 gap-3 rounded-xl text-base"
            onClick={handleCameraClick}
            disabled={disabled || isUploading}
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
            disabled={disabled || isUploading}
          >
            <ImageIcon className="w-5 h-5" aria-hidden="true" />
            {t.chooseFromGallery}
          </Button>

          {/* Desktop: Drag & drop zone */}
          {!isMobile && (
            <>
              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                <div className="flex-1 h-px bg-border" />
                <span>{t.or}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleGalleryClick}
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                  transition-colors
                  ${isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
                  ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <Upload
                  className="w-8 h-8 mx-auto mb-3 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-foreground">
                  {t.dragDropHere}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.clickToBrowse}
                </p>
              </div>
            </>
          )}

          {/* File info */}
          <p className="text-xs text-muted-foreground text-center">
            {t.maxFileSize} • {t.supportedFormats}
          </p>
        </div>
      )}

      {/* Preview grid (when files selected) */}
      {hasFiles && (
        <>
          <div className="grid grid-cols-3 gap-2" role="list" aria-label="Selected files">
            {files.map((fileItem) => (
              <FilePreview
                key={fileItem.id}
                fileItem={fileItem}
                onRemove={() => handleRemoveFile(fileItem.id)}
                disabled={disabled || isUploading}
              />
            ))}

            {/* Add more button */}
            {files.length < maxFiles && !isUploading && (
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

          {/* Progress info */}
          {isUploading && (
            <div className="space-y-2" role="status" aria-live="polite">
              <div
                className="h-2 bg-muted rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(overallProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t.uploading}
              >
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${overallProgress * 100}%` }}
                />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                {Math.round(overallProgress * 100)}% - {t.uploading}
              </p>
            </div>
          )}

          {/* File count */}
          {!isUploading && (
            <p className="text-sm text-center text-muted-foreground" aria-live="polite">
              {files.length} {t.selectedFiles}
            </p>
          )}

          {/* Action buttons */}
          <div className="space-y-3 pt-2">
            <Button
              className="w-full h-14 text-base gap-2 rounded-2xl"
              onClick={handleUpload}
              disabled={disabled || isUploading || files.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.uploading}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  {t.upload} ({files.length})
                </>
              )}
            </Button>

            {!isUploading && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  files.forEach((f) => {
                    if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
                  })
                  setFiles([])
                }}
              >
                {t.cancel}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
})

// File preview component
const FilePreview = memo(function FilePreview({
  fileItem,
  onRemove,
  disabled,
}: {
  fileItem: FileWithProgress
  onRemove: () => void
  disabled: boolean
}) {
  const isPDF = fileItem.file.type === 'application/pdf'
  const safeName = sanitizeFileName(fileItem.file.name)
  const isUploading = fileItem.status === 'uploading'
  const isDone = fileItem.status === 'done'
  const isError = fileItem.status === 'error'

  return (
    <div
      className="relative aspect-square group"
      role="listitem"
      aria-label={`File: ${safeName}`}
    >
      {/* Preview image or PDF icon */}
      {isPDF ? (
        <div className="w-full h-full rounded-xl bg-muted flex flex-col items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground mb-1" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">PDF</span>
        </div>
      ) : (
        <img
          src={fileItem.previewUrl || ''}
          alt={`Preview of ${safeName}`}
          className="w-full h-full object-cover rounded-xl"
        />
      )}

      {/* Progress overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-6 h-6 text-white animate-spin mx-auto" />
            <span className="text-xs text-white mt-1 block">
              {Math.round(fileItem.progress)}%
            </span>
          </div>
        </div>
      )}

      {/* Done overlay */}
      {isDone && (
        <div className="absolute inset-0 bg-primary/20 rounded-xl flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <svg
              className="w-5 h-5 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {isError && (
        <div className="absolute inset-0 bg-error/20 rounded-xl flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
      )}

      {/* Remove button */}
      {!isUploading && !isDone && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error text-error-foreground flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50 touch-manipulation"
          aria-label={`Remove ${safeName}`}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

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

export default EnhancedUploader
