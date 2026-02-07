/**
 * Schedule E Actions - Action buttons for lock/unlock/resend
 */
import { useState } from 'react'
import { Lock, Unlock, RefreshCw, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@ella/ui'
import type { ScheduleEStatus } from '../../../../lib/api-client'
import { useScheduleEActions } from '../../../../hooks/use-schedule-e-actions'

interface ScheduleEActionsProps {
  caseId: string
  status: ScheduleEStatus
}

export function ScheduleEActions({ caseId, status }: ScheduleEActionsProps) {
  const { t } = useTranslation()
  const { lock, unlock, resend, isLoading } = useScheduleEActions({ caseId })
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
              aria-label={t('scheduleE.unlockButton')}
            >
              {unlock.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Unlock className="w-4 h-4" aria-hidden="true" />
              )}
              {t('scheduleE.unlockButton')}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLockConfirm(true)}
              disabled={isLoading}
              className="gap-2"
              aria-label={t('scheduleE.lockButton')}
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              {t('scheduleE.lockButton')}
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
            aria-label={t('scheduleE.resendLink')}
          >
            {resend.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            )}
            {t('scheduleE.resendLink')}
          </Button>
        )}
      </div>

      {/* Lock Confirmation Modal */}
      <Modal open={showLockConfirm} onClose={() => setShowLockConfirm(false)}>
        <ModalHeader>
          <ModalTitle>{t('scheduleE.formLockConfirmTitle')}</ModalTitle>
          <ModalDescription>
            {t('scheduleE.formLockConfirmDesc')}
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => setShowLockConfirm(false)}
            disabled={lock.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              lock.mutate(undefined, {
                onSettled: () => setShowLockConfirm(false),
              })
            }}
            disabled={lock.isPending}
            className="gap-2"
            aria-label={t('scheduleE.confirmLock')}
          >
            {lock.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Lock className="w-4 h-4" aria-hidden="true" />
            )}
            {t('scheduleE.confirmLock')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
