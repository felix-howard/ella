import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ella/ui'
import type { TeamMembershipStatus } from '../../lib/api-client'

interface RemoveMemberAccessDialogProps {
  open: boolean
  staffName: string
  managedClientCount: number
  membershipStatus?: TeamMembershipStatus
  isPending?: boolean
  onClose: () => void
  onConfirm: () => void
}

function clerkSeatWarningKey(status: TeamMembershipStatus | undefined): string {
  if (status === 'ACTIVE_MISSING_CLERK') return 'team.removeAccessWarningNoClerkMembership'
  if (status === undefined) return 'team.removeAccessWarningPossibleSeat'
  return 'team.removeAccessWarningFreesSeat'
}

export function RemoveMemberAccessDialog({
  open,
  staffName,
  managedClientCount,
  membershipStatus,
  isPending = false,
  onClose,
  onConfirm,
}: RemoveMemberAccessDialogProps) {
  const { t } = useTranslation()
  const seatWarningKey = clerkSeatWarningKey(membershipStatus)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      closeOnEscape={!isPending}
      closeOnOverlayClick={!isPending}
      showCloseButton={!isPending}
      aria-labelledby="remove-member-access-title"
      aria-describedby="remove-member-access-description"
    >
      <ModalHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
          <ModalTitle id="remove-member-access-title" className="text-destructive">
            {t('team.removeAccessTitle', 'Remove access')}
          </ModalTitle>
        </div>
        <ModalDescription id="remove-member-access-description">
          {t('team.removeAccessDescription', {
            name: staffName,
            defaultValue: 'Remove organization access for {{name}}?',
          })}
        </ModalDescription>
      </ModalHeader>
      <ModalBody>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>{t('team.removeAccessWarningLosesAccess', 'They will lose Clerk organization access.')}</li>
          <li>
            {t(
              seatWarningKey,
              seatWarningKey === 'team.removeAccessWarningNoClerkMembership'
                ? 'No Clerk membership was found; the Staff access record will be archived.'
                : seatWarningKey === 'team.removeAccessWarningPossibleSeat'
                  ? 'If a Clerk membership exists, its seat will be freed.'
                  : 'Their Clerk seat will be freed.'
            )}
          </li>
          <li>{t('team.removeAccessWarningKeepsHistory', 'The Staff record and historical assignments remain.')}</li>
          {managedClientCount > 0 && (
            <li className="font-medium text-amber-700 dark:text-amber-300">
              {t('team.removeAccessWarningManagedClients', {
                count: managedClientCount,
                defaultValue: '{{count}} managed clients may need reassignment.',
              })}
            </li>
          )}
        </ul>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending} className="gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t('team.removeAccessConfirm', 'Remove access')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
