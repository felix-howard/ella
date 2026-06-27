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

vi.mock('../../../lib/config', () => ({ config: mocks.config }))
vi.mock('../../../lib/db', () => ({ prisma: mocks.prisma }))
vi.mock('web-push', () => ({
  setVapidDetails: mocks.setVapidDetails,
  sendNotification: mocks.sendNotification,
}))

import { prisma } from '../../../lib/db'
import { buildClientMessagePushPayload, sendWebPushToStaff } from '../index'

describe('web push delivery security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.webPushSubscription.updateMany).mockResolvedValue({ count: 1 } as never)
  })

  it('disables persisted non-provider endpoints before any network send', async () => {
    vi.mocked(prisma.webPushSubscription.findMany).mockResolvedValue([
      {
        id: 'sub_bad',
        staffId: 'staff_1',
        organizationId: 'org_1',
        endpoint: 'https://169.254.169.254/latest/meta-data',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      },
    ] as never)

    const result = await sendWebPushToStaff({
      organizationId: 'org_1',
      staffIds: ['staff_1'],
      payload: buildClientMessagePushPayload('case_1'),
    })

    expect(result).toMatchObject({ attempted: 1, sent: 0, failed: 1, disabled: 1 })
    expect(mocks.sendNotification).not.toHaveBeenCalled()
    expect(prisma.webPushSubscription.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'sub_bad', enabled: true }),
      data: expect.objectContaining({ enabled: false }),
    })
  })
})
