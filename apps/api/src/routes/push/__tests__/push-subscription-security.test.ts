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
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../../../services/web-push', () => ({
  buildTestPushPayload: vi.fn(),
  sendWebPushToStaff: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { pushRoute } from '../index'

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_staff_1',
      staffId: 'staff_1',
      organizationId: 'org_1',
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'STAFF',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:member',
    })
    await next()
  })
  app.route('/push', pushRoute)
  return app
}

describe('push subscription security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.webPushSubscription.findMany).mockResolvedValue([])
    vi.mocked(prisma.webPushSubscription.updateMany).mockResolvedValue({ count: 0 } as never)
  })

  it('rejects attempts to claim another staff member subscription endpoint', async () => {
    vi.mocked(prisma.webPushSubscription.findUnique).mockResolvedValueOnce({
      id: 'sub_other',
      staffId: 'staff_2',
      organizationId: 'org_1',
    } as never)

    const res = await createApp().request('/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      }),
    })

    expect(res.status).toBe(409)
    expect(prisma.webPushSubscription.create).not.toHaveBeenCalled()
    expect(prisma.webPushSubscription.update).not.toHaveBeenCalled()
  })

  it('recovers duplicate same-owner subscribe races as an idempotent update', async () => {
    vi.mocked(prisma.webPushSubscription.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub_1', staffId: 'staff_1', organizationId: 'org_1' } as never)
    vi.mocked(prisma.webPushSubscription.create).mockRejectedValueOnce({ code: 'P2002' } as never)
    vi.mocked(prisma.webPushSubscription.update).mockResolvedValueOnce({
      id: 'sub_1',
      deviceLabel: 'Browser device',
      userAgent: null,
      createdAt: new Date('2026-06-27T09:00:00.000Z'),
      lastSeenAt: new Date('2026-06-27T09:30:00.000Z'),
      lastSentAt: null,
    } as never)

    const res = await createApp().request('/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      }),
    })

    expect(res.status).toBe(201)
    expect(prisma.webPushSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub_1' } })
    )
  })
})
