import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/config', () => ({
  config: {
    webPush: { isConfigured: true, vapidPublicKey: 'public-key' },
    security: { trustProxyHeaders: false },
  },
}))

vi.mock('../../../lib/db', () => ({
  prisma: {
    webPushSubscription: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../../../services/web-push', () => ({
  buildTestPushPayload: vi.fn(() => ({
    title: 'Ella',
    body: 'Test notification',
    url: '/',
    tag: 'test-notification',
    timestamp: '2026-06-27T10:00:00.000Z',
  })),
  sendWebPushToStaff: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { sendWebPushToStaff } from '../../../services/web-push'
import { pushRoute } from '../index'

const subscriptionRow = {
  id: 'sub_1',
  deviceLabel: 'Work iPhone',
  userAgent: 'Mozilla/5.0 Test',
  createdAt: new Date('2026-06-27T09:00:00.000Z'),
  lastSeenAt: new Date('2026-06-27T09:30:00.000Z'),
  lastSentAt: null,
}

function createApp(userOverrides: Partial<AuthVariables['user']> = {}) {
  const app = new Hono<{ Variables: AuthVariables }>()
  const user = {
    id: 'clerk_staff_1',
    staffId: 'staff_1',
    organizationId: 'org_1',
    email: 'staff@example.com',
    name: 'Staff User',
    role: 'STAFF',
    clerkOrgId: 'clerk_org_1',
    orgRole: 'org:member',
    ...userOverrides,
  } satisfies AuthVariables['user']

  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/push', pushRoute)
  return app
}

describe('push subscription routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.webPushSubscription.findMany).mockResolvedValue([subscriptionRow] as never)
    vi.mocked(prisma.webPushSubscription.findFirst).mockResolvedValue(subscriptionRow as never)
    vi.mocked(prisma.webPushSubscription.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.webPushSubscription.create).mockResolvedValue(
      { ...subscriptionRow, deviceLabel: 'iOS Safari device', userAgent: 'iOS Safari' } as never
    )
    vi.mocked(prisma.webPushSubscription.update).mockResolvedValue(subscriptionRow as never)
    vi.mocked(prisma.webPushSubscription.updateMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(sendWebPushToStaff).mockResolvedValue(
      { configured: true, attempted: 1, sent: 1, failed: 0, disabled: 0, failures: [] }
    )
  })

  it('returns the VAPID public key without exposing the private key', async () => {
    const res = await createApp().request('/push/vapid-public-key')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ configured: true, publicKey: 'public-key' })
  })

  it('lists only enabled subscriptions for the current staff member', async () => {
    const res = await createApp().request('/push/subscriptions')

    expect(res.status).toBe(200)
    expect(prisma.webPushSubscription.findMany).toHaveBeenCalledWith({
      where: { staffId: 'staff_1', organizationId: 'org_1', enabled: true },
      select: {
        id: true,
        deviceLabel: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        lastSentAt: true,
      },
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    })

    const body = await res.json()
    expect(body.data[0]).toEqual(expect.objectContaining({ id: 'sub_1', deviceLabel: 'Work iPhone' }))
    expect(JSON.stringify(body)).not.toContain('p256dh')
    expect(JSON.stringify(body)).not.toContain('auth')
    expect(JSON.stringify(body)).not.toContain('https://push.example.test')
  })

  it('confirms whether the submitted browser endpoint is enabled for the current staff', async () => {
    const res = await createApp().request('/push/current', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1' }),
    })

    expect(res.status).toBe(200)
    expect(prisma.webPushSubscription.findFirst).toHaveBeenCalledWith({
      where: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
        staffId: 'staff_1',
        organizationId: 'org_1',
        enabled: true,
      },
      select: {
        id: true,
        deviceLabel: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        lastSentAt: true,
      },
    })
    await expect(res.json()).resolves.toEqual({
      current: true,
      data: expect.objectContaining({ id: 'sub_1', deviceLabel: 'Work iPhone' }),
    })
  })

  it('does not confirm endpoints owned by another staff member or disabled rows', async () => {
    vi.mocked(prisma.webPushSubscription.findFirst).mockResolvedValueOnce(null)

    const res = await createApp().request('/push/current', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ current: false, data: null })
  })

  it('upserts a browser subscription into the current staff scope', async () => {
    const res = await createApp().request('/push/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/604.1',
      },
      body: JSON.stringify({
        endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
        expirationTime: null,
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        deviceLabel: 'Work iPhone',
      }),
    })

    expect(res.status).toBe(201)
    expect(prisma.webPushSubscription.findUnique).toHaveBeenCalledWith({
      where: { endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1' },
      select: { id: true, staffId: true, organizationId: true },
    })
    expect(prisma.webPushSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          staffId: 'staff_1',
          organizationId: 'org_1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
          p256dh: 'p256dh-key',
          auth: 'auth-key',
          enabled: true,
          userAgent: 'iOS Safari',
          deviceLabel: 'iOS Safari device',
          failureCount: 0,
          failedAt: null,
        }),
      })
    )
    expect(await res.json()).toEqual({
      data: expect.objectContaining({ id: 'sub_1', deviceLabel: 'iOS Safari device' }),
    })
  })

  it('unsubscribes only the current staff subscription for the submitted endpoint', async () => {
    const res = await createApp().request('/push/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true, disabled: true })
    expect(prisma.webPushSubscription.updateMany).toHaveBeenCalledWith({
      where: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
        staffId: 'staff_1',
        organizationId: 'org_1',
      },
      data: {
        enabled: false,
        lastSeenAt: expect.any(Date),
      },
    })
  })

  it('returns a graceful service response when test push is not configured', async () => {
    vi.mocked(sendWebPushToStaff).mockResolvedValueOnce({
      configured: false, attempted: 0, sent: 0, failed: 0, disabled: 0,
      skippedReason: 'not_configured',
      failures: [],
    })

    const res = await createApp().request('/push/test', { method: 'POST' })

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({ success: false, result: { configured: false } })
    expect(sendWebPushToStaff).toHaveBeenCalledWith({
      organizationId: 'org_1',
      staffIds: ['staff_1'],
      payload: expect.objectContaining({
        title: 'Ella',
        body: 'Test notification',
        url: '/',
      }),
    })
  })
})
