import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { billingRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

const authState = vi.hoisted(() => ({
  authenticated: true,
  organizationId: 'org_1' as string | null,
  role: 'ADMIN',
  orgRole: 'org:admin' as string | null,
}))

const serviceMocks = vi.hoisted(() => ({
  listPaymentTemplates: vi.fn(),
  createPaymentTemplate: vi.fn(),
  updatePaymentTemplate: vi.fn(),
  archivePaymentTemplate: vi.fn(),
  PaymentTemplateError: class PaymentTemplateError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status: 404 | 409
    ) {
      super(message)
    }
  },
}))

vi.mock('../../../middleware/auth', () => ({
  authMiddleware: async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    if (!authState.authenticated) return c.json({ message: 'Authentication required' }, 401)
    c.set('user', {
      id: 'clerk_user_1',
      staffId: 'staff_1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: authState.role,
      organizationId: authState.organizationId,
      clerkOrgId: authState.organizationId ? 'clerk_org_1' : null,
      orgRole: authState.orgRole,
    })
    await next()
  },
  requireOrg: async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    if (!c.get('user')?.organizationId)
      return c.json({ message: 'Please select an organization' }, 403)
    await next()
  },
  requireOrgAdmin: async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const user = c.get('user')
    if (!(user.orgRole === 'org:admin' || user.role === 'ADMIN')) {
      return c.json({ message: 'Admin access required' }, 403)
    }
    await next()
  },
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  strictRateLimit: async (_c: Context, next: Next) => next(),
}))

vi.mock('../../../services/stripe', () => ({
  CheckoutQuoteError: class CheckoutQuoteError extends Error {},
  createCheckoutSession: vi.fn(),
}))

vi.mock('../../../services/stripe/custom-checkout', () => ({
  createCustomCheckoutSession: vi.fn(),
}))
vi.mock('../../../services/payments/quote-send-service', () => ({ createSendableQuote: vi.fn() }))
vi.mock('../../../services/payments/custom-quote-send-service', () => ({
  createSendableCustomQuote: vi.fn(),
}))
vi.mock('../../../services/payments/payment-template-service', () => serviceMocks)

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.route('/billing', billingRoute)
  return app
}

const body = JSON.stringify({
  name: 'Monthly bookkeeping',
  template: {
    billingInterval: 'month',
    items: [{ label: 'Bookkeeping', unitAmountCents: 50000, quantity: 1 }],
  },
})

const templateRequests = [
  { method: 'GET', path: '/billing/payment-templates', body: null },
  { method: 'POST', path: '/billing/payment-templates', body },
  { method: 'PATCH', path: '/billing/payment-templates/tpl_1', body },
  { method: 'DELETE', path: '/billing/payment-templates/tpl_1', body: null },
]

describe('payment template route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.authenticated = true
    authState.organizationId = 'org_1'
    authState.role = 'ADMIN'
    authState.orgRole = 'org:admin'
  })

  it.each(templateRequests)('rejects unauthenticated $method $path', async (request) => {
    authState.authenticated = false

    const res = await send(request)

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: 'Authentication required' })
    expectNoServiceCalls()
  })

  it.each(templateRequests)('rejects no-org $method $path', async (request) => {
    authState.organizationId = null

    const res = await send(request)

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Please select an organization' })
    expectNoServiceCalls()
  })

  it.each(templateRequests)('rejects non-admin $method $path', async (request) => {
    authState.role = 'STAFF'
    authState.orgRole = 'org:member'

    const res = await send(request)

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Admin access required' })
    expectNoServiceCalls()
  })
})

function send(request: (typeof templateRequests)[number]) {
  return buildApp().request(request.path, {
    method: request.method,
    ...(request.body
      ? { headers: { 'content-type': 'application/json' }, body: request.body }
      : {}),
  })
}

function expectNoServiceCalls() {
  expect(serviceMocks.listPaymentTemplates).not.toHaveBeenCalled()
  expect(serviceMocks.createPaymentTemplate).not.toHaveBeenCalled()
  expect(serviceMocks.updatePaymentTemplate).not.toHaveBeenCalled()
  expect(serviceMocks.archivePaymentTemplate).not.toHaveBeenCalled()
}
