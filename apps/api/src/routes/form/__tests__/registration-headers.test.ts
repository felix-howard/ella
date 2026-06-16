import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const { campaignFindUniqueMock, organizationFindFirstMock, staffFindFirstMock } = vi.hoisted(() => ({
  campaignFindUniqueMock: vi.fn(),
  organizationFindFirstMock: vi.fn(),
  staffFindFirstMock: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({
  prisma: {
    organization: { findFirst: organizationFindFirstMock },
    campaign: { findUnique: campaignFindUniqueMock },
    staff: { findFirst: staffFindFirstMock },
  },
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../services/engagement-helpers', () => ({
  findOrCreateEngagement: vi.fn(),
}))

vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn(),
}))

vi.mock('../../../services/sms', () => ({
  isSmsEnabled: vi.fn(),
  sendWelcomeMessage: vi.fn(),
}))

vi.mock('../../../services/crypto', () => ({
  encryptSSN: vi.fn(),
}))

import { formRoute } from '../index'

function createApp() {
  const app = new Hono()
  app.route('/form', formRoute)
  return app
}

describe('public form registration headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    organizationFindFirstMock.mockResolvedValue({
      id: 'org_1',
      name: 'Ella Tax',
      logoUrl: null,
      slug: 'ella-tax',
      registrationHeaderMode: 'CUSTOM',
      registrationTitle: 'Org Title',
      registrationSubtitle: 'Org Subtitle',
    })
    campaignFindUniqueMock.mockResolvedValue({
      id: 'camp_1',
      name: 'Facebook',
      status: 'ACTIVE',
      formHeaderMode: 'HIDDEN',
      formTitle: null,
      formSubtitle: null,
      formIntroContent: '<p>Intro</p>',
    })
    staffFindFirstMock.mockResolvedValue({ id: 'staff_1', name: 'Staff One' })
  })

  it('returns standard org header config from generic form info', async () => {
    const res = await createApp().request('/form/ella-tax')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      org: {
        id: 'org_1',
        name: 'Ella Tax',
        logoUrl: null,
        slug: 'ella-tax',
        registrationHeaderMode: 'DEFAULT',
        registrationTitle: null,
        registrationSubtitle: null,
      },
    })
  })

  it('returns safe campaign header config from campaign validation', async () => {
    const res = await createApp().request('/form/ella-tax/campaign/facebook')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      valid: true,
      campaignName: 'Facebook',
      org: {
        registrationHeaderMode: 'DEFAULT',
        registrationTitle: null,
        registrationSubtitle: null,
      },
      campaignHeader: {
        mode: 'HIDDEN',
        title: null,
        subtitle: null,
      },
      formIntroContent: '<p>Intro</p>',
    })
  })

  it('returns standard org header config from staff form info', async () => {
    const res = await createApp().request('/form/ella-tax/staff-a')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      org: {
        id: 'org_1',
        name: 'Ella Tax',
        logoUrl: null,
        slug: 'ella-tax',
        registrationHeaderMode: 'DEFAULT',
        registrationTitle: null,
        registrationSubtitle: null,
      },
      staff: { id: 'staff_1', name: 'Staff One' },
    })
  })

  it('does not expose stale org copy when org header mode is hidden', async () => {
    organizationFindFirstMock.mockResolvedValue({
      id: 'org_1',
      name: 'Ella Tax',
      logoUrl: null,
      slug: 'ella-tax',
      registrationHeaderMode: 'HIDDEN',
      registrationTitle: 'Stale Org Title',
      registrationSubtitle: 'Stale Org Subtitle',
    })

    const res = await createApp().request('/form/ella-tax')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      org: {
        id: 'org_1',
        name: 'Ella Tax',
        logoUrl: null,
        slug: 'ella-tax',
        registrationHeaderMode: 'DEFAULT',
        registrationTitle: null,
        registrationSubtitle: null,
      },
    })
  })

  it('does not expose stale campaign copy when campaign header mode is hidden', async () => {
    campaignFindUniqueMock.mockResolvedValue({
      id: 'camp_1',
      name: 'Facebook',
      status: 'ACTIVE',
      formHeaderMode: 'HIDDEN',
      formTitle: 'Stale Campaign Title',
      formSubtitle: 'Stale Campaign Subtitle',
      formIntroContent: '<p>Intro</p>',
    })

    const res = await createApp().request('/form/ella-tax/campaign/facebook')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      valid: true,
      campaignName: 'Facebook',
      org: {
        registrationHeaderMode: 'DEFAULT',
        registrationTitle: null,
        registrationSubtitle: null,
      },
      campaignHeader: {
        mode: 'HIDDEN',
        title: null,
        subtitle: null,
      },
      formIntroContent: '<p>Intro</p>',
    })
  })
})
