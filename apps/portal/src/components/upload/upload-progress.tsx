/**
 * Upload Progress Component
 * Shows upload progress with animated spinner and file count
 * Mobile-friendly with large touch targets
 */
import { memo } from 'react'
import { Loader2, Upload, CheckCircle2 } from 'lucide-react'
import { getText, type Language } from '../../lib/i18n'

type UploadState = 'idle' | 'uploading' | 'processing' | 'complete'

interface UploadProgressProps {
  state: UploadState
  filesCount: number
  uploadedCount?: number
  language: Language
}

export const UploadProgress = memo(function UploadProgress({
  state,
  filesCount,
  uploadedCount = 0,
  language,
}: UploadProgressProps) {
  const t = getText(language)

  if (state === 'idle') {
    return null
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-xs">
        {/* Progress indicator */}
        {state === 'uploading' && (
          <>
            <div className="relative w-20 h-20 mx-auto mb-4">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              {/* Spinning indicator */}
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              {/* Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {t.uploading}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filesCount} {t.selectedFiles}
            </p>
          </>
        )}

        {state === 'processing' && (
          <>
            <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {t.processing}
            </h2>
            <p className="text-sm text-muted-foreground">
              {language === 'VI' ? 'Đang xử lý file...' : 'Processing files...'}
            </p>
          </>
        )}

        {state === 'complete' && (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {t.uploadSuccess}
            </h2>
            <p className="text-sm text-muted-foreground">
              {uploadedCount} {t.filesUploaded}
            </p>
          </>
        )}

        {/* Progress dots for visual interest */}
        {(state === 'uploading' || state === 'processing') && (
          <div className="flex justify-center gap-1.5 mt-4" aria-hidden="true">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse delay-75" />
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse delay-150" />
          </div>
        )}
      </div>
    </div>
  )
})

export default UploadProgress
