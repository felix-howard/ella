/**
 * Settings Notifications Tab - Notification preferences for current user
 * Extracted from profile form for better UX organization
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Bell, Check, Edit2 } from 'lucide-react'
import { Button, Card, Switch } from '@ella/ui'
import { NotificationSubscriptions } from '../profile/notification-subscriptions'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

export function SettingsNotificationsTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-member-profile', 'me'],
    queryFn: () => api.team.getProfile('me'),
  })

  const [editNotifyOnUpload, setEditNotifyOnUpload] = useState(false)

  // Sync state when data loads
  const staff = data?.staff
  if (staff && !isEditing && editNotifyOnUpload !== staff.notifyOnUpload) {
    setEditNotifyOnUpload(staff.notifyOnUpload)
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      api.team.updateProfile('me', {
        firstName: staff!.firstName,
        lastName: staff!.lastName,
        phoneNumber: staff!.phoneNumber || null,
        notifyOnUpload: editNotifyOnUpload,
      }),
    onSuccess: () => {
      toast.success(t('profile.updateSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['staff-me'] })
      setIsEditing(false)
    },
    onError: () => {
      toast.error(t('profile.updateError'))
    },
  })

  const handleSave = () => {
    updateMutation.mutate()
  }

  const handleCancel = () => {
    if (staff) {
      setEditNotifyOnUpload(staff.notifyOnUpload)
    }
    setIsEditing(false)
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

  const isDirty = editNotifyOnUpload !== staff.notifyOnUpload

  return (
    <div className="space-y-4">
      {/* SMS Notifications Card */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {t('settings.smsNotifications')}
          </h2>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              {t('common.edit')}
            </Button>
          )}
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
              checked={isEditing ? editNotifyOnUpload : staff.notifyOnUpload}
              onCheckedChange={setEditNotifyOnUpload}
              disabled={!isEditing}
            />
          </div>

          {/* Phone required hint */}
          {!staff.phoneNumber && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('profile.phoneRequiredForSms')}
            </p>
          )}

          {/* Admin: subscribe to other members' client notifications */}
          {staff.role === 'ADMIN' && (
            <NotificationSubscriptions staffId="me" isEditing={isEditing} />
          )}

          {/* Actions */}
          {isEditing && (
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Button
                onClick={handleSave}
                disabled={!isDirty || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {t('common.save')}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
