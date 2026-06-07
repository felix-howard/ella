/**
 * Tests for the staff-facing client payment endpoints: payments list for the
 * profile tab (ADMIN/MANAGER only, org-scoped) and the rate-limited
 * "Resend payment link" action.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { __resetRateLimitMapForTests } from '../../../middleware/rate-limiter'
import type { AuthVariables } from '../../../middleware/auth'

const prismaMocks = vi.hoisted(() => ({
  client: {
    findFirst: vi.fn(),
  },
  payment: {
    findMany: vi.fn(),
  },
}))

const serviceMocks = vi.hoisted(() => ({
  buildPaymentPayUrl: vi.fn((token: string) => `http://portal.test/pay/${token}`),
  resendDepositPayLink: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../services/payments/deposit-payment-service', () => serviceMocks)

import { clientsPaymentsStaffRoute } from '../payments-staff'

const CLIENT_ID = 'cabcdefghij1234567890aaaa'

// Unique agreement IDs per test — resend uses the real in-memory rate limiter.
let agreementCounter = 10
function freshAgreementId() {
  // cuid shape: 'c' + 24 lowercase alphanumerics
  return `cagreement${String(++agreementCounter).padStart(15, '0')}`
}

function buildApp(role: 'ADMIN' | 'MANAGER' | 'STAFF' = 'ADMIN') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_1',
      staffId: 'staff_1',
      email: 'staff@test.com',
      name: 'Staff User',
      role,
      organizationId: 'org_1',
      clerkOrgId: 'org_clerk_1',
      orgRole: role === 'ADMIN' ? 'org:admin' : 'org:member',
    })
    await next()
  })
  app.route('/clients', clientsPaymentsStaffRoute)
  return app
}

afterEach(() => {
  __resetRateLimitMapForTests()
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaMocks.client.findFirst.mockResolvedValue({ id: CLIENT_ID })
  prismaMocks.payment.findMany.mockResolvedValue([])
  serviceMocks.resendDepositPayLink.mockResolvedValue({
    payUrl: 'http://portal.test/pay/tok_abc',
  })
  serviceMocks.buildPaymentPayUrl.mockImplementation(
    (token: string) => `http://portal.test/pay/${token}`,
  )
})

describe('GET /clients/:clientId/payments', () => {
  it('rejects STAFF role with 403', async () => {
    const res = await buildApp('STAFF').request(`/clients/${CLIENT_ID}/payments`)

    expect(res.status).toBe(403)
    expect(prismaMocks.payment.findMany).not.toHaveBeenCalled()
  })

  it.each(['ADMIN', 'MANAGER'] as const)('allows %s role', async (role) => {
    const res = await buildApp(role).request(`/clients/${CLIENT_ID}/payments`)

    expect(res.status).toBe(200)
  })

  it('returns 404 when the client is not in the caller org', async () => {
    prismaMocks.client.findFirst.mockResolvedValue(null)

    const res = await buildApp().request(`/clients/${CLIENT_ID}/payments`)

    expect(res.status).toBe(404)
    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith({
      where: { id: CLIENT_ID, organizationId: 'org_1' },
      select: { id: true },
    })
  })

  it('returns org-scoped payments with the portal pay URL', async () => {
    prismaMocks.payment.findMany.mockResolvedValue([
      {
        id: 'pay_1',
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: { toString: () => '300' },
        currency: 'usd',
        description: 'Retainer – 2026 Engagement Letter',
        paidAt: null,
        createdAt: new Date('2026-06-07T10:00:00Z'),
        payToken: 'tok_abc',
        agreement: { id: 'agr_1', title: '2026 Engagement Letter' },
      },
    ])

    const res = await buildApp().request(`/clients/${CLIENT_ID}/payments`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMocks.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: CLIENT_ID, organizationId: 'org_1' },
      }),
    )
    expect(json.data).toEqual([
      expect.objectContaining({
        id: 'pay_1',
        amount: '300',
        status: 'PENDING',
        payUrl: 'http://portal.test/pay/tok_abc',
        agreement: { id: 'agr_1', title: '2026 Engagement Letter' },
      }),
    ])
  })
})

describe('POST /clients/:clientId/agreements/:id/resend-payment-link', () => {
  it('rejects STAFF role with 403', async () => {
    const res = await buildApp('STAFF').request(
      `/clients/${CLIENT_ID}/agreements/${freshAgreementId()}/resend-payment-link`,
      { method: 'POST' },
    )

    expect(res.status).toBe(403)
    expect(serviceMocks.resendDepositPayLink).not.toHaveBeenCalled()
  })

  it('resends the pay link scoped to the caller org', async () => {
    const agreementId = freshAgreementId()
    const res = await buildApp().request(
      `/clients/${CLIENT_ID}/agreements/${agreementId}/resend-payment-link`,
      { method: 'POST' },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      data: { payUrl: 'http://portal.test/pay/tok_abc' },
    })
    expect(serviceMocks.resendDepositPayLink).toHaveBeenCalledWith({
      clientId: CLIENT_ID,
      agreementId,
      orgId: 'org_1',
    })
  })

  it('throttles immediate repeat resends with 429', async () => {
    const agreementId = freshAgreementId()
    const app = buildApp()

    const first = await app.request(
      `/clients/${CLIENT_ID}/agreements/${agreementId}/resend-payment-link`,
      { method: 'POST' },
    )
    const second = await app.request(
      `/clients/${CLIENT_ID}/agreements/${agreementId}/resend-payment-link`,
      { method: 'POST' },
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    expect(serviceMocks.resendDepositPayLink).toHaveBeenCalledTimes(1)
  })
})
