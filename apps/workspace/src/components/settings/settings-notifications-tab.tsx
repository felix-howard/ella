/**
 * Settings Notifications Tab - Notification preferences for current user
 * Always editable - toggles and checkboxes auto-save on change.
 * Agreement-signed + client-payment SMS toggles are ADMIN-only (server
 * rejects them for other roles too).
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Bell } from 'lucide-react'
import { Card, Switch } from '@ella/ui'
import { NotificationSubscriptions } from '../profile/notification-subscriptions'
import { ChatMonitorSubscriptions } from '../profile/chat-monitor-subscriptions'
import { api } from '../../lib/api-client'
import { useNotifyPrefMutation, type NotifyPrefField } from './use-notify-pref-mutation'
import { WebPushNotificationsCard } from './web-push-notifications-card'

function NotifyToggleRow({
  field,
  checked,
  labelKey,
  descKey,
  onToggle,
}: {
  field: NotifyPrefField
  checked: boolean
  labelKey: string
  descKey: string
  onToggle: (checked: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 pr-4">
        <label htmlFor={field} className="text-sm font-medium text-foreground">
          {t(labelKey)}
        </label>
        <p className="text-sm text-muted-foreground">{t(descKey)}</p>
      </div>
      <Switch id={field} checked={checked} onCheckedChange={onToggle} />
    </div>
  )
}

export function SettingsNotificationsTab() {
  const { t } = useTranslation()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-member-profile', 'me'],
    queryFn: () => api.team.getProfile('me'),
  })

  const staff = data?.staff

  const uploadMutation = useNotifyPrefMutation(staff, 'notifyOnUpload')
  const chatMutation = useNotifyPrefMutation(staff, 'notifyOnChat')
  const agreementSignedMutation = useNotifyPrefMutation(staff, 'notifyOnAgreementSigned')
  const clientPaymentMutation = useNotifyPrefMutation(staff, 'notifyOnClientPayment')

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

  const isAdmin = staff.role === 'ADMIN'

  return (
    <div className="space-y-4">
      <WebPushNotificationsCard />

      <Card className="overflow-hidden">
        <div className="px-6 py-4 bg-muted/50 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {t('settings.smsNotifications')}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <NotifyToggleRow
            field="notifyOnUpload"
            checked={staff.notifyOnUpload}
            labelKey="profile.notifyOnUpload"
            descKey="profile.notifyOnUploadDesc"
            onToggle={(checked) => uploadMutation.mutate(checked)}
          />

          {/* Phone required hint */}
          {!staff.phoneNumber && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('profile.phoneRequiredForSms')}
            </p>
          )}

          {/* Admin: subscribe to other members' client upload notifications */}
          {isAdmin && <NotificationSubscriptions staffId="me" isEditing />}

          {/* Chat Monitoring - Admin only */}
          {isAdmin && (
            <>
              <div className="border-t border-border my-4" />
              <NotifyToggleRow
                field="notifyOnChat"
                checked={staff.notifyOnChat}
                labelKey="profile.notifyOnChat"
                descKey="profile.notifyOnChatDesc"
                onToggle={(checked) => chatMutation.mutate(checked)}
              />
              {staff.notifyOnChat && <ChatMonitorSubscriptions staffId="me" isEditing />}
            </>
          )}

          {/* Agreements & Payments - Admin only (MANAGER/MEMBER never see these) */}
          {isAdmin && (
            <>
              <div className="border-t border-border my-4" />
              <NotifyToggleRow
                field="notifyOnAgreementSigned"
                checked={staff.notifyOnAgreementSigned}
                labelKey="profile.notifyOnAgreementSigned"
                descKey="profile.notifyOnAgreementSignedDesc"
                onToggle={(checked) => agreementSignedMutation.mutate(checked)}
              />
              <NotifyToggleRow
                field="notifyOnClientPayment"
                checked={staff.notifyOnClientPayment}
                labelKey="profile.notifyOnClientPayment"
                descKey="profile.notifyOnClientPaymentDesc"
                onToggle={(checked) => clientPaymentMutation.mutate(checked)}
              />
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
