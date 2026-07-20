import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Save, Trash2 } from 'lucide-react'
import {
  Button,
  Modal,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ella/ui'

interface AgreementDraftCloseConfirmationModalProps {
  open: boolean
  savePending: boolean
  canSave: boolean
  onCancel: () => void
  onSave: () => void
  onDiscard: () => void
}

export function AgreementDraftCloseConfirmationModal({
  open,
  savePending,
  canSave,
  onCancel,
  onSave,
  onDiscard,
}: AgreementDraftCloseConfirmationModalProps) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return undefined
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!savePending) onCancel()
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [onCancel, open, savePending])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <Modal
      open
      onClose={onCancel}
      closeOnOverlayClick={!savePending}
      closeOnEscape={false}
      showCloseButton={!savePending}
      closeButtonAriaLabel={t('common.close')}
      overlayClassName="z-[10020]"
      size="lg"
      aria-labelledby="agreement-draft-close-confirmation-title"
      aria-describedby="agreement-draft-close-confirmation-description"
    >
      <ModalHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          <ModalTitle
            id="agreement-draft-close-confirmation-title"
            className="text-foreground"
          >
            {t('agreements.draft.closeConfirmation.title')}
          </ModalTitle>
        </div>
        <ModalDescription
          id="agreement-draft-close-confirmation-description"
          className="leading-relaxed"
        >
          {savePending
            ? t('agreements.draft.closeConfirmation.busyDescription')
            : t('agreements.draft.closeConfirmation.description')}
        </ModalDescription>
        {!canSave && !savePending && (
          <p className="mt-2 text-xs leading-5 text-amber-700">
            {t('agreements.draft.closeConfirmation.invalidHint')}
          </p>
        )}
      </ModalHeader>
      <ModalFooter className="flex-col-reverse sm:flex-row">
        <Button
          type="button"
          variant="destructive"
          onClick={onDiscard}
          disabled={savePending}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {t('agreements.draft.closeConfirmation.dontSave')}
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={!canSave || savePending}
          className="gap-2"
        >
          {savePending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {t('agreements.draft.closeConfirmation.save')}
        </Button>
      </ModalFooter>
    </Modal>,
    document.body,
  )
}
