/**
 * PauseLinkModal - Confirmation modal for pausing a shared doc magic link.
 * Pause is reversible — body copy emphasizes clients lose access until resumed.
 */

import { useTranslation } from 'react-i18next'
import { PauseCircle, Loader2 } from 'lucide-react'
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  Button,
} from '@ella/ui'

interface PauseLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}

export function PauseLinkModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: PauseLinkModalProps) {
  const { t } = useTranslation()

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalHeader>
        <ModalTitle className="flex items-center gap-2">
          <PauseCircle className="w-5 h-5" />
          {t('sharedDocs.pauseModal.title')}
        </ModalTitle>
        <ModalDescription>{t('sharedDocs.pauseModal.body')}</ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          {t('sharedDocs.pauseModal.reversibleHint')}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="default" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('sharedDocs.pausing')}
            </>
          ) : (
            <>
              <PauseCircle className="w-4 h-4 mr-2" />
              {t('sharedDocs.actions.pause')}
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
