/**
 * Integration tests for GET /clients/:clientId/nda — read-only NDA listing
 * surfaced on the Client Overview tab. Covers happy path, org isolation,
 * and empty results.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    client: { findFirst: vi.fn() },
    agreement: { findMany: vi.fn() },
  },
}))

vi.mock('../../../middleware/auth', () => ({
  authMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  clerkMiddleware: async (_c: any, next: () => Promise<void>) => next(),
  requireOrgAdmin: async (_c: any, next: () => Promise<void>) => next(),
  requireAdminOrManager: async (_c: any, next: () => Promise<void>) => next(),
}))

vi.mock('../../../lib/org-scope', () => ({
  buildClientScopeFilter: vi.fn().mockReturnValue({ organizationId: 'org-1' }),
  canSeeAllClients: vi.fn().mockReturnValue(true),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import type { AuthVariables } from '../../../middleware/auth'
import { agreementResponseInclude } from '../../../services/agreements/agreement-response-serializer'
import { clientsAgreementsRoute } from '../agreements'

const mockClientFindFirst = vi.mocked(prisma.client.findFirst)
const mockNdaFindMany = vi.mocked(prisma.agreement.findMany)

function buildApp(user = { id: 'u1', staffId: 's1', organizationId: 'org-1', role: 'ORG_ADMIN' }) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user as any)
    await next()
  })
  app.route('/clients', clientsAgreementsRoute)
  return app
}

const VALID_CLIENT_ID = 'cabcdefghij1234567890aaaa'
const OTHER_CLIENT_ID = 'cabcdefghij1234567890bbbb'

function nda(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nda-1',
    leadId: 'lead-1',
    clientId: VALID_CLIENT_ID,
    organizationId: 'org-1',
    token: 'tok_aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    status: 'SENT',
    isActive: true,
    templateVersion: 'v1',
    depositAmount: '300.00',
    depositStatus: 'PAID',
    depositPaidAt: new Date('2026-04-20T00:00:00Z'),
    depositResolvedAt: null,
    depositNote: null,
    signedAt: new Date('2026-04-20T00:00:00Z'),
    signedPdfKey: 'nda/signed/lead-1/nda-1.pdf',
    expiresAt: new Date('2030-01-01T00:00:00Z'),
    createdAt: new Date('2026-04-19T00:00:00Z'),
    updatedAt: new Date('2026-04-20T00:00:00Z'),
    ...overrides,
  }
}

describe('GET /clients/:clientId/nda', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns NDAs filtered by clientId for the caller org', async () => {
    mockClientFindFirst.mockResolvedValueOnce({ id: VALID_CLIENT_ID, organizationId: 'org-1' } as any)
    mockNdaFindMany.mockResolvedValueOnce([
      nda({ id: 'n1', updatedAt: new Date('2026-04-22T00:00:00Z') }),
      nda({ id: 'n2', updatedAt: new Date('2026-04-21T00:00:00Z') }),
    ] as any)

    const app = buildApp()
    const res = await app.request(`/clients/${VALID_CLIENT_ID}/agreements`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(2)
    expect(json.data[0].id).toBe('n1')
    expect(json.data[0].url).toBeUndefined()
    expect(json.data[0].token).toBeUndefined()

    // Confirm org-scoped query parameters
    expect(mockNdaFindMany).toHaveBeenCalledWith({
      where: { clientId: VALID_CLIENT_ID, organizationId: 'org-1' },
      orderBy: { updatedAt: 'desc' },
      include: agreementResponseInclude,
    })
  })

  it('does not return a public url or token for draft agreements', async () => {
    mockClientFindFirst.mockResolvedValueOnce({ id: VALID_CLIENT_ID, organizationId: 'org-1' } as any)
    mockNdaFindMany.mockResolvedValueOnce([
      nda({ id: 'draft-active', status: 'DRAFT', isActive: true }),
      nda({ id: 'sent-inactive', status: 'SENT', isActive: false }),
      nda({ id: 'signed-active', status: 'SIGNED', isActive: true }),
    ] as any)

    const app = buildApp()
    const res = await app.request(`/clients/${VALID_CLIENT_ID}/agreements`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.map((item: { id: string }) => item.id)).toEqual([
      'draft-active',
      'sent-inactive',
      'signed-active',
    ])
    for (const item of json.data) {
      expect(item.url).toBeUndefined()
      expect(item.token).toBeUndefined()
    }
  })

  it('returns 404 when client is outside caller scope (org or assignment)', async () => {
    mockClientFindFirst.mockResolvedValueOnce(null)

    const app = buildApp()
    const res = await app.request(`/clients/${OTHER_CLIENT_ID}/agreements`)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('NOT_FOUND')
    // Confirms scope filter was applied to the lookup
    expect(mockClientFindFirst).toHaveBeenCalledWith({
      where: { id: OTHER_CLIENT_ID, organizationId: 'org-1' },
      select: { id: true, organizationId: true },
    })
    expect(mockNdaFindMany).not.toHaveBeenCalled()
  })

  it('returns empty array when client has no NDAs', async () => {
    mockClientFindFirst.mockResolvedValueOnce({ id: VALID_CLIENT_ID, organizationId: 'org-1' } as any)
    mockNdaFindMany.mockResolvedValueOnce([] as any)

    const app = buildApp()
    const res = await app.request(`/clients/${VALID_CLIENT_ID}/agreements`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })

  it('rejects malformed client ids at the param schema', async () => {
    const app = buildApp()
    const res = await app.request('/clients/not-a-cuid/agreements')
    expect(res.status).toBe(400)
    expect(mockClientFindFirst).not.toHaveBeenCalled()
  })
})
