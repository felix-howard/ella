/**
 * ExtendLinkModal - Confirmation modal for extending draft return link expiry
 * Shows current expiry date and new expiry date after extension
 */

import { useTranslation } from 'react-i18next'
import { Clock, CalendarPlus, Loader2 } from 'lucide-react'
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  Button,
} from '@ella/ui'

interface ExtendLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  currentExpiryDate: Date | null
  isLoading?: boolean
}

const EXTENSION_DAYS = 14

export function ExtendLinkModal({
  isOpen,
  onClose,
  onConfirm,
  currentExpiryDate,
  isLoading = false,
}: ExtendLinkModalProps) {
  const { t, i18n } = useTranslation()

  // Calculate new expiry date (14 days from current expiry)
  const newExpiryDate = currentExpiryDate
    ? new Date(currentExpiryDate.getTime() + EXTENSION_DAYS * 24 * 60 * 60 * 1000)
    : null

  const formatDate = (date: Date | null) => {
    if (!date) return '-'
    return date.toLocaleDateString(i18n.language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const daysUntilCurrentExpiry = currentExpiryDate
    ? Math.ceil((currentExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{t('draftReturn.extendModalTitle')}</ModalTitle>
        <ModalDescription>
          {t('draftReturn.extendModalDesc')}
        </ModalDescription>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          {/* Current expiry */}
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Clock className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t('draftReturn.currentExpiry')}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(currentExpiryDate)}
              </p>
              {daysUntilCurrentExpiry > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  ({t('draftReturn.expiresIn', { days: daysUntilCurrentExpiry })})
                </p>
              )}
              {daysUntilCurrentExpiry <= 0 && currentExpiryDate && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ({t('draftReturn.expiringToday')})
                </p>
              )}
            </div>
          </div>

          {/* New expiry after extension */}
          <div className="flex items-start gap-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <CalendarPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t('draftReturn.newExpiry')}
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {formatDate(newExpiryDate)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (+{EXTENSION_DAYS} {t('draftReturn.days')})
              </p>
            </div>
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
          variant="default"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('draftReturn.extending')}
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 mr-2" />
              {t('draftReturn.extendConfirmBtn')}
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
