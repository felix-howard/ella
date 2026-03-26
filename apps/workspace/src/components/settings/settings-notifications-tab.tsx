/**
 * Settings Notifications Tab - Notification preferences for current user
 * Always editable - toggles and checkboxes auto-save on change
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Bell } from 'lucide-react'
import { Card, Switch } from '@ella/ui'
import { NotificationSubscriptions } from '../profile/notification-subscriptions'
import { ChatMonitorSubscriptions } from '../profile/chat-monitor-subscriptions'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

export function SettingsNotificationsTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-member-profile', 'me'],
    queryFn: () => api.team.getProfile('me'),
  })

  const staff = data?.staff

  const profileQueryKey = ['team-member-profile', 'me']

  const updateUploadMutation = useMutation({
    mutationFn: (notifyOnUpload: boolean) =>
      api.team.updateProfile('me', {
        firstName: staff!.firstName,
        lastName: staff!.lastName,
        phoneNumber: staff!.phoneNumber || null,
        notifyOnUpload,
      }),
    onMutate: async (notifyOnUpload) => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey })
      const previous = queryClient.getQueryData(profileQueryKey)
      queryClient.setQueryData(profileQueryKey, (old: Record<string, unknown>) =>
        old ? { ...old, staff: { ...old.staff, notifyOnUpload } } : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(profileQueryKey, context.previous)
      toast.error(t('profile.updateError'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey })
      queryClient.invalidateQueries({ queryKey: ['staff-me'] })
    },
  })

  const updateChatMutation = useMutation({
    mutationFn: (notifyOnChat: boolean) =>
      api.team.updateProfile('me', {
        firstName: staff!.firstName,
        lastName: staff!.lastName,
        phoneNumber: staff!.phoneNumber || null,
        notifyOnChat,
      }),
    onMutate: async (notifyOnChat) => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey })
      const previous = queryClient.getQueryData(profileQueryKey)
      queryClient.setQueryData(profileQueryKey, (old: Record<string, unknown>) =>
        old ? { ...old, staff: { ...old.staff, notifyOnChat } } : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(profileQueryKey, context.previous)
      toast.error(t('profile.updateError'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey })
      queryClient.invalidateQueries({ queryKey: ['staff-me'] })
    },
  })

  const handleToggleNotifyOnUpload = (checked: boolean) => {
    updateUploadMutation.mutate(checked)
  }

  const handleToggleNotifyOnChat = (checked: boolean) => {
    updateChatMutation.mutate(checked)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (isError || !staff) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Bell className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {t('settings.notificationsLoadError')}
        </h3>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="px-6 py-4 bg-muted/50 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {t('settings.smsNotifications')}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Notify on Upload Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-4">
              <label htmlFor="notifyOnUpload" className="text-sm font-medium text-foreground">
                {t('profile.notifyOnUpload')}
              </label>
              <p className="text-sm text-muted-foreground">
                {t('profile.notifyOnUploadDesc')}
              </p>
            </div>
            <Switch
              id="notifyOnUpload"
              checked={staff.notifyOnUpload}
              onCheckedChange={handleToggleNotifyOnUpload}
            />
          </div>

          {/* Phone required hint */}
          {!staff.phoneNumber && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('profile.phoneRequiredForSms')}
            </p>
          )}

          {/* Admin: subscribe to other members' client upload notifications */}
          {staff.role === 'ADMIN' && (
            <NotificationSubscriptions staffId="me" isEditing />
          )}

          {/* Chat Monitoring - Admin only */}
          {staff.role === 'ADMIN' && (
            <>
              <div className="border-t border-border my-4" />
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <label htmlFor="notifyOnChat" className="text-sm font-medium text-foreground">
                    {t('profile.notifyOnChat')}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {t('profile.notifyOnChatDesc')}
                  </p>
                </div>
                <Switch
                  id="notifyOnChat"
                  checked={staff.notifyOnChat}
                  onCheckedChange={handleToggleNotifyOnChat}
                />
              </div>
              {staff.notifyOnChat && (
                <ChatMonitorSubscriptions staffId="me" isEditing />
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
