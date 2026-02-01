/**
 * SimpleImageViewerModal - Lightweight fullscreen viewer for files without a DigitalDoc
 * Used for irrelevant files (cat images, logos, etc.) classified as "Khác"
 * Shows only the image/PDF viewer with no verification fields
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, ImageOff, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'
import { ImageViewer } from '../ui/image-viewer'
import { useSignedUrl } from '../../hooks/use-signed-url'

export interface SimpleImageViewerModalProps {
  imageId: string
  filename: string
  onClose: () => void
}

export function SimpleImageViewerModal({ imageId, filename, onClose }: SimpleImageViewerModalProps) {
  const {
    data: signedUrlData,
    isLoading,
    error,
    refetch,
  } = useSignedUrl(imageId)

  const isPdf = filename.toLowerCase().endsWith('.pdf')

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
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/80 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
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
