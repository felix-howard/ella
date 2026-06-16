/**
 * Lead update route tests.
 *
 * Pins phone correction behavior for PATCH /leads/:id without exposing raw
 * phone values in activity metadata.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  authUserMock,
  leadFindFirstMock,
  leadUpdateMock,
  logStaffActivityMock,
  getChangedFieldNamesMock,
} = vi.hoisted(() => ({
  authUserMock: {
    id: 'clerk-1',
    staffId: 'staff_1',
    organizationId: 'org_1',
    role: 'ORG_ADMIN',
    orgRole: 'org:admin',
    email: 'tester@example.com',
    name: 'Tester',
    clerkOrgId: 'clerk_org_1',
  },
  leadFindFirstMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  logStaffActivityMock: vi.fn(),
  getChangedFieldNamesMock: vi.fn((input: Record<string, unknown>) => Object.keys(input)),
}))

vi.mock('../../../lib/db', () => ({
  prisma: {
    lead: {
      findFirst: leadFindFirstMock,
      update: leadUpdateMock,
    },
  },
}))

vi.mock('../../../services/sms', () => ({
  formatPhoneToE164: (phone: string) => {
    let cleaned = phone.replace(/[^\d+]/g, '')
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('1') && cleaned.length === 11) {
        cleaned = cleaned.substring(1)
      }
      if (cleaned.length === 10) {
        cleaned = `+1${cleaned}`
      }
    }
    return cleaned
  },
  isValidPhoneNumber: (phone: string) => /^\+[1-9]\d{9,14}$/.test(phone),
  sendSmsOnly: vi.fn(),
  isTwilioConfigured: vi.fn(),
  sendWelcomeMessage: vi.fn(),
}))

vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn(),
}))

vi.mock('../../../lib/validation', () => ({
  sanitizeSearchInput: (s: string) => s,
  sanitizeTextInput: (s: string) => s.trim(),
}))

vi.mock('../../../lib/phone-privacy', () => ({
  canViewFullPhone: (user: { orgRole?: string | null; role?: string | null }) =>
    user.orgRole === 'org:admin' || user.role === 'ADMIN',
  serializePhone: (_user: unknown, phone: string | null) => phone,
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/leads/:id',
    method: 'PATCH',
  })),
  getChangedFieldNames: getChangedFieldNamesMock,
  logStaffActivity: logStaffActivityMock,
  logSystemActivity: vi.fn(),
}))

vi.mock('../../../middleware/auth', () => {
  const authMiddleware = async (c: any, next: () => Promise<void>) => {
    c.set('user', authUserMock)
    await next()
  }
  const requireAdminOrManager = async (_c: any, next: () => Promise<void>) => next()
  return { authMiddleware, requireOrgAdmin: requireAdminOrManager, requireAdminOrManager }
})

import { Hono } from 'hono'
import { leadsRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

const LEAD_ID = 'cmnldqbqa0005gf6cuecae3x1'

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.route('/leads', leadsRoute)
  return app
}

function buildLead(overrides: Record<string, unknown> = {}) {
  return {
    id: LEAD_ID,
    firstName: 'Jane',
    lastName: 'Nguyen',
    phone: '+15551234567',
    email: 'jane@example.com',
    businessName: null,
    notes: null,
    tags: [],
    status: 'NEW',
    organizationId: 'org_1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

beforeEach(() => {
  Object.assign(authUserMock, {
    role: 'ORG_ADMIN',
    orgRole: 'org:admin',
  })
  leadFindFirstMock.mockReset()
  leadUpdateMock.mockReset()
  logStaffActivityMock.mockReset()
  getChangedFieldNamesMock.mockClear()
})

describe('PATCH /leads/:id', () => {
  it('normalizes and saves phone updates', async () => {
    const updatedLead = buildLead({ phone: '+15557654321' })
    leadFindFirstMock.mockResolvedValueOnce(buildLead())
    leadUpdateMock.mockResolvedValueOnce(updatedLead)

    const res = await buildApp().request(`/leads/${LEAD_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '(555) 765-4321' }),
    })

    expect(res.status).toBe(200)
    expect(leadFindFirstMock).toHaveBeenCalledWith({
      where: { id: LEAD_ID, organizationId: 'org_1' },
    })
    expect(leadUpdateMock).toHaveBeenCalledWith({
      where: { id: LEAD_ID },
      data: { phone: '+15557654321' },
    })
    expect(logStaffActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { changedFields: ['phone'] },
      })
    )

    const body = await res.json()
    expect(body.data.phone).toBe('+15557654321')
  })

  it('rejects manager phone updates even though managers can edit other lead fields', async () => {
    Object.assign(authUserMock, { role: 'MANAGER', orgRole: 'org:member' })
    leadFindFirstMock.mockResolvedValueOnce(buildLead())

    const res = await buildApp().request(`/leads/${LEAD_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '(555) 765-4321' }),
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: 'Admin access required to update lead phone',
    })
    expect(leadUpdateMock).not.toHaveBeenCalled()
    expect(logStaffActivityMock).not.toHaveBeenCalled()
  })

  it('returns 409 when phone already exists in the organization', async () => {
    leadFindFirstMock.mockResolvedValueOnce(buildLead())
    leadUpdateMock.mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002' }))

    const res = await buildApp().request(`/leads/${LEAD_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '(555) 765-4321' }),
    })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: 'A lead with this phone already exists',
    })
    expect(logStaffActivityMock).not.toHaveBeenCalled()
  })

  it('returns 404 before update when lead is outside the organization', async () => {
    leadFindFirstMock.mockResolvedValueOnce(null)

    const res = await buildApp().request(`/leads/${LEAD_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '(555) 765-4321' }),
    })

    expect(res.status).toBe(404)
    expect(leadUpdateMock).not.toHaveBeenCalled()
  })

  it('rejects separator-only phone input before update', async () => {
    const res = await buildApp().request(`/leads/${LEAD_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '----------' }),
    })

    expect(res.status).toBe(400)
    expect(leadFindFirstMock).not.toHaveBeenCalled()
    expect(leadUpdateMock).not.toHaveBeenCalled()
  })

  it('rejects phone input that cannot normalize to E.164', async () => {
    leadFindFirstMock.mockResolvedValueOnce(buildLead())

    const res = await buildApp().request(`/leads/${LEAD_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '55555555555' }),
    })

    expect(res.status).toBe(400)
    expect(leadUpdateMock).not.toHaveBeenCalled()
  })
})
