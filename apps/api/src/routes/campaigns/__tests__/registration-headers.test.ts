import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const { campaignCreateMock, campaignFindFirstMock, campaignUpdateMock } = vi.hoisted(() => ({
  campaignCreateMock: vi.fn(),
  campaignFindFirstMock: vi.fn(),
  campaignUpdateMock: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({
  prisma: {
    campaign: {
      create: campaignCreateMock,
      findFirst: campaignFindFirstMock,
      update: campaignUpdateMock,
    },
  },
}))

vi.mock('../../../middleware/auth', () => ({
  authMiddleware: async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', {
      id: 'user_1',
      organizationId: 'org_1',
      staffId: 'staff_1',
      role: 'ADMIN',
      orgRole: 'org:admin',
    })
    await next()
  },
  requireAdminOrManager: async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../services/storage', () => ({
  getSignedDownloadUrl: vi.fn(),
  uploadFile: vi.fn(),
}))

import { campaignsRoute } from '../index'

function createApp() {
  const app = new Hono()
  app.route('/campaigns', campaignsRoute)
  return app
}

describe('campaign registration headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    campaignCreateMock.mockResolvedValue({
      id: 'camp_1',
      name: 'Facebook',
      formHeaderMode: 'CUSTOM',
      formTitle: 'Campaign Title',
      formSubtitle: 'Campaign Subtitle',
      createdBy: { name: 'Admin' },
    })
    campaignFindFirstMock.mockResolvedValue({ id: 'camp_1', organizationId: 'org_1' })
    campaignUpdateMock.mockResolvedValue({
      id: 'camp_1',
      formHeaderMode: 'HIDDEN',
      formTitle: null,
      formSubtitle: null,
    })
  })

  it('persists sanitized header fields on campaign create', async () => {
    const res = await createApp().request('/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Facebook',
        slug: 'facebook',
        tag: 'fb',
        formHeaderMode: 'CUSTOM',
        formTitle: '<b>Campaign Title</b>',
        formSubtitle: '<i>Campaign Subtitle</i>',
      }),
    })

    expect(res.status).toBe(201)
    expect(campaignCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        formHeaderMode: 'CUSTOM',
        formTitle: 'Campaign Title',
        formSubtitle: 'Campaign Subtitle',
      }),
    }))
  })

  it('rejects invalid header mode on campaign create', async () => {
    const res = await createApp().request('/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Facebook',
        slug: 'facebook',
        tag: 'fb',
        formHeaderMode: 'VISIBLE',
      }),
    })

    expect(res.status).toBe(400)
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('clears campaign header copy on create when mode is not custom', async () => {
    const res = await createApp().request('/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Facebook',
        slug: 'facebook',
        tag: 'fb',
        formHeaderMode: 'HIDDEN',
        formTitle: 'Should not be stored',
        formSubtitle: 'Should not be stored',
      }),
    })

    expect(res.status).toBe(201)
    expect(campaignCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        formHeaderMode: 'HIDDEN',
        formTitle: null,
        formSubtitle: null,
      }),
    }))
  })

  it('clears campaign header copy on update when mode is not custom', async () => {
    const res = await createApp().request('/campaigns/cjld2cjxh0000qzrmn831i7rn', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formHeaderMode: 'HIDDEN',
      }),
    })

    expect(res.status).toBe(200)
    expect(campaignUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        formHeaderMode: 'HIDDEN',
        formTitle: null,
        formSubtitle: null,
      },
    }))
  })

  it('rejects invalid header mode on campaign update', async () => {
    const res = await createApp().request('/campaigns/cjld2cjxh0000qzrmn831i7rn', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formHeaderMode: 'VISIBLE' }),
    })

    expect(res.status).toBe(400)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })
})
