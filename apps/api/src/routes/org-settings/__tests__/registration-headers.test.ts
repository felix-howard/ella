import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../lib/clerk-client', () => ({
  clerkClient: { organizations: { updateOrganization: vi.fn() } },
}))

vi.mock('../../../services/sms', () => ({
  formatPhoneToE164: vi.fn((phone: string) => phone),
  isValidPhoneNumber: vi.fn(() => true),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({ route: '/org-settings', method: 'PATCH' })),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) => Object.keys(input)),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { logStaffActivity } from '../../../services/activity-log'
import { orgSettingsRoute } from '../index'

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'user_1',
      organizationId: 'org_1',
      staffId: 'staff_1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:admin',
    })
    await next()
  })
  app.route('/org-settings', orgSettingsRoute)
  return app
}

describe('org settings registration headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      name: 'Firm',
      registrationHeaderMode: 'CUSTOM',
      registrationTitle: 'Custom Title',
      registrationSubtitle: 'Subtitle',
      smsLanguage: 'EN',
      missedCallTextBack: true,
      autoSendFormClientUploadLink: false,
      defaultUploadLinkTemplateId: null,
      slug: 'firm',
      address: null,
      city: null,
      state: null,
      zip: null,
      governingState: null,
      governingCounty: null,
      firmPhone: null,
      firmEmail: null,
      firmWebsite: null,
    } as never)
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.organization.update).mockResolvedValue({
      name: 'Firm',
      registrationHeaderMode: 'CUSTOM',
      registrationTitle: 'Custom Title',
      registrationSubtitle: 'Subtitle',
      smsLanguage: 'EN',
      missedCallTextBack: true,
      autoSendFormClientUploadLink: false,
      defaultUploadLinkTemplateId: null,
      slug: 'firm',
      clerkOrgId: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      governingState: null,
      governingCounty: null,
      firmPhone: null,
      firmEmail: null,
      firmWebsite: null,
    } as never)
  })

  it('sanitizes and returns registration header settings without logging copy', async () => {
    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationHeaderMode: 'CUSTOM',
        registrationTitle: '<b>Custom Title</b>',
        registrationSubtitle: '<script>Subtitle</script>',
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({
      registrationHeaderMode: 'CUSTOM',
      registrationTitle: 'Custom Title',
      registrationSubtitle: 'Subtitle',
    }))
    expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        registrationHeaderMode: 'CUSTOM',
        registrationTitle: 'Custom Title',
        registrationSubtitle: 'Subtitle',
      }),
    }))

    const metadata = vi.mocked(logStaffActivity).mock.calls[0][0].metadata
    expect(metadata).toEqual({
      changedFields: ['registrationHeaderMode', 'registrationTitle', 'registrationSubtitle'],
    })
    expect(JSON.stringify(metadata)).not.toContain('Custom Title')
  })

  it('returns registration header settings from GET', async () => {
    const res = await createApp().request('/org-settings')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({
      registrationHeaderMode: 'CUSTOM',
      registrationTitle: 'Custom Title',
      registrationSubtitle: 'Subtitle',
    }))
  })

  it('rejects invalid registration header modes', async () => {
    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationHeaderMode: 'VISIBLE' }),
    })

    expect(res.status).toBe(400)
    expect(prisma.organization.update).not.toHaveBeenCalled()
  })

  it('clears stored custom copy when mode is not custom', async () => {
    vi.mocked(prisma.organization.update).mockResolvedValue({
      name: 'Firm',
      registrationHeaderMode: 'HIDDEN',
      registrationTitle: null,
      registrationSubtitle: null,
      smsLanguage: 'EN',
      missedCallTextBack: true,
      autoSendFormClientUploadLink: false,
      defaultUploadLinkTemplateId: null,
      slug: 'firm',
      clerkOrgId: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      governingState: null,
      governingCounty: null,
      firmPhone: null,
      firmEmail: null,
      firmWebsite: null,
    } as never)

    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationHeaderMode: 'HIDDEN',
        registrationTitle: 'Should not be stored',
        registrationSubtitle: 'Should not be stored',
      }),
    })

    expect(res.status).toBe(200)
    expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        registrationHeaderMode: 'HIDDEN',
        registrationTitle: null,
        registrationSubtitle: null,
      }),
    }))
  })
})
