/**
 * Uploaded File Row
 * Single row in the entity uploaded-files list: filename, status badge, delete button.
 * Delete is disabled (greyed) when status === 'LINKED' with a tooltip explaining why.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Loader2, Trash2 } from 'lucide-react'
import { Button, Modal, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@ella/ui'
import type { UploadedFile } from '../lib/api-client'
import { FileStatusBadge } from './file-status-badge'

interface UploadedFileRowProps {
  file: UploadedFile
  onDelete: (id: string) => void
  isDeleting: boolean
}

export function UploadedFileRow({ file, onDelete, isDeleting }: UploadedFileRowProps) {
  const { t } = useTranslation()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  const isLinked = file.status === 'LINKED'
  const display = file.displayName ?? file.filename
  const tooltip = isLinked
    ? t('portal.uploadedFiles.linkedTooltip')
    : t('portal.uploadedFiles.deleteAria', { filename: display })

  const handleClick = () => {
    if (isLinked || isDeleting) return
    setIsConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (isDeleting) return
    onDelete(file.id)
  }

  return (
    <li className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <FileText className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate text-base font-semibold text-foreground">{display}</p>
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
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        )}
      </button>

      <Modal
        open={isConfirmOpen}
        onClose={() => !isDeleting && setIsConfirmOpen(false)}
        size="sm"
        closeOnOverlayClick={!isDeleting}
        closeOnEscape={!isDeleting}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <ModalHeader>
          <ModalTitle id={titleId}>{t('portal.uploadedFiles.deleteConfirm')}</ModalTitle>
          <ModalDescription id={descriptionId}>
            {t('portal.uploadedFiles.deleteModalDescription', { filename: display })}
          </ModalDescription>
        </ModalHeader>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-foreground">
          <span className="line-clamp-2 break-all">{display}</span>
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsConfirmOpen(false)}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="bg-error text-white shadow-sm hover:bg-error/90 focus-visible:ring-error/40"
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {t('portal.uploadedFiles.deleteAction')}
          </Button>
        </ModalFooter>
      </Modal>
    </li>
  )
}
