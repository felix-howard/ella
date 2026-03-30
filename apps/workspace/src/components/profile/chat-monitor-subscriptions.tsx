/**
 * Chat Monitor Subscriptions - Admin-only checkbox list
 * Allows admins to subscribe to staff members' chat activity notifications
 * Auto-saves on toggle with optimistic updates
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface ChatMonitorSubscriptionsProps {
  staffId: string
  isEditing: boolean
}

export function ChatMonitorSubscriptions({ staffId, isEditing }: ChatMonitorSubscriptionsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = ['notification-subscriptions', staffId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.team.getNotificationSubscriptions(staffId),
  })

  const toggleMutation = useMutation({
    mutationFn: (newSubscriptions: string[]) =>
      api.team.updateNotificationSubscriptions(staffId, newSubscriptions, 'CHAT'),
    onMutate: async (newSubscriptions) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: typeof data) =>
        old ? { ...old, chatSubscriptions: newSubscriptions } : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      toast.error(t('profile.subscriptionsUpdateError'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const handleToggle = (memberId: string) => {
    if (!data) return
    const current = new Set(data.chatSubscriptions)
    if (current.has(memberId)) {
      current.delete(memberId)
    } else {
      current.add(memberId)
    }
    toggleMutation.mutate(Array.from(current))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!data || data.members.length === 0) return null

  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-foreground mb-3">
        {t('profile.chatMonitorMembers')}
      </p>

      <div className="space-y-2">
        {data.members.map((member) => (
          <label
            key={member.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={data.chatSubscriptions.includes(member.id)}
              onChange={() => handleToggle(member.id)}
              disabled={!isEditing}
              className="h-4 w-4 rounded border-input accent-emerald-500 focus:ring-emerald-500/20 disabled:opacity-50"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-foreground">{member.name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                ({member._count.managedClients} {t('profile.clients')})
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
