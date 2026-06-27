import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  config: {
    webPush: {
      isConfigured: true,
      vapidSubject: 'mailto:support@ellatax.com',
      vapidPublicKey: 'public-key',
      vapidPrivateKey: 'private-key',
    },
  },
  prisma: {
    webPushSubscription: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}))

vi.mock('../../../lib/config', () => ({
  config: mocks.config,
}))

vi.mock('../../../lib/db', () => ({
  prisma: mocks.prisma,
}))

vi.mock('web-push', () => ({
  setVapidDetails: mocks.setVapidDetails,
  sendNotification: mocks.sendNotification,
}))

import { prisma } from '../../../lib/db'
import { buildClientMessagePushPayload, sendWebPushToStaff } from '../index'

const deliverySubscription = {
  id: 'sub_1',
  staffId: 'staff_1',
  organizationId: 'org_1',
  endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-1',
  p256dh: 'p256dh-key',
  auth: 'auth-key',
}
const deliverySnapshotWhere = {
  id: 'sub_1',
  staffId: 'staff_1',
  organizationId: 'org_1',
  endpoint: deliverySubscription.endpoint,
  p256dh: deliverySubscription.p256dh,
  auth: deliverySubscription.auth,
  enabled: true,
}

describe('sendWebPushToStaff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.config.webPush.isConfigured = true
    mocks.config.webPush.vapidSubject = 'mailto:support@ellatax.com'
    mocks.config.webPush.vapidPublicKey = 'public-key'
    mocks.config.webPush.vapidPrivateKey = 'private-key'
    vi.mocked(prisma.webPushSubscription.findMany).mockResolvedValue([deliverySubscription] as never)
    vi.mocked(prisma.webPushSubscription.updateMany).mockResolvedValue({ count: 1 } as never)
    mocks.sendNotification.mockResolvedValue({ statusCode: 201, body: '', headers: {} })
  })

  it('skips without querying subscriptions when VAPID config is missing', async () => {
    mocks.config.webPush.isConfigured = false

    const result = await sendWebPushToStaff({
      organizationId: 'org_1',
      staffIds: ['staff_1'],
      payload: buildClientMessagePushPayload('case_1'),
    })

    expect(result).toEqual({
      configured: false,
      attempted: 0,
      sent: 0,
      failed: 0,
      disabled: 0,
      skippedReason: 'not_configured',
      failures: [],
    })
    expect(prisma.webPushSubscription.findMany).not.toHaveBeenCalled()
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('loads only enabled subscriptions for active staff in the target org', async () => {
    await sendWebPushToStaff({
      organizationId: 'org_1',
      staffIds: ['staff_1', 'staff_1'],
      payload: buildClientMessagePushPayload('case_1'),
    })

    expect(prisma.webPushSubscription.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org_1',
        staffId: { in: ['staff_1'] },
        enabled: true,
        staff: { isActive: true },
      },
      select: {
        id: true,
        staffId: true,
        organizationId: true,
        endpoint: true,
        p256dh: true,
        auth: true,
      },
      orderBy: { id: 'asc' },
      take: 500,
    })
  })

  it('sends only the safe payload with the configured TTL', async () => {
    mocks.config.webPush.vapidPublicKey = 'public-key-safe-payload'
    const payload = buildClientMessagePushPayload('case_1')
    const result = await sendWebPushToStaff({
      organizationId: 'org_1',
      staffIds: ['staff_1'],
      payload,
    })

    expect(result).toMatchObject({
      configured: true,
      attempted: 1,
      sent: 1,
      failed: 0,
      disabled: 0,
    })
    expect(mocks.setVapidDetails).toHaveBeenCalledWith(
      'mailto:support@ellatax.com',
      'public-key-safe-payload',
      'private-key'
    )
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: deliverySubscription.endpoint,
        keys: {
          p256dh: deliverySubscription.p256dh,
          auth: deliverySubscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 14400, timeout: 8000 }
    )
    expect(payload.body).toBe('New client message')
    expect(JSON.stringify(payload)).not.toContain('phone')
    expect(prisma.webPushSubscription.updateMany).toHaveBeenCalledWith({
      where: deliverySnapshotWhere,
      data: {
        lastSentAt: expect.any(Date),
        failureCount: 0,
        failedAt: null,
      },
    })
  })

  it('disables expired subscriptions after a 410 push response', async () => {
    mocks.sendNotification.mockRejectedValueOnce(Object.assign(new Error('Gone'), { statusCode: 410 }))

    const result = await sendWebPushToStaff({
      organizationId: 'org_1',
      staffIds: ['staff_1'],
      payload: buildClientMessagePushPayload('case_1'),
    })

    expect(result).toEqual({
      configured: true,
      attempted: 1,
      sent: 0,
      failed: 1,
      disabled: 1,
      failures: [{ subscriptionId: 'sub_1', statusCode: 410 }],
    })
    expect(prisma.webPushSubscription.updateMany).toHaveBeenCalledWith({
      where: deliverySnapshotWhere,
      data: {
        enabled: false,
        failureCount: { increment: 1 },
        failedAt: expect.any(Date),
      },
    })
  })

  it('does not throw when subscription bookkeeping fails after a send', async () => {
    vi.mocked(prisma.webPushSubscription.updateMany).mockRejectedValueOnce(new Error('db down') as never)

    const result = await sendWebPushToStaff({
      organizationId: 'org_1',
      staffIds: ['staff_1'],
      payload: buildClientMessagePushPayload('case_1'),
    })

    expect(result).toMatchObject({ attempted: 1, sent: 1, failed: 0 })
    expect(mocks.sendNotification).toHaveBeenCalled()
  })

  it('pages through every eligible subscription instead of truncating at 500', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      ...deliverySubscription,
      id: `sub_${String(index).padStart(3, '0')}`,
      endpoint: `https://fcm.googleapis.com/fcm/send/subscription-${index}`,
    }))
    const secondPage = [{
      ...deliverySubscription,
      id: 'sub_500',
      endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-500',
    }]
    vi.mocked(prisma.webPushSubscription.findMany)
      .mockResolvedValueOnce(firstPage as never)
      .mockResolvedValueOnce(secondPage as never)
      .mockResolvedValueOnce([] as never)

    const result = await sendWebPushToStaff({
      organizationId: 'org_1',
      staffIds: ['staff_1'],
      payload: buildClientMessagePushPayload('case_1'),
    })

    expect(result.attempted).toBe(501)
    expect(result.sent).toBe(501)
    expect(prisma.webPushSubscription.findMany).toHaveBeenCalledTimes(2)
    expect(prisma.webPushSubscription.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        cursor: { id: 'sub_499' },
        skip: 1,
        orderBy: { id: 'asc' },
      })
    )
  })
})
