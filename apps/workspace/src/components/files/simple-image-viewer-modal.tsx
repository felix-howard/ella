/**
 * SimpleImageViewerModal - Lightweight fullscreen viewer for files without a DigitalDoc
 * Used for irrelevant files (cat images, logos, etc.) classified as "Khác"
 * Shows only the image/PDF viewer with no verification fields
 * Supports AI re-classification for misclassified "Other" documents
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X, Loader2, ImageOff, RefreshCw, Wand2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, Button } from '@ella/ui'
import { ImageViewer } from '../ui/image-viewer'
import { useSignedUrl } from '../../hooks/use-signed-url'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

export interface SimpleImageViewerModalProps {
  imageId: string
  filename: string
  caseId?: string
  onClose: () => void
  /** Navigate to previous file (undefined if at first) */
  onNavigatePrev?: () => void
  /** Navigate to next file (undefined if at last) */
  onNavigateNext?: () => void
  /** Current file index (0-based) */
  currentIndex?: number
  /** Total number of files */
  totalCount?: number
}

export function SimpleImageViewerModal({
  imageId,
  filename,
  caseId,
  onClose,
  onNavigatePrev,
  onNavigateNext,
  currentIndex,
  totalCount,
}: SimpleImageViewerModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    data: signedUrlData,
    isLoading,
    error,
    refetch,
  } = useSignedUrl(imageId)

  const isPdf = filename.toLowerCase().endsWith('.pdf')

  // AI re-classification mutation
  const reclassifyMutation = useMutation({
    mutationFn: () => api.images.reclassify(imageId),
    onSuccess: () => {
      toast.success(t('classify.reclassifying'))
      // Invalidate images to trigger polling for new classification
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      }
      // Close modal - the document will move to "Processing" state
      onClose()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t('classify.reclassifyFailed')
      toast.error(message)
    },
  })

  // Keyboard shortcuts: Escape to close, Arrow keys to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Arrow left/right to navigate between files
      if (e.key === 'ArrowLeft' && onNavigatePrev) {
        e.preventDefault()
        onNavigatePrev()
        return
      }
      if (e.key === 'ArrowRight' && onNavigateNext) {
        e.preventDefault()
        onNavigateNext()
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onNavigatePrev, onNavigateNext])

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-4 md:inset-8 z-[100] flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={filename}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-medium text-foreground truncate">{filename}</h2>
          <div className="flex items-center gap-2">
            {/* AI Re-classify Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => reclassifyMutation.mutate()}
              disabled={reclassifyMutation.isPending}
              className="gap-2"
              title={t('classify.reclassifyTooltip')}
            >
              {reclassifyMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{t('classify.reclassify')}</span>
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/80 transition-colors"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-muted/20 relative">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
          ) : error || !signedUrlData?.url ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <ImageOff className="w-12 h-12" />
              <p className="text-sm">{t('common.cannotLoadFile')}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <ImageViewer
              imageUrl={signedUrlData.url}
              isPdf={isPdf}
              className="w-full h-full"
            />
          )}

          {/* Navigation Arrows - Floating on the image viewer */}
          {(onNavigatePrev || onNavigateNext) && (
            <>
              {/* Previous button */}
              <button
                onClick={onNavigatePrev}
                disabled={!onNavigatePrev}
                className={cn(
                  'absolute left-3 top-1/2 -translate-y-1/2 z-10',
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  'bg-background/90 border border-border shadow-lg',
                  'transition-all hover:bg-background hover:scale-105',
                  !onNavigatePrev && 'opacity-30 cursor-not-allowed hover:scale-100'
                )}
                aria-label={t('common.previous')}
                title={`${t('common.previous')} (←)`}
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>

              {/* Next button */}
              <button
                onClick={onNavigateNext}
                disabled={!onNavigateNext}
                className={cn(
                  'absolute right-3 top-1/2 -translate-y-1/2 z-10',
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  'bg-background/90 border border-border shadow-lg',
                  'transition-all hover:bg-background hover:scale-105',
                  !onNavigateNext && 'opacity-30 cursor-not-allowed hover:scale-100'
                )}
                aria-label={t('common.next')}
                title={`${t('common.next')} (→)`}
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>

              {/* File counter */}
              {currentIndex !== undefined && totalCount !== undefined && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-background/90 border border-border shadow-lg text-xs font-medium text-foreground">
                  {currentIndex + 1} / {totalCount}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
