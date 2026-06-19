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
  clerkClient: {
    organizations: {
      updateOrganization: vi.fn(),
    },
  },
}))

vi.mock('../../../lib/config', () => ({
  config: {
    twilio: {
      phoneNumber: '+15550001111',
    },
  },
}))

vi.mock('../../../services/sms', () => ({
  formatPhoneToE164: vi.fn((phone: string) => {
    const digits = phone.replace(/\D/g, '')
    return digits.length === 10 ? `+1${digits}` : phone.replace(/[^\d+]/g, '')
  }),
  isValidPhoneNumber: vi.fn((phone: string) => /^\+[1-9]\d{9,14}$/.test(phone)),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/org-settings',
    method: 'PATCH',
  })),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) =>
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
  ),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { logStaffActivity } from '../../../services/activity-log'
import { orgSettingsRoute } from '../index'
import { formatPhoneToE164 } from '../../../services/sms'
import { Prisma } from '@ella/db'

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_user_1',
      organizationId: 'org_1',
      staffId: 'staff_1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:admin',
    })
    await next()
  })
  app.route('/org-settings', orgSettingsRoute)
  return app
}

describe('org settings activity logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      name: 'Firm',
      registrationHeaderMode: 'DEFAULT',
      registrationTitle: null,
      registrationSubtitle: null,
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
      firmPhone: '+18786780999',
      firmEmail: 'private@example.com',
      firmWebsite: null,
    } as never)
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.organization.update).mockResolvedValue({
      name: 'Firm',
      smsLanguage: 'EN',
      missedCallTextBack: true,
      autoSendFormClientUploadLink: false,
      defaultUploadLinkTemplateId: null,
      slug: 'firm',
      clerkOrgId: 'clerk_org_1',
      address: null,
      city: null,
      state: null,
      zip: null,
      governingState: null,
      governingCounty: null,
      firmPhone: null,
      firmEmail: 'private@example.com',
      firmWebsite: null,
    } as never)
  })

  it('returns configured Twilio inbound number instead of the stored firm phone', async () => {
    const res = await createApp().request('/org-settings')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({
      firmPhone: '+18786780999',
      twilioInboundNumber: '+15550001111',
    }))
  })

  it('logs changed field names without raw setting values', async () => {
    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Firm',
        firmEmail: 'private@example.com',
        smsLanguage: 'EN',
      }),
    })

    expect(res.status).toBe(200)
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        actorStaffId: 'staff_1',
        action: 'settings.organization_updated',
        metadata: {
          changedFields: ['name', 'smsLanguage', 'firmEmail'],
        },
      })
    )
    const metadata = vi.mocked(logStaffActivity).mock.calls[0][0].metadata as Record<string, unknown>
    expect(JSON.stringify(metadata)).not.toContain('private@example.com')
    expect(JSON.stringify(metadata)).not.toContain('Firm')
  })

  it('rejects duplicate active firm phone numbers', async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValueOnce({ id: 'org_2' } as never)

    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firmPhone: '+15550001111',
      }),
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'FIRM_PHONE_TAKEN' })
    expect(vi.mocked(prisma.organization.update)).not.toHaveBeenCalled()
  })

  it('normalizes firm phone before duplicate check and update', async () => {
    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firmPhone: '(555) 000-1111',
      }),
    })

    expect(res.status).toBe(200)
    expect(formatPhoneToE164).toHaveBeenCalledWith('(555) 000-1111')
    expect(prisma.organization.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ firmPhone: '+15550001111' }),
    }))
    expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ firmPhone: '+15550001111' }),
    }))
  })

  it('rejects invalid normalized firm phone numbers', async () => {
    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firmPhone: '555',
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'INVALID_FIRM_PHONE' })
    expect(prisma.organization.update).not.toHaveBeenCalled()
  })

  it('rejects firm phone changes that do not match the configured Twilio number', async () => {
    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firmPhone: '(555) 222-3333',
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'FIRM_PHONE_LOCKED_TO_TWILIO_NUMBER' })
    expect(prisma.organization.update).not.toHaveBeenCalled()
  })

  it('maps database firm phone unique conflicts to FIRM_PHONE_TAKEN', async () => {
    vi.mocked(prisma.organization.update).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['firmPhone'] },
      })
    )

    const res = await createApp().request('/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firmPhone: '+15550001111',
      }),
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'FIRM_PHONE_TAKEN' })
  })
})
