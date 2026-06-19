import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button, Modal, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@ella/ui'
import type { CompanyVaultCredential } from '../../lib/api-client'

interface CompanyVaultDeleteDialogProps {
  credential: CompanyVaultCredential | null
  isPending?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function CompanyVaultDeleteDialog({
  credential,
  isPending = false,
  onClose,
  onConfirm,
}: CompanyVaultDeleteDialogProps) {
  const { t } = useTranslation()
  const open = Boolean(credential)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      closeOnEscape={!isPending}
      closeOnOverlayClick={!isPending}
      showCloseButton={!isPending}
      aria-labelledby="company-vault-delete-title"
      aria-describedby="company-vault-delete-description"
    >
      <ModalHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
          <ModalTitle id="company-vault-delete-title" className="text-destructive">
            {t('companyVault.deleteTitle')}
          </ModalTitle>
        </div>
        <ModalDescription id="company-vault-delete-description" className="break-words leading-relaxed [overflow-wrap:anywhere]">
          {t('companyVault.deleteDescription', { toolName: credential?.toolName ?? '' })}
        </ModalDescription>
      </ModalHeader>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending} className="gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t('companyVault.deleteConfirm')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
