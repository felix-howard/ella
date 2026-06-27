import { AlertTriangle, BellRing, CheckCircle2, Loader2, Send, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '@ella/ui'
import { useWebPushSubscription } from '../../hooks/use-web-push-subscription'

function formatSeenAt(value: string): string {
  return new Date(value).toLocaleString()
}

export function WebPushNotificationsCard() {
  const { t } = useTranslation()
  const push = useWebPushSubscription()
  const showUnsupported = push.readiness.code === 'unsupported'
  const showIosInstall = push.readiness.code === 'ios-not-standalone'
  const showDenied = push.readiness.code === 'permission-denied'
  const showUnconfigured = push.readiness.isSupported && !push.isLoading && !push.isConfigured
  const hasBlockingState = showUnsupported || showIosInstall || showDenied || showUnconfigured
  const statusKey = push.isEnabled ? 'webPush.statusEnabled' : 'webPush.statusDisabled'

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          <BellRing className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t('webPush.title')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('webPush.description')}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {push.isLoading ? (
              <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-primary" />
            ) : push.isEnabled ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            ) : (
              <Smartphone className="mt-0.5 h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {push.isLoading ? t('webPush.statusChecking') : t(statusKey)}
              </p>
              <p className="text-sm text-muted-foreground">
                {push.isLoading
                  ? t('webPush.checkingDescription')
                  : push.isEnabled
                  ? t('webPush.enabledDescription')
                  : t('webPush.disabledDescription')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {push.isEnabled ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => push.sendTest()}
                  disabled={!push.canSendTest}
                >
                  {push.isSendingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t('webPush.sendTest')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => push.disable()}
                  disabled={!push.canDisable}
                >
                  {push.isDisabling && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('webPush.disable')}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => push.enable()}
                disabled={push.isLoading || !push.canEnable || hasBlockingState}
              >
                {push.isEnabling && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('webPush.enable')}
              </Button>
            )}
          </div>
        </div>

        {hasBlockingState && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {showUnsupported && t('webPush.unsupported')}
              {showIosInstall && t('webPush.iosInstallRequired')}
              {showDenied && t('webPush.permissionDenied')}
              {showUnconfigured && t('webPush.notConfigured')}
            </p>
          </div>
        )}

        {push.isEnabled && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {t('webPush.activeDevices')}
            </p>
            <div className="mt-2 space-y-2">
              {push.activeSubscriptions.length > 0 ? (
                push.activeSubscriptions.map((subscription) => (
                  <div
                    key={subscription.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-foreground">
                      {subscription.deviceLabel || t('webPush.unknownDevice')}
                    </span>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={subscription.lastSeenAt}
                    >
                      {formatSeenAt(subscription.lastSeenAt)}
                    </time>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t('webPush.noActiveDevices')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
