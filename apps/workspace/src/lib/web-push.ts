import type {
  WebPushSubscribeInput,
  WebPushSubscribeResponse,
} from './api-client'
import { registerWorkspaceServiceWorker } from './service-worker-registration'

type WebPushGlobal = typeof globalThis & {
  Notification?: Pick<typeof Notification, 'permission'>
  PushManager?: unknown
  isSecureContext?: boolean
  matchMedia?: (query: string) => Pick<MediaQueryList, 'matches'>
  navigator?: Navigator & { standalone?: boolean }
}

export type WebPushReadinessCode =
  | 'supported'
  | 'unsupported'
  | 'ios-not-standalone'
  | 'permission-denied'

export interface WebPushReadiness {
  code: WebPushReadinessCode
  isSupported: boolean
  isIos: boolean
  isStandalone: boolean
  permission: NotificationPermission | 'unsupported'
}

interface EnableWebPushOptions {
  requestPermission?: () => Promise<NotificationPermission>
  getRegistration?: () => Promise<ServiceWorkerRegistration | null>
}

interface DisableWebPushOptions {
  getSubscription?: () => Promise<PushSubscription | null>
}

export function isIos(
  navigatorRef: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> | undefined =
    typeof navigator === 'undefined' ? undefined : navigator
): boolean {
  if (!navigatorRef) return false
  return (
    /iPad|iPhone|iPod/.test(navigatorRef.userAgent) ||
    (navigatorRef.platform === 'MacIntel' && navigatorRef.maxTouchPoints > 1)
  )
}

export function isStandalonePwa(target: WebPushGlobal = globalThis): boolean {
  const navigatorRef = target.navigator
  return Boolean(
    target.matchMedia?.('(display-mode: standalone)').matches ||
      navigatorRef?.standalone === true
  )
}

export function isWebPushSupported(target: WebPushGlobal = globalThis): boolean {
  const navigatorRef = target.navigator
  return Boolean(
    target.isSecureContext !== false &&
      navigatorRef &&
      'serviceWorker' in navigatorRef &&
      target.PushManager &&
      target.Notification
  )
}

export function getNotificationPermission(
  target: WebPushGlobal = globalThis
): NotificationPermission | 'unsupported' {
  return target.Notification?.permission ?? 'unsupported'
}

export function getWebPushReadiness(
  target: WebPushGlobal = globalThis,
  permissionOverride?: NotificationPermission | 'unsupported'
): WebPushReadiness {
  const supported = isWebPushSupported(target)
  const ios = isIos(target.navigator)
  const standalone = isStandalonePwa(target)
  const permission = permissionOverride ?? getNotificationPermission(target)

  if (ios && !standalone) {
    return { code: 'ios-not-standalone', isSupported: false, isIos: true, isStandalone: false, permission }
  }
  if (!supported) {
    return { code: 'unsupported', isSupported: false, isIos: ios, isStandalone: standalone, permission }
  }
  if (permission === 'denied') {
    return { code: 'permission-denied', isSupported: false, isIos: ios, isStandalone: standalone, permission }
  }

  return { code: 'supported', isSupported: true, isIos: ios, isStandalone: standalone, permission }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = globalThis.atob(base64)
  const output = new Uint8Array(new ArrayBuffer(rawData.length))

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }

  return output
}

export async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  const registration = await registerWorkspaceServiceWorker()
  if (registration) return registration
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  if (!navigator.serviceWorker.controller) return null
  return navigator.serviceWorker.ready
}

export async function getExistingPushSubscription(
  registration?: ServiceWorkerRegistration | null
): Promise<PushSubscription | null> {
  const readyRegistration = registration ?? await getReadyServiceWorkerRegistration()
  if (!readyRegistration) return null
  return readyRegistration.pushManager.getSubscription()
}

export function serializePushSubscription(subscription: PushSubscription): WebPushSubscribeInput {
  const json = subscription.toJSON() as {
    endpoint?: string
    expirationTime?: number | null
    keys?: { p256dh?: string; auth?: string }
  }
  const endpoint = subscription.endpoint || json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    throw new Error('PUSH_SUBSCRIPTION_INCOMPLETE')
  }

  return {
    endpoint,
    expirationTime: json.expirationTime ?? subscription.expirationTime ?? null,
    keys: { p256dh, auth },
  }
}

export async function enableCurrentBrowserPush(
  publicKey: string,
  saveSubscription: (input: WebPushSubscribeInput) => Promise<WebPushSubscribeResponse>,
  options: EnableWebPushOptions = {}
): Promise<WebPushSubscribeResponse> {
  const requestPermission = options.requestPermission ?? (() => Notification.requestPermission())
  const permission = await requestPermission()
  if (permission !== 'granted') {
    throw new Error('PUSH_PERMISSION_DENIED')
  }

  const registration = await (options.getRegistration ?? getReadyServiceWorkerRegistration)()
  if (!registration) {
    throw new Error('SERVICE_WORKER_UNAVAILABLE')
  }

  const existingSubscription = await registration.pushManager.getSubscription()
  const subscription = existingSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  try {
    return await saveSubscription(serializePushSubscription(subscription))
  } catch (error) {
    await subscription.unsubscribe().catch(() => undefined)
    throw error
  }
}

export async function disableCurrentBrowserPush(
  disableEndpoint: (endpoint: string) => Promise<unknown>,
  options: DisableWebPushOptions = {}
): Promise<{ endpoint: string | null; disabled: boolean }> {
  const subscription = await (options.getSubscription ?? getExistingPushSubscription)()
  if (!subscription) return { endpoint: null, disabled: false }

  const endpoint = subscription.endpoint
  await disableEndpoint(endpoint)
  await subscription.unsubscribe()
  return { endpoint, disabled: true }
}
