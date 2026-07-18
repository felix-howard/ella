import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

const prismaMocks = vi.hoisted(() => ({
  client: { findFirst: vi.fn() },
}))
const serviceMocks = vi.hoisted(() => ({
  listClientPaidServices: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../services/payments/client-paid-services-service', () => serviceMocks)

import { clientsPaidServicesRoute } from '../paid-services'
import { clientsRoute } from '../index'

const CLIENT_ID = 'cabcdefghij1234567890aaaa'

function buildApp(role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CPA' = 'STAFF') {
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
  app.route('/clients', clientsPaidServicesRoute)
  return app
}

function buildClientsIndexApp() {
  const app = buildApp()
  app.route('/mounted-clients', clientsRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMocks.client.findFirst.mockResolvedValue({ id: CLIENT_ID, organizationId: 'org_1' })
  serviceMocks.listClientPaidServices.mockResolvedValue({
    data: [],
    meta: { isTruncated: false, limit: 100 },
  })
})

describe('GET /clients/:clientId/paid-services', () => {
  it.each(['STAFF', 'CPA'] as const)('allows assigned %s access without admin permission', async (role) => {
    const response = await buildApp(role).request(`/clients/${CLIENT_ID}/paid-services`)

    expect(response.status).toBe(200)
    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith({
      where: {
        id: CLIENT_ID,
        organizationId: 'org_1',
        managers: { some: { staffId: 'staff_1' } },
      },
      select: { id: true, organizationId: true },
    })
  })

  it.each(['ADMIN', 'MANAGER'] as const)('allows org-wide %s access', async (role) => {
    const response = await buildApp(role).request(`/clients/${CLIENT_ID}/paid-services`)

    expect(response.status).toBe(200)
    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith({
      where: { id: CLIENT_ID, organizationId: 'org_1' },
      select: { id: true, organizationId: true },
    })
  })

  it('returns a uniform 404 for inaccessible clients without loading payments', async () => {
    prismaMocks.client.findFirst.mockResolvedValue(null)

    const response = await buildApp().request(`/clients/${CLIENT_ID}/paid-services`)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'NOT_FOUND', message: 'Client not found' })
    expect(serviceMocks.listClientPaidServices).not.toHaveBeenCalled()
  })

  it('returns the fixed service response envelope', async () => {
    serviceMocks.listClientPaidServices.mockResolvedValue({
      data: [{
        id: 'quote_1',
        source: 'CUSTOM_LINK',
        paidAt: '2026-07-15T10:00:00.000Z',
        agreement: null,
        items: [
          {
            id: 'line-1',
            label: 'Advisory',
            description: null,
            category: 'RECURRING',
            cadence: 'MONTH',
            status: 'ACTIVE',
          },
        ],
      }],
      meta: { isTruncated: true, limit: 100 },
    })

    const response = await buildApp().request(`/clients/${CLIENT_ID}/paid-services`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: [expect.objectContaining({ id: 'quote_1', source: 'CUSTOM_LINK' })],
      meta: { isTruncated: true, limit: 100 },
    })
    expect(serviceMocks.listClientPaidServices).toHaveBeenCalledWith({
      clientId: CLIENT_ID,
      organizationId: 'org_1',
    })
  })

  it('rejects malformed client IDs before querying', async () => {
    const response = await buildApp().request('/clients/not-a-cuid/paid-services')
    expect(response.status).toBe(400)
    expect(prismaMocks.client.findFirst).not.toHaveBeenCalled()
  })

  it('is mounted through the production Clients route index', async () => {
    const response = await buildClientsIndexApp().request(
      `/mounted-clients/${CLIENT_ID}/paid-services`,
    )

    expect(response.status).toBe(200)
    expect(serviceMocks.listClientPaidServices).toHaveBeenCalledOnce()
  })
})
