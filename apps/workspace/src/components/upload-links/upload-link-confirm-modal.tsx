import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@ella/ui'

interface UploadLinkConfirmModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  variant?: 'default' | 'destructive'
  isPending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function UploadLinkConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  variant = 'default',
  isPending = false,
  onCancel,
  onConfirm,
}: UploadLinkConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <ModalHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className={variant === 'destructive' ? 'h-5 w-5 text-destructive' : 'h-5 w-5 text-amber-600'} />
          <ModalTitle>{title}</ModalTitle>
        </div>
        <ModalDescription>{description}</ModalDescription>
      </ModalHeader>
      <ModalBody>
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t('uploadLinks.confirmAuditHint')}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onClick={onConfirm}
          disabled={isPending}
          className="gap-2"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
