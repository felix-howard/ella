import { useState } from 'react'
import { AlertTriangle, CalendarClock, Loader2, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@ella/ui'
import type { IdentityRetentionExtensionDays, TaxCaseSummary } from '../../lib/api-client'

type ConfirmAction = 'mark-filed' | 'reopen'

interface CaseFiledActionProps {
  activeCase: Pick<TaxCaseSummary, 'id' | 'isFiled' | 'status' | 'filedAt'> | null | undefined
  canUpdateCase?: boolean
  isMarkFiledPending?: boolean
  isReopenPending?: boolean
  isExtendRetentionPending?: boolean
  canExtendIdentityRetention?: boolean
  onMarkFiled: () => Promise<unknown> | unknown
  onReopen: () => Promise<unknown> | unknown
  onExtendIdentityRetention?: (days: IdentityRetentionExtensionDays) => Promise<unknown> | unknown
}

interface CaseFiledActionConfirmModalProps {
  action: ConfirmAction | null
  isPending?: boolean
  onCancel: () => void
  onConfirm: () => Promise<unknown> | unknown
}

export function CaseFiledAction({
  activeCase,
  canUpdateCase = true,
  isMarkFiledPending = false,
  isReopenPending = false,
  isExtendRetentionPending = false,
  canExtendIdentityRetention = false,
  onMarkFiled,
  onReopen,
  onExtendIdentityRetention,
}: CaseFiledActionProps) {
  const { t } = useTranslation()
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [isExtendOpen, setIsExtendOpen] = useState(false)
  const [pendingExtendDays, setPendingExtendDays] = useState<IdentityRetentionExtensionDays | null>(null)

  if (!activeCase || !canUpdateCase) return null

  const isFiled = Boolean(activeCase.isFiled || activeCase.status === 'FILED' || activeCase.filedAt)
  const isPending = confirmAction === 'reopen' ? isReopenPending : isMarkFiledPending

  const handleConfirm = async () => {
    try {
      if (confirmAction === 'reopen') {
        await onReopen()
      } else {
        await onMarkFiled()
      }
      setConfirmAction(null)
    } catch {
      // Mutation handlers surface errors; keep modal open so the user can retry.
    }
  }

  const handleExtend = async (days: IdentityRetentionExtensionDays) => {
    if (!onExtendIdentityRetention) return
    setPendingExtendDays(days)
    try {
      await onExtendIdentityRetention(days)
      setIsExtendOpen(false)
    } catch {
      // Mutation handlers surface errors; keep modal open so the user can retry.
    } finally {
      setPendingExtendDays(null)
    }
  }

  return (
    <>
      {isFiled ? (
        <>
          {onExtendIdentityRetention && canExtendIdentityRetention && (
            <Button
              onClick={() => setIsExtendOpen(true)}
              disabled={isExtendRetentionPending}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              {isExtendRetentionPending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <CalendarClock className="w-4 h-4" aria-hidden="true" />
              )}
              {t('clientDetail.extendRetention')}
            </Button>
          )}
          <Button
            onClick={() => setConfirmAction('reopen')}
            disabled={isReopenPending}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            {isReopenPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
            )}
            {t('clientDetail.reopen')}
          </Button>
        </>
      ) : (
        <Button
          onClick={() => setConfirmAction('mark-filed')}
          disabled={isMarkFiledPending}
          size="sm"
          className="gap-1.5"
        >
          {isMarkFiledPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {t('clientDetail.markFiled')}
        </Button>
      )}

      <CaseFiledActionConfirmModal
        action={confirmAction}
        isPending={isPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
      />

      <IdentityRetentionExtendModal
        open={isExtendOpen}
        isPending={isExtendRetentionPending}
        pendingDays={pendingExtendDays}
        onCancel={() => setIsExtendOpen(false)}
        onExtend={handleExtend}
      />
    </>
  )
}

export function CaseFiledActionConfirmModal({
  action,
  isPending = false,
  onCancel,
  onConfirm,
}: CaseFiledActionConfirmModalProps) {
  const { t } = useTranslation()
  const isReopen = action === 'reopen'
  const titleId = isReopen ? 'case-reopen-confirm-title' : 'case-mark-filed-confirm-title'
  const descriptionId = isReopen ? 'case-reopen-confirm-description' : 'case-mark-filed-confirm-description'

  return (
    <Modal
      open={action !== null}
      onClose={() => {
        if (!isPending) onCancel()
      }}
      size="sm"
      closeOnOverlayClick={!isPending}
      closeOnEscape={!isPending}
      showCloseButton={!isPending}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <ModalHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          <ModalTitle id={titleId}>
            {isReopen ? t('clientDetail.reopenConfirmTitle') : t('clientDetail.markFiledConfirmTitle')}
          </ModalTitle>
        </div>
        <ModalDescription id={descriptionId}>
          {isReopen ? t('clientDetail.reopenConfirmDesc') : t('clientDetail.markFiledConfirmDesc')}
        </ModalDescription>
      </ModalHeader>
      <ModalBody className="space-y-2">
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {isReopen ? t('clientDetail.reopenRetentionNote') : t('clientDetail.markFiledRetentionNote')}
        </p>
        {!isReopen && (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t('clientDetail.markFiledMetadataNote')}
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isPending} className="gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isReopen ? t('clientDetail.reopenConfirm') : t('clientDetail.markFiledConfirm')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export function IdentityRetentionExtendModal({
  open,
  isPending = false,
  pendingDays,
  onCancel,
  onExtend,
}: {
  open: boolean
  isPending?: boolean
  pendingDays?: IdentityRetentionExtensionDays | null
  onCancel: () => void
  onExtend: (days: IdentityRetentionExtensionDays) => Promise<unknown> | unknown
}) {
  const { t } = useTranslation()
  const options: IdentityRetentionExtensionDays[] = [30, 60, 90]

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isPending) onCancel()
      }}
      size="sm"
      closeOnOverlayClick={!isPending}
      closeOnEscape={!isPending}
      showCloseButton={!isPending}
      aria-labelledby="case-identity-retention-extend-title"
      aria-describedby="case-identity-retention-extend-description"
    >
      <ModalHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
          <ModalTitle id="case-identity-retention-extend-title">
            {t('clientDetail.extendRetentionTitle')}
          </ModalTitle>
        </div>
        <ModalDescription id="case-identity-retention-extend-description">
          {t('clientDetail.extendRetentionDesc')}
        </ModalDescription>
      </ModalHeader>
      <ModalBody>
        <div className="grid grid-cols-3 gap-2">
          {options.map((days) => (
            <Button
              key={days}
              type="button"
              variant="outline"
              onClick={() => onExtend(days)}
              disabled={isPending}
              className="min-h-11 min-w-0 px-2 text-xs whitespace-normal leading-tight gap-1.5"
            >
              {pendingDays === days && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t('clientDetail.extendRetentionDays', { count: days })}
            </Button>
          ))}
        </div>
        <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t('clientDetail.extendRetentionNote')}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
