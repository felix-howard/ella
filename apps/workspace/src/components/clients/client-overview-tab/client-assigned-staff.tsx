/**
 * Client Managed By - Shows and allows changing the managing staff member
 * Admin: dropdown to select/change manager
 * Member: read-only label
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Users, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { useOrgRole } from '../../../hooks/use-org-role'
import { getInitials, getAvatarColor } from '../../../lib/formatters'

interface ClientManagedByProps {
  clientId: string
  managedBy?: { id: string; name: string } | null
}

export function ClientAssignedStaff({ clientId, managedBy }: ClientManagedByProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { isAdmin } = useOrgRole()

  const { data: membersData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
    enabled: isAdmin,
  })

  const members = membersData?.data ?? []

  const changeMutation = useMutation({
    mutationFn: (staffId: string) => api.clients.updateManagedBy(clientId, staffId),
    onSuccess: () => {
      toast.success(t('clientOverview.managedByUpdated'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: () => {
      toast.error(t('clientOverview.managedByUpdateFailed'))
    },
  })

  const avatarColor = managedBy ? getAvatarColor(managedBy.name) : null

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" />
        {t('clientOverview.managedBy')}
      </h3>

      {/* Current manager display */}
      <div className="flex items-center gap-3 mb-3">
        {managedBy ? (
          <span className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-muted text-sm shadow-sm">
            <span className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
              avatarColor?.bg,
              avatarColor?.text
            )}>
              {getInitials(managedBy.name)}
            </span>
            <span className="text-foreground">{managedBy.name}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{t('clientOverview.noManagedBy')}</span>
        )}
        {changeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Admin: dropdown to change manager */}
      {isAdmin && members.length > 0 && (
        <select
          value={managedBy?.id ?? ''}
          onChange={(e) => {
            if (e.target.value) changeMutation.mutate(e.target.value)
          }}
          className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          disabled={changeMutation.isPending}
        >
          <option value="" disabled>{t('clientOverview.changeManagedBy')}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
