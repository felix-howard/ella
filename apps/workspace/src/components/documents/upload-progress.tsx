/**
 * Upload Progress Component - Floating panel showing processing status
 * Displays when images are being classified or docs are being extracted by AI
 * Auto-hides after 30 seconds of no change to handle stuck processing states
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, FileSearch } from 'lucide-react'

interface UploadProgressProps {
  processingCount: number
  extractingCount?: number
}

// Hide notification after this many seconds of unchanged counts
const STALE_TIMEOUT_MS = 30000

export function UploadProgress({ processingCount, extractingCount = 0 }: UploadProgressProps) {
  const { t } = useTranslation()
  const [isStale, setIsStale] = useState(false)

  const totalCount = processingCount + extractingCount

  // Single effect that manages staleness timeout
  // Depends on totalCount - when it changes, effect re-runs and resets timer
  useEffect(() => {
    // Reset staleness immediately when effect runs (counts changed)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid: resetting state when dependency changes
    setIsStale(false)

    // No timeout needed if nothing is processing
    if (totalCount === 0) {
      return
    }

    // Start staleness timeout
    const timeoutId = setTimeout(() => {
      setIsStale(true)
    }, STALE_TIMEOUT_MS)

    // Cleanup on unmount or when totalCount changes
    return () => {
      clearTimeout(timeoutId)
    }
  }, [totalCount])

  // Don't render if nothing is processing or if state is stale
  if (totalCount === 0 || isStale) return null

  return (
    <div className="fixed bottom-20 right-6 w-80 bg-card rounded-xl border shadow-lg p-4 z-50">
      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-warning" />
        {t('uploadProgress.title')}
      </h4>

      <div className="space-y-2">
        {processingCount > 0 && (
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-warning animate-pulse flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              {t('uploadProgress.classifying', { count: processingCount })}
            </span>
          </div>
        )}

        {extractingCount > 0 && (
          <div className="flex items-center gap-3">
            <FileSearch className="w-4 h-4 text-info animate-pulse flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              {t('uploadProgress.extracting', { count: extractingCount })}
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {t('uploadProgress.autoUpdate')}
      </p>
    </div>
  )
}
