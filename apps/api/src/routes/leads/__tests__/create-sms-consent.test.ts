/**
 * Public lead creation SMS consent tests.
 *
 * Pins that public registration requires an explicit checkbox acceptance and
 * stores consent evidence with the Lead record.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { orgFindUniqueMock, leadCreateMock, leadUpdateMock, campaignFindUniqueMock } = vi.hoisted(
  () => ({
    orgFindUniqueMock: vi.fn(),
    leadCreateMock: vi.fn(),
    leadUpdateMock: vi.fn(),
    campaignFindUniqueMock: vi.fn(),
  })
)

vi.mock('../../../lib/db', () => ({
  prisma: {
    organization: {
      findUnique: orgFindUniqueMock,
    },
    campaign: {
      findUnique: campaignFindUniqueMock,
    },
    lead: {
      create: leadCreateMock,
      update: leadUpdateMock,
    },
  },
}))

vi.mock('../../../services/sms', () => ({
  formatPhoneToE164: (phone: string) => `+1${phone.replace(/\D/g, '')}`,
  sendSmsOnly: vi.fn(),
  isTwilioConfigured: vi.fn(),
  sendWelcomeMessage: vi.fn(),
}))

vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn(),
}))

vi.mock('../../../lib/validation', () => ({
  sanitizeSearchInput: (s: string) => s,
  sanitizeTextInput: (s: string) => s,
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/leads',
    method: 'POST',
  })),
  getChangedFieldNames: vi.fn(),
  logStaffActivity: vi.fn(),
  logSystemActivity: vi.fn(),
}))

vi.mock('../../../middleware/auth', () => ({
  authMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireOrgAdmin: async (_c: any, next: () => Promise<void>) => next(),
}))

import { Hono } from 'hono'
import { leadsRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.route('/leads', leadsRoute)
  return app
}

const validBody = {
  firstName: 'Jane',
  lastName: 'Nguyen',
  phone: '(555) 123-4567',
  email: 'jane@example.com',
  businessName: 'Jane Nails',
  smsConsentAccepted: true,
  orgSlug: 'ella-tax',
}

beforeEach(() => {
  orgFindUniqueMock.mockReset()
  orgFindUniqueMock.mockResolvedValue({ id: 'org_1', name: 'Ella Tax', isActive: true })
  campaignFindUniqueMock.mockReset()
  leadCreateMock.mockReset()
  leadCreateMock.mockResolvedValue({ id: 'lead_1' })
  leadUpdateMock.mockReset()
})

describe('POST /leads — SMS consent', () => {
  it('rejects public registration when SMS consent is missing', async () => {
    const { smsConsentAccepted: _smsConsentAccepted, ...bodyWithoutConsent } = validBody

    const res = await buildApp().request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyWithoutConsent),
    })

    expect(res.status).toBe(400)
    expect(leadCreateMock).not.toHaveBeenCalled()
  })

  it('stores SMS consent evidence on new public leads', async () => {
    const res = await buildApp().request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(200)
    expect(leadCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '+15551234567',
        smsConsentAccepted: true,
        smsConsentAcceptedAt: expect.any(Date),
        smsConsentText: expect.stringContaining('Ella Tax'),
      }),
    })
    const data = leadCreateMock.mock.calls[0][0].data
    expect(data.smsConsentText).toBe(
      'I agree to receive automated texts from Ella Tax about my tax consultation.'
    )
  })
})
