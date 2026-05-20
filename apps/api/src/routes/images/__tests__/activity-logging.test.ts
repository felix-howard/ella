import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { ActivityRiskLevel } from '@ella/db'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    rawImage: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    documentView: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  deleteFile: vi.fn(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '203.0.113.10',
    userAgent: 'Vitest',
    route: '/images/img_1',
    method: 'DELETE',
  })),
  logStaffActivity: vi.fn(),
  logStaffActivities: vi.fn(),
}))

vi.mock('../../../lib/inngest', () => ({
  inngest: {
    send: vi.fn(),
  },
}))

vi.mock('../../../services/sms', () => ({
  isSmsEnabled: vi.fn(() => false),
  sendBlurryResendRequest: vi.fn(),
}))

vi.mock('../../../services/activity-tracker', () => ({
  updateLastActivity: vi.fn(),
}))

vi.mock('../../../services/identity-doc-retention', () => ({
  refreshIdentityRetentionForImage: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { deleteFile } from '../../../services/storage'
import { logStaffActivity } from '../../../services/activity-log'
import { imagesRoute } from '../index'

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_user_1',
      organizationId: 'org_1',
      staffId: 'staff_1',
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'STAFF',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:member',
    })
    await next()
  })
  app.route('/images', imagesRoute)
  return app
}

function mockImage() {
  return {
    id: 'img_1',
    caseId: 'case_1',
    r2Key: 'cases/case_1/docs/private.pdf',
    mimeType: 'application/pdf',
    status: 'CLASSIFIED',
    classifiedType: 'W2',
    category: 'INCOME',
    taxCase: {
      client: {
        id: 'client_1',
        organizationId: 'org_1',
      },
    },
  }
}

describe('images activity logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.rawImage.findFirst).mockResolvedValue(mockImage() as never)
  })

  it('logs canonical activity fields when deleting a document', async () => {
    vi.mocked(deleteFile).mockResolvedValue(true as never)
    vi.mocked(prisma.rawImage.delete).mockResolvedValue(mockImage() as never)

    const res = await createApp().request('/images/img_1', { method: 'DELETE' })

    expect(res.status).toBe(200)
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
        caseId: 'case_1',
        rawImageId: 'img_1',
        actorStaffId: 'staff_1',
        action: 'document.deleted',
        category: 'DOCUMENT',
        targetType: 'RAW_IMAGE',
        targetId: 'img_1',
        riskLevel: ActivityRiskLevel.HIGH,
      })
    )
  })

  it('logs canonical activity fields when marking a document viewed', async () => {
    vi.mocked(prisma.documentView.createMany).mockResolvedValue({ count: 1 } as never)

    const res = await createApp().request('/images/img_1/mark-viewed', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
        caseId: 'case_1',
        rawImageId: 'img_1',
        actorStaffId: 'staff_1',
        action: 'document.marked_viewed',
        category: 'DOCUMENT',
        targetType: 'RAW_IMAGE',
        targetId: 'img_1',
        riskLevel: ActivityRiskLevel.LOW,
      })
    )
  })

  it('does not log activity when the document view already exists', async () => {
    vi.mocked(prisma.documentView.createMany).mockResolvedValue({ count: 0 } as never)

    const res = await createApp().request('/images/img_1/mark-viewed', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(logStaffActivity).not.toHaveBeenCalled()
  })
})
