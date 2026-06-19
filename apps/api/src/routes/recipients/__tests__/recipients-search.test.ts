import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recipientsRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

const prismaMocks = vi.hoisted(() => ({
  client: {
    findMany: vi.fn(),
  },
  lead: {
    findMany: vi.fn(),
  },
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))

vi.mock('../../../lib/validation', () => ({
  sanitizeSearchInput: (input: string) => input.trim(),
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  standardRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../middleware/auth', () => {
  const authMiddleware = async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    c.set('user', {
      id: 'clerk_1',
      staffId: 'staff_1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      organizationId: 'org_1',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:admin',
    })
    await next()
  }
  const passThrough = async (_c: Context, next: Next) => next()
  return {
    authMiddleware,
    requireOrg: passThrough,
    requireAdminOrManager: passThrough,
  }
})

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.route('/recipients', recipientsRoute)
  return app
}

describe('GET /recipients/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.client.findMany.mockResolvedValue([
      {
        id: 'client_1',
        firstName: 'Tuyet',
        lastName: 'Nguyen',
        phone: '+18136442540',
        profile: { businessName: null },
      },
    ])
    prismaMocks.lead.findMany.mockResolvedValue([])
  })

  it('filters client recipient results to individual clients', async () => {
    const res = await buildApp().request('/recipients/search?q=ame')

    expect(res.status).toBe(200)
    expect(prismaMocks.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org_1',
          clientType: 'INDIVIDUAL',
        }),
      }),
    )
  })

  it('returns sanitized individual client results with phone last4 only', async () => {
    const res = await buildApp().request('/recipients/search?q=tuyet')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      clients: [
        {
          id: 'client_1',
          type: 'client',
          firstName: 'Tuyet',
          lastName: 'Nguyen',
          businessName: null,
          phoneLast4: '2540',
        },
      ],
      leads: [],
    })
  })
})
