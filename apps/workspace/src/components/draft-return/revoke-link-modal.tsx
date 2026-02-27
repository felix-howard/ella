/**
 * RevokeLinkModal - Confirmation modal for revoking draft return link
 * Shows warning about consequences of revoking the link
 */

import { useTranslation } from 'react-i18next'
import { Link2Off, AlertTriangle, Loader2 } from 'lucide-react'
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  Button,
} from '@ella/ui'

interface RevokeLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  currentExpiryDate: Date | null
  viewCount: number
  isLoading?: boolean
}

export function RevokeLinkModal({
  isOpen,
  onClose,
  onConfirm,
  currentExpiryDate,
  viewCount,
  isLoading = false,
}: RevokeLinkModalProps) {
  const { t, i18n } = useTranslation()

  const formatDate = (date: Date | null) => {
    if (!date) return '-'
    return date.toLocaleDateString(i18n.language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const daysUntilExpiry = currentExpiryDate
    ? Math.ceil((currentExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalHeader>
        <ModalTitle className="text-destructive flex items-center gap-2">
          <Link2Off className="w-5 h-5" />
          {t('draftReturn.revokeModalTitle')}
        </ModalTitle>
        <ModalDescription>
          {t('draftReturn.revokeModalDesc')}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          {/* Warning box */}
          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">
                {t('draftReturn.revokeWarning')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('draftReturn.revokeWarningDetail')}
              </p>
            </div>
          </div>

          {/* Current link info */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t('draftReturn.linkInfo')}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t('draftReturn.totalViews')}:</span>
                <span className="ml-2 font-medium text-foreground">{viewCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('draftReturn.expiryDate')}:</span>
                <span className="ml-2 font-medium text-foreground">
                  {daysUntilExpiry > 0
                    ? t('draftReturn.expiresIn', { days: daysUntilExpiry })
                    : t('draftReturn.expiringToday')}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(currentExpiryDate)}
            </p>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isLoading}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('draftReturn.revoking')}
            </>
          ) : (
            <>
              <Link2Off className="w-4 h-4 mr-2" />
              {t('draftReturn.revokeConfirmBtn')}
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
