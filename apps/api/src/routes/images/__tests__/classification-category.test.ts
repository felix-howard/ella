import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: (() => {
    const prisma = {
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      rawImage: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      checklistItem: {
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      digitalDoc: {
        upsert: vi.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    )
    return prisma
  })(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '203.0.113.10',
    userAgent: 'Vitest',
    route: '/images/img_1',
    method: 'PATCH',
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

vi.mock('../../../services/storage', () => ({
  deleteFile: vi.fn(),
}))

vi.mock('../../../services/activity-tracker', () => ({
  updateLastActivity: vi.fn(),
}))

vi.mock('../../../services/identity-doc-retention', () => ({
  refreshIdentityRetentionForImage: vi.fn(),
}))

import { prisma } from '../../../lib/db'
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

function rawImageFixture() {
  return {
    id: 'img_1',
    caseId: 'case_1',
    mimeType: 'application/pdf',
    status: 'UPLOADED',
    classifiedType: null,
    category: null,
    checklistItemId: null,
    taxCase: {
      client: {
        id: 'client_1',
        organizationId: 'org_1',
      },
    },
  }
}

describe('image classification and category routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores the derived bank/card category when Workspace manually classifies an image', async () => {
    vi.mocked(prisma.rawImage.findFirst).mockResolvedValue(rawImageFixture() as never)
    vi.mocked(prisma.rawImage.findUnique).mockResolvedValue({ checklistItemId: null } as never)
    vi.mocked(prisma.checklistItem.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.rawImage.update).mockResolvedValue({
      ...rawImageFixture(),
      classifiedType: 'CREDIT_CARD_STATEMENT',
      category: 'BANK_CARD_STATEMENTS',
      status: 'LINKED',
      aiConfidence: 1,
    } as never)
    vi.mocked(prisma.digitalDoc.upsert).mockResolvedValue({ id: 'doc_1' } as never)

    const res = await createApp().request('/images/img_1/classification', {
      method: 'PATCH',
      body: JSON.stringify({ docType: 'CREDIT_CARD_STATEMENT', action: 'approve' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(prisma.$queryRaw).toHaveBeenCalled()
    expect(prisma.rawImage.update).toHaveBeenCalledWith({
      where: { id: 'img_1' },
      data: expect.objectContaining({
        classifiedType: 'CREDIT_CARD_STATEMENT',
        category: 'BANK_CARD_STATEMENTS',
        status: 'LINKED',
        aiConfidence: 1,
      }),
    })
  })

  it('moves checklist linkage when Workspace manually reclassifies an image', async () => {
    vi.mocked(prisma.rawImage.findFirst).mockResolvedValue({
      ...rawImageFixture(),
      checklistItemId: 'old_item',
    } as never)
    vi.mocked(prisma.rawImage.findUnique).mockResolvedValue({ checklistItemId: 'old_item' } as never)
    vi.mocked(prisma.checklistItem.findMany).mockResolvedValue([
      {
        id: 'new_item',
        _count: { rawImages: 0 },
      },
    ] as never)
    vi.mocked(prisma.rawImage.update).mockResolvedValue({
      ...rawImageFixture(),
      classifiedType: 'CREDIT_CARD_STATEMENT',
      category: 'BANK_CARD_STATEMENTS',
      status: 'LINKED',
      checklistItemId: 'new_item',
      aiConfidence: 1,
    } as never)
    vi.mocked(prisma.digitalDoc.upsert).mockResolvedValue({ id: 'doc_1' } as never)

    const res = await createApp().request('/images/img_1/classification', {
      method: 'PATCH',
      body: JSON.stringify({ docType: 'CREDIT_CARD_STATEMENT', action: 'approve' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(prisma.checklistItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'old_item',
        receivedCount: { gt: 0 },
      },
      data: { receivedCount: { decrement: 1 } },
    })
    expect(prisma.checklistItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'old_item',
        receivedCount: { lte: 0 },
      },
      data: { status: 'MISSING' },
    })
    expect(prisma.checklistItem.update).toHaveBeenCalledWith({
      where: { id: 'new_item' },
      data: {
        status: 'HAS_RAW',
        receivedCount: { increment: 1 },
      },
    })
    expect(prisma.rawImage.update).toHaveBeenCalledWith({
      where: { id: 'img_1' },
      data: expect.objectContaining({
        checklistItemId: 'new_item',
        category: 'BANK_CARD_STATEMENTS',
      }),
    })
  })

  it('accepts moving one image into Bank/Card Statements', async () => {
    vi.mocked(prisma.rawImage.findFirst).mockResolvedValue({
      ...rawImageFixture(),
      category: 'INCOME',
    } as never)
    vi.mocked(prisma.rawImage.update).mockResolvedValue({
      id: 'img_1',
      category: 'BANK_CARD_STATEMENTS',
    } as never)

    const res = await createApp().request('/images/img_1/category', {
      method: 'PATCH',
      body: JSON.stringify({ category: 'BANK_CARD_STATEMENTS' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(prisma.rawImage.update).toHaveBeenCalledWith({
      where: { id: 'img_1' },
      data: { category: 'BANK_CARD_STATEMENTS' },
      select: { id: true, category: true },
    })
  })

  it('accepts batch moving images into Bank/Card Statements', async () => {
    vi.mocked(prisma.rawImage.findMany).mockResolvedValue([
      { ...rawImageFixture(), id: 'img_1', category: 'INCOME' },
      { ...rawImageFixture(), id: 'img_2', category: 'OTHER' },
    ] as never)
    vi.mocked(prisma.rawImage.updateMany).mockResolvedValue({ count: 2 } as never)

    const res = await createApp().request('/images/batch-category', {
      method: 'PATCH',
      body: JSON.stringify({
        imageIds: ['img_1', 'img_2'],
        category: 'BANK_CARD_STATEMENTS',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(prisma.rawImage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['img_1', 'img_2'] } },
      data: { category: 'BANK_CARD_STATEMENTS' },
    })
  })
})
