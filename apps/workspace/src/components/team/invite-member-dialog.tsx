/**
 * Invite Member Dialog - Form to invite a new team member via email
 * Sends invitation through Clerk Organizations API
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, Button, Input, Select } from '@ella/ui'
import { api, type AppRole } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface InviteMemberDialogProps {
  isOpen: boolean
  onClose: () => void
  initialEmail?: string
  initialRole?: AppRole
}

export function InviteMemberDialog({
  isOpen,
  onClose,
  initialEmail = '',
  initialRole = 'MEMBER',
}: InviteMemberDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState(initialEmail)
  const [role, setRole] = useState<AppRole>(initialRole)

  const inviteMutation = useMutation({
    mutationFn: () => api.team.invite({ emailAddress: email, role }),
    onSuccess: () => {
      toast.success(t('team.inviteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['team-reconciliation'] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send invitation')
    },
  })

  const handleClose = () => {
    setEmail(initialEmail)
    setRole(initialRole)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    inviteMutation.mutate()
  }

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <ModalTitle>{t('team.inviteMember')}</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-foreground mb-1.5">{t('team.inviteEmail')}</label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoFocus
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-foreground mb-1.5">{t('team.inviteRole')}</label>
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as AppRole)} aria-label={t('team.inviteRole')}>
              <option value="MEMBER">{t('team.member')}</option>
              <option value="MANAGER">{t('team.manager')}</option>
              <option value="ADMIN">{t('team.admin')}</option>
            </Select>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={inviteMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={inviteMutation.isPending || !email.trim()}>
            {inviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('team.inviteMember')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
