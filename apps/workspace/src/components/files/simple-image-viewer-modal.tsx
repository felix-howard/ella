/**
 * SimpleImageViewerModal - Lightweight fullscreen viewer for files without a DigitalDoc
 * Used for irrelevant files (cat images, logos, etc.) classified as "Khác"
 * Shows only the image/PDF viewer with no verification fields
 * Supports AI re-classification for misclassified "Other" documents
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, ImageOff, RefreshCw, Wand2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { ImageViewer } from '../ui/image-viewer'
import { useSignedUrl } from '../../hooks/use-signed-url'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

export interface SimpleImageViewerModalProps {
  imageId: string
  filename: string
  caseId?: string
  onClose: () => void
}

export function SimpleImageViewerModal({ imageId, filename, caseId, onClose }: SimpleImageViewerModalProps) {
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
      toast.success('Đang phân loại lại tài liệu...')
      // Invalidate images to trigger polling for new classification
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      }
      // Close modal - the document will move to "Processing" state
      onClose()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Không thể phân loại lại'
      toast.error(message)
    },
  })

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
              title="AI phân loại lại tài liệu này"
            >
              {reclassifyMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Phân loại lại</span>
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/80 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-muted/20">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
          ) : error || !signedUrlData?.url ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <ImageOff className="w-12 h-12" />
              <p className="text-sm">Không thể tải file</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Thử lại
              </Button>
            </div>
          ) : (
            <ImageViewer
              imageUrl={signedUrlData.url}
              isPdf={isPdf}
              className="w-full h-full"
            />
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
