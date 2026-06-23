import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultPricingInput } from '@ella/shared/pricing'
import { billingRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

const authState = vi.hoisted(() => ({
  authenticated: true,
  organizationId: null as string | null,
  role: 'ADMIN',
  orgRole: 'org:admin' as string | null,
}))

const checkoutMocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  createCustomCheckoutSession: vi.fn(),
  createSendableQuote: vi.fn(),
  createSendableCustomQuote: vi.fn(),
}))

vi.mock('../../../middleware/auth', () => ({
  authMiddleware: async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    if (!authState.authenticated) {
      return c.json({ message: 'Authentication required' }, 401)
    }
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
    if (!c.get('user')?.organizationId) {
      return c.json({ message: 'Please select an organization' }, 403)
    }
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
  createCheckoutSession: checkoutMocks.createCheckoutSession,
}))

vi.mock('../../../services/stripe/custom-checkout', () => ({
  createCustomCheckoutSession: checkoutMocks.createCustomCheckoutSession,
}))
vi.mock('../../../services/payments/quote-send-service', () => ({
  createSendableQuote: checkoutMocks.createSendableQuote,
}))
vi.mock('../../../services/payments/custom-quote-send-service', () => ({
  createSendableCustomQuote: checkoutMocks.createSendableCustomQuote,
}))

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.route('/billing', billingRoute)
  return app
}

describe('billing route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.authenticated = true
    authState.organizationId = null
    authState.role = 'ADMIN'
    authState.orgRole = 'org:admin'
  })

  it('rejects checkout session creation without an organization context', async () => {
    const res = await buildApp().request('/billing/checkout-sessions', { method: 'POST' })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Please select an organization' })
    expect(checkoutMocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('rejects checkout session creation without authentication', async () => {
    authState.authenticated = false

    const res = await buildApp().request('/billing/checkout-sessions', { method: 'POST' })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: 'Authentication required' })
    expect(checkoutMocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('rejects checkout session creation for non-admin staff', async () => {
    authState.organizationId = 'org_1'
    authState.role = 'STAFF'
    authState.orgRole = 'org:member'

    const res = await buildApp().request('/billing/checkout-sessions', { method: 'POST' })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Admin access required' })
    expect(checkoutMocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('rejects checkout session creation for managers', async () => {
    authState.organizationId = 'org_1'
    authState.role = 'MANAGER'
    authState.orgRole = 'org:member'

    const res = await buildApp().request('/billing/checkout-sessions', { method: 'POST' })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Admin access required' })
    expect(checkoutMocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('rejects calculator checkout sessions with business tax yearly pre-pay', async () => {
    authState.organizationId = 'org_1'
    const body = buildCalculatorCheckoutBody()
    body.pricingInput.oneTime.businessTaxReturn = 1

    const res = await postJson('/billing/checkout-sessions', body)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'INVALID_QUOTE',
      message: 'Business tax return yearly pre-pay must be created through Custom link',
    })
    expect(checkoutMocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('allows calculator checkout sessions without business tax yearly pre-pay', async () => {
    authState.organizationId = 'org_1'
    const body = buildCalculatorCheckoutBody()
    const result = {
      quoteId: 'quote_1',
      checkoutUrl: 'https://checkout.test/session',
      sessionId: 'cs_test_1',
    }
    checkoutMocks.createCheckoutSession.mockResolvedValue(result)

    const res = await postJson('/billing/checkout-sessions', body)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(result)
    expect(checkoutMocks.createCheckoutSession).toHaveBeenCalledWith(body, {
      organizationId: 'org_1',
      createdByStaffId: 'staff_1',
    })
  })

  it('rejects sendable calculator quotes with business tax yearly pre-pay', async () => {
    authState.organizationId = 'org_1'
    const body = {
      ...buildCalculatorCheckoutBody(),
      recipient: { type: 'client' as const, id: 'client_1' },
    }
    body.pricingInput.oneTime.businessTaxReturn = 1

    const res = await postJson('/billing/quotes/send', body)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'INVALID_QUOTE',
      message: 'Business tax return yearly pre-pay must be created through Custom link',
    })
    expect(checkoutMocks.createSendableQuote).not.toHaveBeenCalled()
  })

  it('allows sendable calculator quotes without business tax yearly pre-pay', async () => {
    authState.organizationId = 'org_1'
    const body = {
      ...buildCalculatorCheckoutBody(),
      recipient: { type: 'client' as const, id: 'client_1' },
    }
    const result = {
      quoteId: 'quote_2',
      payToken: 'tok_2',
      payUrl: 'http://portal.test/quote/tok_2',
      smsSent: true,
    }
    checkoutMocks.createSendableQuote.mockResolvedValue(result)

    const res = await postJson('/billing/quotes/send', body)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(result)
    expect(checkoutMocks.createSendableQuote).toHaveBeenCalledWith(body, {
      organizationId: 'org_1',
      staffId: 'staff_1',
    })
  })

  it('keeps custom yearly checkout links outside the calculator business-tax guard', async () => {
    authState.organizationId = 'org_1'
    const body = buildCustomYearlyBody()
    const result = {
      quoteId: 'custom_quote_1',
      checkoutUrl: 'https://checkout.test/custom',
      sessionId: 'cs_custom_1',
    }
    checkoutMocks.createCustomCheckoutSession.mockResolvedValue(result)

    const res = await postJson('/billing/checkout-sessions/custom', body)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(result)
    expect(checkoutMocks.createCustomCheckoutSession).toHaveBeenCalledWith(body, {
      organizationId: 'org_1',
      createdByStaffId: 'staff_1',
    })
  })

  it('keeps custom yearly send quotes outside the calculator business-tax guard', async () => {
    authState.organizationId = 'org_1'
    const body = {
      ...buildCustomYearlyBody(),
      recipient: { type: 'lead' as const, id: 'lead_1' },
    }
    const result = {
      quoteId: 'custom_quote_2',
      payToken: 'tok_custom_2',
      payUrl: 'http://portal.test/quote/tok_custom_2',
      smsSent: true,
    }
    checkoutMocks.createSendableCustomQuote.mockResolvedValue(result)

    const res = await postJson('/billing/quotes/send/custom', body)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(result)
    expect(checkoutMocks.createSendableCustomQuote).toHaveBeenCalledWith(body, {
      organizationId: 'org_1',
      staffId: 'staff_1',
    })
  })

  it('rejects payment template listing for non-admin staff', async () => {
    authState.organizationId = 'org_1'
    authState.role = 'STAFF'
    authState.orgRole = 'org:member'

    const res = await buildApp().request('/billing/payment-templates')

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Admin access required' })
  })

  it('rejects payment template listing without authentication', async () => {
    authState.authenticated = false

    const res = await buildApp().request('/billing/payment-templates')

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: 'Authentication required' })
  })

  it('rejects payment template listing without an organization context', async () => {
    const res = await buildApp().request('/billing/payment-templates')

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Please select an organization' })
  })
})

function buildCalculatorCheckoutBody() {
  return {
    pricingInput: createDefaultPricingInput(),
  }
}

function buildCustomYearlyBody() {
  return {
    billingInterval: 'year',
    items: [
      {
        label: 'Business tax return pre-pay (1 tax year)',
        unitAmountCents: 90_000,
        quantity: 1,
      },
    ],
  }
}

function postJson(path: string, body: unknown) {
  return buildApp().request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
