/**
 * Chat Monitor Subscriptions - Admin-only checkbox list
 * Allows admins to subscribe to staff members' chat activity notifications
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@ella/ui'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface ChatMonitorSubscriptionsProps {
  staffId: string
  isEditing: boolean
}

export function ChatMonitorSubscriptions({ staffId, isEditing }: ChatMonitorSubscriptionsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notification-subscriptions', staffId],
    queryFn: () => api.team.getNotificationSubscriptions(staffId),
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Sync state when data loads
  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial sync from server data is intentional
      setSelectedIds(new Set(data.chatSubscriptions))
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => api.team.updateNotificationSubscriptions(staffId, Array.from(selectedIds), 'CHAT'),
    onSuccess: () => {
      toast.success(t('profile.subscriptionsUpdated'))
      queryClient.invalidateQueries({ queryKey: ['notification-subscriptions', staffId] })
    },
    onError: () => {
      toast.error(t('profile.subscriptionsUpdateError'))
    },
  })

  const handleToggle = (memberId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
      }
      return next
    })
  }

  const isDirty = data && (
    selectedIds.size !== data.chatSubscriptions.length ||
    Array.from(selectedIds).some((id) => !data.chatSubscriptions.includes(id))
  )

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
              checked={selectedIds.has(member.id)}
              onChange={() => handleToggle(member.id)}
              disabled={!isEditing}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20 disabled:opacity-50"
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

      {/* Save button - only when editing and dirty */}
      {isEditing && isDirty && (
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1.5" />
            )}
            {t('profile.saveSubscriptions')}
          </Button>
        </div>
      )}
    </div>
  )
}
