/**
 * Invite Member Dialog - Form to invite a new team member via email
 * Sends invitation through Clerk Organizations API
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, Button, Input, Select } from '@ella/ui'
import { api, type OrgRole } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface InviteMemberDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function InviteMemberDialog({ isOpen, onClose }: InviteMemberDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('org:member')

  const inviteMutation = useMutation({
    mutationFn: () => api.team.invite({ emailAddress: email, role }),
    onSuccess: () => {
      toast.success(t('team.inviteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send invitation')
    },
  })

  const handleClose = () => {
    setEmail('')
    setRole('org:member')
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
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as OrgRole)} aria-label={t('team.inviteRole')}>
              <option value="org:member">{t('team.member')}</option>
              <option value="org:admin">{t('team.admin')}</option>
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
