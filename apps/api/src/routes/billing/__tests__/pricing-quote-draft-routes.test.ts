import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultPricingInput } from '@ella/shared/pricing'
import { billingRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

const authState = vi.hoisted(() => ({
  authenticated: true,
  organizationId: 'org_1' as string | null,
  role: 'ADMIN',
  orgRole: 'org:admin' as string | null,
}))

const serviceMocks = vi.hoisted(() => ({
  listPricingQuoteDrafts: vi.fn(),
  getPricingQuoteDraft: vi.fn(),
  createPricingQuoteDraft: vi.fn(),
  updatePricingQuoteDraft: vi.fn(),
  deletePricingQuoteDraft: vi.fn(),
  consumePricingQuoteDraft: vi.fn(),
  PricingQuoteDraftError: class PricingQuoteDraftError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status: 404 | 409
    ) {
      super(message)
      this.name = 'PricingQuoteDraftError'
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
  pricingQuoteDraftWriteRateLimit: async (_c: Context, next: Next) => next(),
}))
vi.mock('../../../services/payments/pricing-quote-draft-service', () => serviceMocks)
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

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.route('/billing', billingRoute)
  return app
}

function request(path: string, method = 'GET', body?: unknown) {
  return buildApp().request(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('pricing quote draft billing routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.authenticated = true
    authState.organizationId = 'org_1'
    authState.role = 'ADMIN'
    authState.orgRole = 'org:admin'
  })

  it('lists and fetches drafts inside the authenticated organization', async () => {
    serviceMocks.listPricingQuoteDrafts.mockResolvedValue([{ id: 'draft_1' }])
    serviceMocks.getPricingQuoteDraft.mockResolvedValue({ id: 'draft_1' })

    const listRes = await request('/billing/quote-drafts')
    const getRes = await request('/billing/quote-drafts/draft_1')

    expect(await listRes.json()).toEqual({ drafts: [{ id: 'draft_1' }] })
    expect(await getRes.json()).toEqual({ draft: { id: 'draft_1' } })
    expect(serviceMocks.listPricingQuoteDrafts).toHaveBeenCalledWith('org_1')
    expect(serviceMocks.getPricingQuoteDraft).toHaveBeenCalledWith('draft_1', 'org_1')
  })

  it('creates, updates, and deletes drafts with stable response wrappers', async () => {
    serviceMocks.createPricingQuoteDraft.mockResolvedValue({ id: 'draft_1' })
    serviceMocks.updatePricingQuoteDraft.mockResolvedValue({ id: 'draft_1', name: 'Renamed' })
    serviceMocks.deletePricingQuoteDraft.mockResolvedValue({ id: 'draft_1', deleted: true })
    const pricingInput = createDefaultPricingInput()
    const expectedUpdatedAt = '2026-09-08T11:00:00.000Z'

    const createRes = await request('/billing/quote-drafts', 'POST', {
      name: 'Draft',
      pricingInput,
    })
    const updateRes = await request('/billing/quote-drafts/draft_1', 'PATCH', {
      name: 'Renamed',
      expectedUpdatedAt,
    })
    const deleteRes = await request('/billing/quote-drafts/draft_1', 'DELETE')

    expect(createRes.status).toBe(201)
    expect(await createRes.json()).toEqual({ draft: { id: 'draft_1' } })
    expect(await updateRes.json()).toEqual({ draft: { id: 'draft_1', name: 'Renamed' } })
    expect(await deleteRes.json()).toEqual({ id: 'draft_1', deleted: true })
    expect(serviceMocks.createPricingQuoteDraft).toHaveBeenCalledWith(
      { name: 'Draft', pricingInput },
      'org_1'
    )
    expect(serviceMocks.updatePricingQuoteDraft).toHaveBeenCalledWith(
      'draft_1',
      { name: 'Renamed', expectedUpdatedAt },
      'org_1'
    )
    expect(serviceMocks.deletePricingQuoteDraft).toHaveBeenCalledWith(
      'draft_1',
      'org_1',
      undefined
    )

    serviceMocks.deletePricingQuoteDraft.mockResolvedValue({ id: 'draft_1', deleted: true })
    const guardedDelete = await buildApp().request(
      '/billing/quote-drafts/draft_1?expectedUpdatedAt=2026-09-08T10%3A00%3A00.000Z',
      { method: 'DELETE' }
    )
    expect(guardedDelete.status).toBe(200)
    expect(serviceMocks.deletePricingQuoteDraft).toHaveBeenLastCalledWith(
      'draft_1',
      'org_1',
      '2026-09-08T10:00:00.000Z'
    )
  })

  it('returns stable validation and conflict errors', async () => {
    const invalidRes = await request('/billing/quote-drafts', 'POST', {
      name: '',
      pricingInput: createDefaultPricingInput(),
    })
    serviceMocks.updatePricingQuoteDraft.mockRejectedValue(
      new serviceMocks.PricingQuoteDraftError(
        'PRICING_QUOTE_DRAFT_CONFLICT',
        'Pricing quote draft was updated by another session',
        409
      )
    )
    const conflictRes = await request('/billing/quote-drafts/draft_1', 'PATCH', {
      name: 'Renamed',
      expectedUpdatedAt: '2026-09-08T11:00:00.000Z',
    })

    expect(invalidRes.status).toBe(400)
    expect(await invalidRes.json()).toMatchObject({ error: 'VALIDATION_ERROR' })
    expect(conflictRes.status).toBe(409)
    expect(await conflictRes.json()).toEqual({
      error: 'PRICING_QUOTE_DRAFT_CONFLICT',
      message: 'Pricing quote draft was updated by another session',
    })
  })

  const protectedRequests = [
    ['/billing/quote-drafts', 'GET'],
    ['/billing/quote-drafts', 'POST'],
    ['/billing/quote-drafts/draft_1', 'GET'],
    ['/billing/quote-drafts/draft_1', 'PATCH'],
    ['/billing/quote-drafts/draft_1', 'DELETE'],
  ] as const

  it.each([
    ['unauthenticated', false, 'org_1', 'ADMIN', 'org:admin', 401],
    ['missing organization', true, null, 'ADMIN', 'org:admin', 403],
    ['non-admin', true, 'org_1', 'STAFF', 'org:member', 403],
  ])(
    'protects every draft route from %s access',
    async (_label, authenticated, organizationId, role, orgRole, status) => {
      authState.authenticated = authenticated
      authState.organizationId = organizationId
      authState.role = role
      authState.orgRole = orgRole

      for (const [path, method] of protectedRequests) {
        const res = await request(path, method)
        expect(res.status).toBe(status)
      }

      expect(serviceMocks.listPricingQuoteDrafts).not.toHaveBeenCalled()
      expect(serviceMocks.getPricingQuoteDraft).not.toHaveBeenCalled()
      expect(serviceMocks.createPricingQuoteDraft).not.toHaveBeenCalled()
      expect(serviceMocks.updatePricingQuoteDraft).not.toHaveBeenCalled()
      expect(serviceMocks.deletePricingQuoteDraft).not.toHaveBeenCalled()
    }
  )
})
