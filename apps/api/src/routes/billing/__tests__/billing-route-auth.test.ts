import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    if (user.orgRole !== 'org:admin' && user.role !== 'ADMIN') {
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
})
