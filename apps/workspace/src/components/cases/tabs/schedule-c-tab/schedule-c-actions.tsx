/**
 * Schedule C Actions - Action buttons for lock/unlock/resend
 */
import { useState } from 'react'
import { Lock, Unlock, RefreshCw, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@ella/ui'
import type { ScheduleCStatus } from '../../../../lib/api-client'
import { useScheduleCActions } from '../../../../hooks/use-schedule-c-actions'

interface ScheduleCActionsProps {
  caseId: string
  status: ScheduleCStatus
}

export function ScheduleCActions({ caseId, status }: ScheduleCActionsProps) {
  const { t } = useTranslation()
  const { lock, unlock, resend, isLoading } = useScheduleCActions({ caseId })
  const [showLockConfirm, setShowLockConfirm] = useState(false)

  const isLocked = status === 'LOCKED'
  const isDraft = status === 'DRAFT'

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
        {/* Lock/Unlock Button */}
        {!isDraft && (
          isLocked ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => unlock.mutate()}
              disabled={isLoading}
              className="gap-2"
              aria-label={t('scheduleC.unlockButton')}
            >
              {unlock.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Unlock className="w-4 h-4" aria-hidden="true" />
              )}
              {t('scheduleC.unlockButton')}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLockConfirm(true)}
              disabled={isLoading}
              className="gap-2"
              aria-label={t('scheduleC.lockButton')}
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              {t('scheduleC.lockButton')}
            </Button>
          )
        )}

        {/* Resend Button */}
        {!isLocked && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => resend.mutate()}
            disabled={isLoading}
            className="gap-2"
            aria-label={t('scheduleC.resendLink')}
          >
            {resend.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            )}
            {t('scheduleC.resendLink')}
          </Button>
        )}
      </div>

      {/* Lock Confirmation Modal */}
      <Modal open={showLockConfirm} onClose={() => setShowLockConfirm(false)}>
        <ModalHeader>
          <ModalTitle>{t('scheduleC.formLockConfirmTitle')}</ModalTitle>
          <ModalDescription>
            {t('scheduleC.formLockConfirmDesc')}
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => setShowLockConfirm(false)}
            disabled={lock.isPending}
          >
            {t('scheduleC.cancelButton')}
          </Button>
          <Button
            onClick={() => {
              lock.mutate(undefined, {
                onSettled: () => setShowLockConfirm(false),
              })
            }}
            disabled={lock.isPending}
            className="gap-2"
            aria-label={t('scheduleC.confirmLock')}
          >
            {lock.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Lock className="w-4 h-4" aria-hidden="true" />
            )}
            {t('scheduleC.confirmLock')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
