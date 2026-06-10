import { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@ella/ui'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { ResolvedMessageImage } from './resolved-message-image'

export interface MessageImageGalleryItem {
  id: string
  url: string
  messageId: string
  attachmentIndex: number
  createdAt: string
}

interface MessageImageViewerModalProps {
  images: MessageImageGalleryItem[]
  activeIndex: number
  open: boolean
  onClose: () => void
  onSelectIndex: (index: number) => void
}

export function MessageImageViewerModal({
  images,
  activeIndex,
  open,
  onClose,
  onSelectIndex,
}: MessageImageViewerModalProps) {
  const activeImage = images[activeIndex]
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex >= 0 && activeIndex < images.length - 1

  const goPrevious = useCallback(() => {
    if (canGoPrevious) onSelectIndex(activeIndex - 1)
  }, [activeIndex, canGoPrevious, onSelectIndex])

  const goNext = useCallback(() => {
    if (canGoNext) onSelectIndex(activeIndex + 1)
  }, [activeIndex, canGoNext, onSelectIndex])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrevious()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrevious, onClose, open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!activeImage) return null

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-[1px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-image-viewer-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <h2 id="message-image-viewer-title" className="sr-only">
        Message image viewer
      </h2>

      <div className="flex h-[min(88vh,860px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
          <div className="min-w-0 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{activeIndex + 1}</span>
            <span> / {images.length}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close image viewer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-slate-50">
          <ResolvedMessageImage
            key={activeImage.id}
            url={activeImage.url}
            alt={`Attachment ${activeIndex + 1}`}
            className="h-full w-full"
            imageClassName="max-h-full max-w-full object-contain"
            fit="contain"
          />

          {images.length > 1 && (
            <>
              <NavigationButton
                direction="previous"
                disabled={!canGoPrevious}
                onClick={goPrevious}
              />
              <NavigationButton
                direction="next"
                disabled={!canGoNext}
                onClick={goNext}
              />
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-card px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => onSelectIndex(index)}
                className={cn(
                  'h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-slate-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  index === activeIndex
                    ? 'border-primary ring-2 ring-primary'
                    : 'border-border opacity-70 hover:border-primary/50 hover:opacity-100'
                )}
                aria-label={`View attachment ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
              >
                <ResolvedMessageImage
                  key={image.id}
                  url={image.url}
                  alt=""
                  className="h-full w-full"
                  imageClassName="h-full w-full object-cover"
                  fit="cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function NavigationButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight
  const label = direction === 'previous' ? 'Previous image' : 'Next image'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-30',
        direction === 'previous' ? 'left-3' : 'right-3'
      )}
      aria-label={label}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
    </button>
  )
}
