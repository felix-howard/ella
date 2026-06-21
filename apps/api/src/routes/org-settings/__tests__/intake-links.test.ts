import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../../../lib/clerk-client', () => ({
  clerkClient: { organizations: { updateOrganization: vi.fn() } },
}))

vi.mock('../../../lib/config', () => ({
  config: { twilio: { phoneNumber: null } },
}))

vi.mock('../../../services/sms', () => ({
  formatPhoneToE164: vi.fn((phone: string) => phone),
  isValidPhoneNumber: vi.fn(() => true),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) => Object.keys(input)),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { orgSettingsRoute } from '../index'

function createApp(role: 'ADMIN' | 'MANAGER' | 'STAFF' = 'ADMIN') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: `user_${role.toLowerCase()}`,
      organizationId: 'org_1',
      staffId: `staff_${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@example.com`,
      name: `${role} User`,
      role,
      clerkOrgId: 'clerk_org_1',
      orgRole: role === 'ADMIN' ? 'org:admin' : 'org:member',
    })
    await next()
  })
  app.route('/org-settings', orgSettingsRoute)
  return app
}

describe('GET /org-settings/intake-links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all active staff intake link settings for admins', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org_1',
      name: 'Ella Tax',
      slug: 'ella-tax',
      autoSendFormClientUploadLink: true,
      defaultUploadLinkTemplateId: 'tax-documents',
      defaultUploadLinkLanguage: 'VI',
      staff: [
        {
          id: 'staff_1',
          name: 'An Manager',
          role: 'MANAGER',
          formSlug: 'an',
          useOrgUploadLinkDefaults: true,
          autoSendUploadLink: false,
          defaultUploadLinkTemplateId: 'official-channel',
          defaultUploadLinkLanguage: 'EN',
        },
        {
          id: 'staff_2',
          name: 'Binh Staff',
          role: 'STAFF',
          formSlug: 'binh',
          useOrgUploadLinkDefaults: false,
          autoSendUploadLink: false,
          defaultUploadLinkTemplateId: 'official-channel',
          defaultUploadLinkLanguage: 'EN',
        },
        {
          id: 'staff_3',
          name: 'Chi Staff',
          role: 'STAFF',
          formSlug: 'chi',
          useOrgUploadLinkDefaults: false,
          autoSendUploadLink: true,
          defaultUploadLinkTemplateId: null,
          defaultUploadLinkLanguage: 'EN',
        },
      ],
    } as never)

    const res = await createApp('ADMIN').request('/org-settings/intake-links')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      organization: {
        id: 'org_1',
        name: 'Ella Tax',
        slug: 'ella-tax',
        autoSendUploadLink: true,
        defaultUploadLinkTemplateId: 'tax-documents',
        defaultUploadLinkLanguage: 'VI',
      },
      generalLink: {
        urlPath: '/form/ella-tax',
        autoSendUploadLink: true,
        defaultUploadLinkTemplateId: 'tax-documents',
        defaultUploadLinkLanguage: 'VI',
      },
      staffLinks: [
        expect.objectContaining({
          id: 'staff_1',
          urlPath: '/form/ella-tax/an',
          effectiveAutoSendUploadLink: true,
          effectiveDefaultUploadLinkTemplateId: 'tax-documents',
          effectiveDefaultUploadLinkLanguage: 'VI',
        }),
        expect.objectContaining({
          id: 'staff_2',
          urlPath: '/form/ella-tax/binh',
          effectiveAutoSendUploadLink: false,
          effectiveDefaultUploadLinkTemplateId: 'official-channel',
          effectiveDefaultUploadLinkLanguage: 'EN',
        }),
        expect.objectContaining({
          id: 'staff_3',
          urlPath: '/form/ella-tax/chi',
          effectiveAutoSendUploadLink: true,
          effectiveDefaultUploadLinkTemplateId: null,
          effectiveDefaultUploadLinkLanguage: 'EN',
        }),
      ],
    })
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        staff: expect.objectContaining({
          where: { isActive: true },
        }),
      }),
    }))
    expect(body.staffLinks[0]).not.toHaveProperty('email')
    expect(body.staffLinks[1]).not.toHaveProperty('email')
  })

  it.each(['MANAGER', 'STAFF'] as const)('returns only self intake link settings for %s', async (role) => {
    const staffId = `staff_${role.toLowerCase()}`
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org_1',
      name: 'Ella Tax',
      slug: 'ella-tax',
      autoSendFormClientUploadLink: true,
      defaultUploadLinkTemplateId: 'tax-documents',
      defaultUploadLinkLanguage: 'VI',
      staff: [
        {
          id: staffId,
          name: `${role} User`,
          role,
          formSlug: `${role.toLowerCase()}-user`,
          useOrgUploadLinkDefaults: false,
          autoSendUploadLink: false,
          defaultUploadLinkTemplateId: 'official-channel',
          defaultUploadLinkLanguage: 'EN',
        },
      ],
    } as never)

    const res = await createApp(role).request('/org-settings/intake-links')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.staffLinks).toHaveLength(1)
    expect(body.staffLinks[0]).toEqual(expect.objectContaining({
      id: staffId,
      urlPath: `/form/ella-tax/${role.toLowerCase()}-user`,
      effectiveAutoSendUploadLink: false,
      effectiveDefaultUploadLinkTemplateId: 'official-channel',
      effectiveDefaultUploadLinkLanguage: 'EN',
    }))
    expect(body.generalLink).toEqual({
      urlPath: '/form/ella-tax',
      autoSendUploadLink: true,
      defaultUploadLinkTemplateId: 'tax-documents',
      defaultUploadLinkLanguage: 'VI',
    })
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        staff: expect.objectContaining({
          where: { isActive: true, id: staffId },
        }),
      }),
    }))
  })
})
