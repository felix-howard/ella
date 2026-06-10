import { useCallback, useEffect } from 'react'
import { cn, Modal } from '@ella/ui'
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
  }, [goNext, goPrevious, open])

  if (!activeImage) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      showCloseButton={false}
      className="h-[92vh] w-[96vw] max-w-[96vw] overflow-hidden rounded-2xl bg-slate-950 p-0 text-white shadow-2xl"
      aria-labelledby="message-image-viewer-title"
    >
      <h2 id="message-image-viewer-title" className="sr-only">
        Message image viewer
      </h2>

      <div className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3">
          <div className="min-w-0 text-sm text-white/70">
            <span className="font-medium text-white">{activeIndex + 1}</span>
            <span> / {images.length}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Close image viewer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          <ResolvedMessageImage
            key={activeImage.id}
            url={activeImage.url}
            alt={`Attachment ${activeIndex + 1}`}
            className="h-full w-full"
            imageClassName="max-h-full max-w-full object-contain"
            fit="contain"
          />

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
        </div>

        <div className="shrink-0 border-t border-white/10 bg-slate-950/95 px-3 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => onSelectIndex(index)}
                className={cn(
                  'h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                  index === activeIndex
                    ? 'border-primary ring-2 ring-primary'
                    : 'border-white/15 opacity-70 hover:opacity-100'
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
    </Modal>
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
        'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-30',
        direction === 'previous' ? 'left-3' : 'right-3'
      )}
      aria-label={label}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
    </button>
  )
}
