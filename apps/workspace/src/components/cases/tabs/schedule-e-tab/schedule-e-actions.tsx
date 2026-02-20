/**
 * Schedule E Actions - Action buttons for lock/unlock and form link access
 */
import { useState } from 'react'
import { Lock, Unlock, Loader2, ExternalLink, Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@ella/ui'
import type { ScheduleEStatus } from '../../../../lib/api-client'
import { useScheduleEActions } from '../../../../hooks/use-schedule-e-actions'
import { toast } from '../../../../stores/toast-store'

interface ScheduleEActionsProps {
  caseId: string
  status: ScheduleEStatus
  magicLinkToken?: string | null
}

// Build form URL from token
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5173'

export function ScheduleEActions({ caseId, status, magicLinkToken }: ScheduleEActionsProps) {
  const { t } = useTranslation()
  const { lock, unlock, isLoading } = useScheduleEActions({ caseId })
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  const isLocked = status === 'LOCKED'
  const isDraft = status === 'DRAFT'
  const formLink = magicLinkToken ? `${PORTAL_URL}/rental/${magicLinkToken}` : null

  const handleCopyLink = async () => {
    if (!formLink) return
    try {
      await navigator.clipboard.writeText(formLink)
      setCopied(true)
      toast.success(t('common.linkCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('common.copyFailed'))
    }
  }

  const handleOpenLink = () => {
    if (formLink) {
      window.open(formLink, '_blank', 'noopener,noreferrer')
    }
  }

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

        {/* Form Link Buttons - only show if link exists and not locked */}
        {!isLocked && formLink && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenLink}
              className="gap-2"
              aria-label={t('common.openLink')}
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              {t('common.openLink')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-2"
              aria-label={t('common.copyLink')}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )}
              {t('common.copyLink')}
            </Button>
          </>
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
