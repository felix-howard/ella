import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: {
      findUnique: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
  },
}))

const { twilioConfig } = vi.hoisted(() => ({
  twilioConfig: { phoneNumber: '+15550001111' },
}))

vi.mock('../../../lib/config', () => ({
  config: {
    twilio: twilioConfig,
  },
}))

import { prisma } from '../../../lib/db'
import { ndaReadinessRoute } from '../nda-readiness'

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk-user-1',
      staffId: 'staff-1',
      organizationId: 'org-1',
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'ADMIN',
      clerkOrgId: 'clerk-org-1',
      orgRole: 'org:admin',
    })
    await next()
  })
  app.route('/staff/me/nda-readiness', ndaReadinessRoute)
  return app
}

const readyStaff = {
  signaturePngKey: 'staff-signatures/staff-1/signature.png',
  title: 'Managing Partner, CPA',
}

const readyOrg = {
  address: '305 North Richmond Avenue',
  city: 'Atlantic City',
  state: 'NJ',
  zip: '08401',
  governingState: 'Texas',
  governingCounty: 'Harris County',
  firmPhone: null,
  firmEmail: 'oneteam@alphamedia.ai',
}

describe('GET /staff/me/nda-readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    twilioConfig.phoneNumber = '+15550001111'
    vi.mocked(prisma.staff.findUnique).mockResolvedValue(readyStaff as never)
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(readyOrg as never)
  })

  it('accepts the configured Twilio inbound number as firm contact phone', async () => {
    const res = await createApp().request('/staff/me/nda-readiness?type=ENGAGEMENT_LETTER')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ready: true,
      missing: [],
    })
  })

  it('still requires a firm contact phone when neither Twilio nor firmPhone is set', async () => {
    twilioConfig.phoneNumber = ''

    const res = await createApp().request('/staff/me/nda-readiness?type=ENGAGEMENT_LETTER')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ready: false,
      missing: ['orgContact'],
    })
  })
})
