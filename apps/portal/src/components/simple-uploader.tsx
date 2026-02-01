/**
 * Simple Uploader Component
 * ONE big button that triggers native OS file picker
 * Mobile-first, no technical jargon visible to user
 * Uses global toast for success/error notifications
 */
import { useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { portalApi, type UploadResponse, ApiError } from '../lib/api-client'
import { toast } from '../lib/toast-store'

// Hidden validation - user doesn't see these limits
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

interface SimpleUploaderProps {
  token: string
  onUploadComplete: (result: UploadResponse) => void
  onError: (message: string) => void
}

export function SimpleUploader({
  token,
  onUploadComplete,
  onError,
}: SimpleUploaderProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  // Click handler triggers native file picker
  const handleClick = () => inputRef.current?.click()

  // File selection and upload handler
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      e.target.value = '' // Reset for same file selection

      if (selectedFiles.length === 0) return

      // Validate files and track rejected count
      const validFiles: File[] = []
      let rejectedCount = 0

      for (const file of selectedFiles) {
        const isValidType = VALID_TYPES.includes(file.type)
        const isValidSize = file.size <= MAX_FILE_SIZE

        if (isValidType && isValidSize) {
          validFiles.push(file)
        } else {
          rejectedCount++
        }
      }

      // All files rejected - show error toast
      if (validFiles.length === 0) {
        const errorMsg = t('portal.invalidFileType')
        toast.error(errorMsg)
        onError(errorMsg)
        return
      }

      // Some files rejected - continue with valid ones silently
      if (rejectedCount > 0) {
        console.info(`Upload: ${rejectedCount} files rejected, ${validFiles.length} valid`)
      }

      // Start upload
      setUploading(true)
      setProgress(0)

      try {
        const result = await portalApi.uploadWithProgress(token, validFiles, (p) =>
          setProgress(p * 100)
        )

        // Show success toast
        toast.success(t('portal.uploadedSuccess'))
        onUploadComplete(result)
      } catch (err) {
        const message = err instanceof ApiError ? err.message : t('portal.errorUploading')
        toast.error(message)
        onError(message)
      } finally {
        setUploading(false)
        setProgress(0)
      }
    },
    [token, onUploadComplete, onError, t]
  )

  return (
    <div className="space-y-4" role="region" aria-label={t('portal.uploadTitle')}>
      {/* Hidden native file input - triggers OS picker */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
        aria-hidden="true"
      />

      {/* Progress bar - only visible during upload */}
      {uploading && (
        <div className="space-y-2" role="status" aria-live="polite">
          <div
            className="h-2 bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-center text-muted-foreground">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* BIG UPLOAD BUTTON - main CTA */}
      <Button
        onClick={handleClick}
        disabled={uploading}
        className="w-full h-16 text-lg gap-3 rounded-2xl"
        size="lg"
        aria-label={uploading ? t('portal.uploading') : t('portal.tapToUpload')}
      >
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            {t('portal.uploading')}
          </>
        ) : (
          <>
            <Upload className="w-6 h-6" aria-hidden="true" />
            {t('portal.tapToUpload')}
          </>
        )}
      </Button>
    </div>
  )
}
