import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api-client'
import {
  disableCurrentBrowserPush,
  enableCurrentBrowserPush,
  getExistingPushSubscription,
  getNotificationPermission,
  getWebPushReadiness,
} from '../lib/web-push'
import { toast } from '../stores/toast-store'

const VAPID_QUERY_KEY = ['push', 'vapid-public-key'] as const
const SUBSCRIPTIONS_QUERY_KEY = ['push', 'subscriptions'] as const

function getPushErrorKey(error: unknown): string {
  if (!(error instanceof Error)) return 'webPush.saveFailed'
  if (error.message === 'PUSH_PERMISSION_DENIED') return 'webPush.permissionDeniedToast'
  if (error.message === 'SERVICE_WORKER_UNAVAILABLE') return 'webPush.serviceWorkerUnavailableToast'
  return 'webPush.saveFailed'
}

export function useWebPushSubscription() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [browserSubscription, setBrowserSubscription] = useState<PushSubscription | null>(null)
  const [permission, setPermission] = useState(() => getNotificationPermission())
  const readiness = useMemo(() => getWebPushReadiness(globalThis, permission), [permission])

  const vapidQuery = useQuery({
    queryKey: VAPID_QUERY_KEY,
    queryFn: () => api.push.getVapidPublicKey(),
    staleTime: 5 * 60 * 1000,
  })

  const subscriptionsQuery = useQuery({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: () => api.push.listSubscriptions(),
    enabled: readiness.isSupported && vapidQuery.data?.configured === true,
  })

  const browserEndpoint = browserSubscription?.endpoint ?? null
  const currentSubscriptionQuery = useQuery({
    queryKey: ['push', 'current-subscription', browserEndpoint],
    queryFn: () => api.push.getCurrentSubscription(browserEndpoint!),
    enabled: readiness.isSupported && vapidQuery.data?.configured === true && Boolean(browserEndpoint),
    retry: false,
  })

  const refreshBrowserSubscription = useCallback(async () => {
    const subscription = readiness.isSupported ? await getExistingPushSubscription() : null
    setBrowserSubscription(subscription)
    setPermission(getNotificationPermission())
  }, [readiness.isSupported])

  useEffect(() => {
    let isMounted = true
    const subscriptionPromise = readiness.isSupported
      ? getExistingPushSubscription()
      : Promise.resolve(null)

    subscriptionPromise
      .then((subscription) => {
        if (!isMounted) return
        setBrowserSubscription(subscription)
        setPermission(getNotificationPermission())
      })
      .catch(() => {
        if (!isMounted) return
        setBrowserSubscription(null)
        setPermission(getNotificationPermission())
      })

    return () => {
      isMounted = false
    }
  }, [readiness.isSupported])

  const invalidatePushQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['push'] })
  }, [queryClient])

  const enableMutation = useMutation({
    mutationFn: async () => {
      const publicKey = vapidQuery.data?.publicKey
      if (!vapidQuery.data?.configured || !publicKey) throw new Error('WEB_PUSH_NOT_CONFIGURED')
      return enableCurrentBrowserPush(publicKey, api.push.subscribe)
    },
    onSuccess: async () => {
      toast.success(t('webPush.enabledToast'))
      await refreshBrowserSubscription()
      invalidatePushQueries()
    },
    onError: (error) => {
      setPermission(getNotificationPermission())
      toast.error(t(getPushErrorKey(error)))
    },
  })

  const disableMutation = useMutation({
    mutationFn: () => disableCurrentBrowserPush((endpoint) => api.push.unsubscribe(endpoint)),
    onSuccess: async (result) => {
      toast.success(t(result.disabled ? 'webPush.disabledToast' : 'webPush.noCurrentDeviceToast'))
      await refreshBrowserSubscription()
      invalidatePushQueries()
    },
    onError: () => {
      toast.error(t('webPush.disableFailed'))
    },
  })

  const testMutation = useMutation({
    mutationFn: () => api.push.sendTest(),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('webPush.testSentToast'))
        invalidatePushQueries()
      } else {
        toast.error(t('webPush.testFailedToast'))
      }
    },
    onError: () => {
      toast.error(t('webPush.testFailedToast'))
    },
  })

  const isConfigured = vapidQuery.data?.configured === true
  const isEnabled = currentSubscriptionQuery.data?.current === true
  const activeSubscriptions = subscriptionsQuery.data?.data ?? []
  const isCurrentSubscriptionLoading = Boolean(browserEndpoint) && currentSubscriptionQuery.isLoading

  return {
    activeSubscriptions,
    browserEndpoint,
    canDisable: isEnabled && !disableMutation.isPending,
    canEnable: readiness.isSupported && isConfigured && !isEnabled && !enableMutation.isPending,
    canSendTest: isEnabled && isConfigured && !testMutation.isPending,
    enable: enableMutation.mutate,
    disable: disableMutation.mutate,
    sendTest: testMutation.mutate,
    isConfigured,
    isEnabled,
    isLoading: vapidQuery.isLoading || subscriptionsQuery.isLoading || isCurrentSubscriptionLoading,
    isEnabling: enableMutation.isPending,
    isDisabling: disableMutation.isPending,
    isSendingTest: testMutation.isPending,
    readiness,
  }
}
