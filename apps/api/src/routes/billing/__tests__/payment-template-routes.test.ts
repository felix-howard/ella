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
    constructor(public readonly code: string, message: string, public readonly status: 404 | 409) {
      super(message)
      this.name = 'PaymentTemplateError'
    }
  },
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
  createCheckoutSession: vi.fn(),
}))

vi.mock('../../../services/stripe/custom-checkout', () => ({ createCustomCheckoutSession: vi.fn() }))
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

function buildTemplateBody() {
  return {
    name: 'Monthly bookkeeping',
    description: 'Standard package',
    template: {
      billingInterval: 'month',
      items: [{ label: 'Bookkeeping', unitAmountCents: 50000, quantity: 1 }],
      oneTimeItems: [{ label: 'Setup', unitAmountCents: 25000, quantity: 1 }],
      couponId: 'coupon_should_strip',
    },
    allowPromotionCodes: true,
  }
}

function postTemplate(body: ReturnType<typeof buildTemplateBody>) {
  return buildApp().request('/billing/payment-templates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('payment template billing routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.authenticated = true
    authState.organizationId = 'org_1'
    authState.role = 'ADMIN'
    authState.orgRole = 'org:admin'
  })

  it('lists templates for the current organization', async () => {
    serviceMocks.listPaymentTemplates.mockResolvedValue([{ id: 'template_1' }])

    const res = await buildApp().request('/billing/payment-templates')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ templates: [{ id: 'template_1' }] })
    expect(serviceMocks.listPaymentTemplates).toHaveBeenCalledWith('org_1')
  })

  it('creates a template with sanitized custom-link line items only', async () => {
    serviceMocks.createPaymentTemplate.mockResolvedValue({ id: 'template_1' })

    const res = await postTemplate(buildTemplateBody())

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ template: { id: 'template_1' } })
    expect(serviceMocks.createPaymentTemplate).toHaveBeenCalledWith(
      {
        name: 'Monthly bookkeeping',
        description: 'Standard package',
        template: {
          billingInterval: 'month',
          items: [{ label: 'Bookkeeping', unitAmountCents: 50000, quantity: 1 }],
          oneTimeItems: [{ label: 'Setup', unitAmountCents: 25000, quantity: 1 }],
        },
      },
      { organizationId: 'org_1', staffId: 'staff_1' },
    )
  })

  it('rejects one-time templates with one-time add-ons', async () => {
    const body = buildTemplateBody()
    body.template.billingInterval = 'one_time'

    const res = await postTemplate(body)

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'VALIDATION_ERROR' })
    expect(serviceMocks.createPaymentTemplate).not.toHaveBeenCalled()
  })

  it('maps duplicate names to a stable conflict response', async () => {
    serviceMocks.createPaymentTemplate.mockRejectedValue(
      new serviceMocks.PaymentTemplateError(
        'PAYMENT_TEMPLATE_DUPLICATE',
        'A payment template with this name already exists',
        409,
      ),
    )

    const res = await postTemplate(buildTemplateBody())

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'PAYMENT_TEMPLATE_DUPLICATE',
      message: 'A payment template with this name already exists',
    })
  })

  it('updates and archives templates through org-scoped service calls', async () => {
    serviceMocks.updatePaymentTemplate.mockResolvedValue({ id: 'template_1', name: 'Updated' })
    serviceMocks.archivePaymentTemplate.mockResolvedValue({ id: 'template_1' })

    const patchRes = await buildApp().request('/billing/payment-templates/template_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    const deleteRes = await buildApp().request('/billing/payment-templates/template_1', { method: 'DELETE' })

    expect(patchRes.status).toBe(200)
    expect(deleteRes.status).toBe(200)
    expect(serviceMocks.updatePaymentTemplate).toHaveBeenCalledWith(
      'template_1',
      { name: 'Updated' },
      { organizationId: 'org_1', staffId: 'staff_1' },
    )
    expect(serviceMocks.archivePaymentTemplate).toHaveBeenCalledWith('template_1', {
      organizationId: 'org_1',
      staffId: 'staff_1',
    })
  })
})
