import { describe, expect, it, vi } from 'vitest'
import {
  disableCurrentBrowserPush,
  enableCurrentBrowserPush,
  getWebPushReadiness,
  isIos,
  isWebPushSupported,
  urlBase64ToUint8Array,
} from './web-push'

function createTarget(overrides: Record<string, unknown> = {}) {
  return {
    isSecureContext: true,
    Notification: { permission: 'default' },
    PushManager: function PushManager() {},
    matchMedia: () => ({ matches: false }),
    navigator: {
      serviceWorker: {},
      userAgent: 'Mozilla/5.0',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    },
    ...overrides,
  } as unknown as typeof globalThis
}

describe('web push browser helpers', () => {
  it('converts URL-safe base64 VAPID keys to bytes', () => {
    expect(Array.from(urlBase64ToUint8Array('AQIDBA'))).toEqual([1, 2, 3, 4])
  })

  it('detects unsupported browsers when service workers are missing', () => {
    const target = createTarget({ navigator: { userAgent: 'Mozilla/5.0' } })

    expect(isWebPushSupported(target)).toBe(false)
    expect(getWebPushReadiness(target).code).toBe('unsupported')
  })

  it('requires iOS users to launch from an installed Home Screen app', () => {
    const target = createTarget({
      navigator: {
        serviceWorker: {},
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      },
    })

    expect(isIos(target.navigator)).toBe(true)
    expect(getWebPushReadiness(target).code).toBe('ios-not-standalone')
  })

  it('shows iOS install guidance before generic unsupported copy', () => {
    const target = createTarget({
      PushManager: undefined,
      navigator: {
        serviceWorker: {},
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      },
    })

    expect(isWebPushSupported(target)).toBe(false)
    expect(getWebPushReadiness(target).code).toBe('ios-not-standalone')
  })

  it('saves the browser subscription only after notification permission succeeds', async () => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
      expirationTime: null,
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
        expirationTime: null,
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      }),
      unsubscribe: vi.fn(),
    } as unknown as PushSubscription
    const subscribe = vi.fn().mockResolvedValue(subscription)
    const getSubscription = vi.fn().mockResolvedValue(null)
    const saveSubscription = vi.fn().mockResolvedValue({
      data: {
        id: 'sub_1',
        deviceLabel: 'Current browser',
        userAgent: null,
        createdAt: '2026-06-27T10:00:00.000Z',
        lastSeenAt: '2026-06-27T10:00:00.000Z',
        lastSentAt: null,
      },
    })

    await enableCurrentBrowserPush('AQIDBA', saveSubscription, {
      requestPermission: async () => 'granted',
      getRegistration: async () => ({
        pushManager: { getSubscription, subscribe },
      } as unknown as ServiceWorkerRegistration),
    })

    expect(getSubscription).toHaveBeenCalled()
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('AQIDBA'),
    })
    expect(saveSubscription).toHaveBeenCalledWith({
      endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
      expirationTime: null,
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    })
  })

  it('reuses an existing browser subscription when reconnecting the current browser', async () => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/existing-subscription',
      expirationTime: null,
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/existing-subscription',
        expirationTime: null,
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      }),
      unsubscribe: vi.fn(),
    } as unknown as PushSubscription
    const subscribe = vi.fn()
    const saveSubscription = vi.fn().mockResolvedValue({ data: { id: 'sub_1' } })

    await enableCurrentBrowserPush('AQIDBA', saveSubscription, {
      requestPermission: async () => 'granted',
      getRegistration: async () => ({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(subscription),
          subscribe,
        },
      } as unknown as ServiceWorkerRegistration),
    })

    expect(subscribe).not.toHaveBeenCalled()
    expect(saveSubscription).toHaveBeenCalledWith({
      endpoint: 'https://fcm.googleapis.com/fcm/send/existing-subscription',
      expirationTime: null,
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    })
  })

  it('does not create or save a subscription when permission is denied', async () => {
    const subscribe = vi.fn()
    const saveSubscription = vi.fn()

    await expect(
      enableCurrentBrowserPush('AQIDBA', saveSubscription, {
        requestPermission: async () => 'denied',
        getRegistration: async () => ({
          pushManager: { subscribe },
        } as unknown as ServiceWorkerRegistration),
      })
    ).rejects.toThrow('PUSH_PERMISSION_DENIED')

    expect(subscribe).not.toHaveBeenCalled()
    expect(saveSubscription).not.toHaveBeenCalled()
  })

  it('does not unsubscribe the browser when server disable fails', async () => {
    const calls: string[] = []
    const unsubscribe = vi.fn().mockImplementation(async () => {
      calls.push('browser')
      return true
    })
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
      unsubscribe,
    } as unknown as PushSubscription

    await expect(
      disableCurrentBrowserPush(
        async () => {
          calls.push('server')
          throw new Error('server failed')
        },
        { getSubscription: async () => subscription }
      )
    ).rejects.toThrow('server failed')

    expect(calls).toEqual(['server'])
    expect(unsubscribe).not.toHaveBeenCalled()
  })

  it('disables the server row before removing the browser subscription', async () => {
    const calls: string[] = []
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
      unsubscribe: vi.fn().mockImplementation(async () => {
        calls.push('browser')
        return true
      }),
    } as unknown as PushSubscription

    await disableCurrentBrowserPush(
      async () => {
        calls.push('server')
      },
      { getSubscription: async () => subscription }
    )

    expect(calls).toEqual(['server', 'browser'])
  })
})
