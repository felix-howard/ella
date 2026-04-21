/**
 * DeleteSectionConfirm - Confirmation modal for soft-deleting a shared doc section
 * Warns that the shareable link will be revoked immediately.
 */
import { useTranslation } from 'react-i18next'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  Button,
} from '@ella/ui'

interface DeleteSectionConfirmProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  isLoading?: boolean
}

export function DeleteSectionConfirm({
  isOpen,
  onClose,
  onConfirm,
  title,
  isLoading = false,
}: DeleteSectionConfirmProps) {
  const { t } = useTranslation()

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalHeader>
        <ModalTitle className="text-destructive flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          {t('sharedDocs.deleteConfirmTitle', { title })}
        </ModalTitle>
        <ModalDescription>
          {t('sharedDocs.deleteConfirmDesc')}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              {t('sharedDocs.revokeWarning')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('sharedDocs.revokeWarningDetail')}
            </p>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('sharedDocs.deleteSection')}
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              {t('sharedDocs.deleteConfirmBtn')}
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
