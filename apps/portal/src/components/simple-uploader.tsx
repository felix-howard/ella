/**
 * Simple Uploader Component
 * ONE big button that triggers native OS file picker
 * Mobile-first, no technical jargon visible to user
 */
import { useRef, useState, useCallback } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import { portalApi, type UploadResponse, ApiError } from '../lib/api-client'
import { getText, type Language } from '../lib/i18n'

// Hidden validation - user doesn't see these limits
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

interface SimpleUploaderProps {
  token: string
  language: Language
  onUploadComplete: (result: UploadResponse) => void
  onError: (message: string) => void
}

export function SimpleUploader({
  token,
  language,
  onUploadComplete,
  onError,
}: SimpleUploaderProps) {
  const t = getText(language)
  const inputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Click handler triggers native file picker
  const handleClick = () => inputRef.current?.click()

  // Clear error after timeout
  const showError = useCallback((message: string) => {
    setErrorMessage(message)
    onError(message)
    // Auto-clear error after 5 seconds
    setTimeout(() => setErrorMessage(null), 5000)
  }, [onError])

  // File selection and upload handler
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      e.target.value = '' // Reset for same file selection

      if (selectedFiles.length === 0) return

      // Clear any previous error
      setErrorMessage(null)

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

      // All files rejected - show error
      if (validFiles.length === 0) {
        showError(t.invalidFileType)
        return
      }

      // Some files rejected - show partial message but continue with valid ones
      if (rejectedCount > 0 && validFiles.length > 0) {
        // Silently continue with valid files (per design: no technical jargon)
        // but log for debugging
        console.info(`Upload: ${rejectedCount} files rejected, ${validFiles.length} valid`)
      }

      // Start upload
      setUploading(true)
      setProgress(0)

      try {
        const result = await portalApi.uploadWithProgress(token, validFiles, (p) =>
          setProgress(p * 100)
        )

        // Show success state briefly
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 3000)
        onUploadComplete(result)
      } catch (err) {
        const message = err instanceof ApiError ? err.message : t.errorUploading
        showError(message)
      } finally {
        setUploading(false)
        setProgress(0)
      }
    },
    [token, onUploadComplete, showError, t]
  )

  return (
    <div className="space-y-4" role="region" aria-label={t.uploadTitle}>
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

      {/* Error toast - visible when error occurs */}
      {errorMessage && (
        <div
          className="flex items-center gap-2 p-4 bg-error/10 text-error rounded-xl animate-in fade-in"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success toast */}
      {showSuccess && (
        <div
          className="flex items-center gap-2 p-4 bg-primary/10 text-primary rounded-xl animate-in fade-in"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          <span>{t.uploadedSuccess}</span>
        </div>
      )}

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
        aria-label={uploading ? t.uploading : t.tapToUpload}
      >
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            {t.uploading}
          </>
        ) : (
          <>
            <Upload className="w-6 h-6" aria-hidden="true" />
            {t.tapToUpload}
          </>
        )}
      </Button>
    </div>
  )
}
