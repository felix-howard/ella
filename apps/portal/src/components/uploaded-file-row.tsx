/**
 * Uploaded File Row
 * Single row in the entity uploaded-files list: filename, status badge, delete button.
 * Delete is disabled (greyed) when status === 'LINKED' with a tooltip explaining why.
 */
import { useTranslation } from 'react-i18next'
import { Trash2, Loader2 } from 'lucide-react'
import type { UploadedFile } from '../lib/api-client'
import { FileStatusBadge } from './file-status-badge'

interface UploadedFileRowProps {
  file: UploadedFile
  onDelete: (id: string) => void
  isDeleting: boolean
}

export function UploadedFileRow({ file, onDelete, isDeleting }: UploadedFileRowProps) {
  const { t } = useTranslation()

  const isLinked = file.status === 'LINKED'
  const display = file.displayName ?? file.filename
  const tooltip = isLinked
    ? t('portal.uploadedFiles.linkedTooltip')
    : t('portal.uploadedFiles.deleteAria', { filename: display })

  const handleClick = () => {
    if (isLinked || isDeleting) return
    if (window.confirm(t('portal.uploadedFiles.deleteConfirm'))) {
      onDelete(file.id)
    }
  }

  return (
    <li className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-card">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm text-foreground">{display}</p>
        <div className="mt-1">
          <FileStatusBadge status={file.status} />
        </div>
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={isLinked || isDeleting}
        title={tooltip}
        aria-label={tooltip}
        aria-disabled={isLinked || isDeleting}
        className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-error hover:bg-error/10 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </li>
  )
}
