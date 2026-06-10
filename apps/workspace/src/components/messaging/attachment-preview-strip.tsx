import { Image, X } from 'lucide-react'
import { cn } from '@ella/ui'

export interface ComposerAttachment {
  id: string
  file: File
  previewUrl: string
}

interface AttachmentPreviewStripProps {
  attachments: ComposerAttachment[]
  error?: string | null
  removeLabel: string
  selectedLabel: string
  onRemove: (id: string) => void
}

export function AttachmentPreviewStrip({
  attachments,
  error,
  removeLabel,
  selectedLabel,
  onRemove,
}: AttachmentPreviewStripProps) {
  if (attachments.length === 0 && !error) return null

  return (
    <div className="mb-2 space-y-1.5">
      <p className="sr-only" role="status" aria-live="polite">
        {error ?? selectedLabel}
      </p>
      {attachments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={selectedLabel}>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative h-14 w-14 flex-none overflow-hidden rounded-lg border border-border bg-muted"
              title={attachment.file.name}
            >
              <img
                src={attachment.previewUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
              <div className="absolute left-1 top-1 rounded bg-black/45 p-0.5 text-white">
                <Image className="h-3 w-3" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                className={cn(
                  'absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full',
                  'bg-black/65 text-white transition-colors hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white'
                )}
                aria-label={`${removeLabel}: ${attachment.file.name}`}
                title={`${removeLabel}: ${attachment.file.name}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="px-1 text-xs leading-snug text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
