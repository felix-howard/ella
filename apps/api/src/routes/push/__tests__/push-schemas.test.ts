import { describe, expect, it } from 'vitest'
import { isAllowedWebPushEndpoint, pushSubscribeSchema } from '../schemas'

describe('push endpoint validation', () => {
  it('allows known browser web push providers over HTTPS', () => {
    expect(isAllowedWebPushEndpoint('https://fcm.googleapis.com/fcm/send/token')).toBe(true)
    expect(isAllowedWebPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/token')).toBe(true)
    expect(isAllowedWebPushEndpoint('https://web.push.apple.com/abc')).toBe(true)
    expect(isAllowedWebPushEndpoint('https://db5.notify.windows.com/w/?token=abc')).toBe(true)
  })

  it('rejects non-provider and non-HTTPS endpoints', () => {
    expect(isAllowedWebPushEndpoint('http://fcm.googleapis.com/fcm/send/token')).toBe(false)
    expect(isAllowedWebPushEndpoint('https://localhost/push')).toBe(false)
    expect(isAllowedWebPushEndpoint('https://169.254.169.254/latest/meta-data')).toBe(false)
    expect(isAllowedWebPushEndpoint('https://example.com/push')).toBe(false)
  })

  it('rejects unsupported endpoints during subscription parsing', () => {
    expect(() =>
      pushSubscribeSchema.parse({
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      })
    ).toThrow('Unsupported push endpoint')
  })
})
