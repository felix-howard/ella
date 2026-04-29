/**
 * Integration tests for the staff-facing NDA handlers, driven through
 * Hono's test utilities with the prisma + storage + SMS layers mocked.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    lead: { findFirst: vi.fn() },
    ndaAgreement: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  getSignedDownloadUrl: vi.fn(),
}))

vi.mock('../../../services/nda/nda-sms', () => ({
  sendNdaInviteSms: vi.fn().mockResolvedValue(undefined),
}))

// Bypass Clerk auth — inject a user directly
vi.mock('../../../middleware/auth', () => {
  const authMiddleware = async (c: any, next: () => Promise<void>) => {
    if (!c.get('user')) {
      c.set('user', {
        id: 'clerk-1',
        staffId: 'staff-1',
        organizationId: 'org-1',
        role: 'ORG_ADMIN',
      })
    }
    await next()
  }
  const requireOrgAdmin = async (_c: any, next: () => Promise<void>) => next()
  return { authMiddleware, requireOrgAdmin, clerkMiddleware: authMiddleware }
})

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { getSignedDownloadUrl } from '../../../services/storage'
import { sendNdaInviteSms } from '../../../services/nda/nda-sms'
import { staffRoute } from '../staff-handlers'

const mockLeadFindFirst = vi.mocked(prisma.lead.findFirst)
const mockNdaCreate = vi.mocked(prisma.ndaAgreement.create)
const mockNdaFindFirst = vi.mocked(prisma.ndaAgreement.findFirst)
const mockNdaFindMany = vi.mocked(prisma.ndaAgreement.findMany)
const mockNdaUpdate = vi.mocked(prisma.ndaAgreement.update)
const mockGetSignedUrl = vi.mocked(getSignedDownloadUrl)
const mockSendSms = vi.mocked(sendNdaInviteSms)

const app = new Hono()
app.route('/leads', staffRoute)

function lead(overrides: Record<string, unknown> = {}) {
  return { id: 'lead-1', firstName: 'Jane', phone: '+15551234567', ...overrides }
}

function nda(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nda-1',
    leadId: 'lead-1',
    organizationId: 'org-1',
    token: 'tok_28chars_aaaaaaaaaaaaaaaaaa',
    status: 'SENT',
    isActive: true,
    templateVersion: 'v1',
    depositAmount: '300.00',
    depositStatus: 'PENDING',
    depositPaidAt: null,
    depositNote: null,
    signedPdfKey: null,
    expiresAt: new Date('2030-01-01T00:00:00Z'),
    createdAt: new Date('2026-04-23T00:00:00Z'),
    ...overrides,
  }
}

describe('Staff NDA handlers', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('POST /leads/:leadId/nda', () => {
    async function createReq(body: unknown = {}) {
      return app.request('/leads/lead-1/nda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    it('creates NDA, sends SMS, returns 201 with url', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
      mockNdaCreate.mockResolvedValueOnce(nda() as any)

      const res = await createReq()
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(json.data.id).toBe('nda-1')
      expect(json.url).toMatch(/\/nda\/[A-Za-z0-9]{28}$/)
      expect(mockSendSms).toHaveBeenCalledTimes(1)
      // Legacy path: contentHtml absent → row stores customContentHtml: null
      const created = (mockNdaCreate.mock.calls[0][0] as any).data
      expect(created.customContentHtml).toBeNull()
    })

    it('persists sanitized contentHtml when provided', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
      mockNdaCreate.mockResolvedValueOnce(nda() as any)

      const res = await createReq({ contentHtml: '<p>Custom <strong>terms</strong></p>' })
      expect(res.status).toBe(201)
      const created = (mockNdaCreate.mock.calls[0][0] as any).data
      expect(created.customContentHtml).toBe('<p>Custom <strong>terms</strong></p>')
    })

    it('strips disallowed tags via sanitizer (script removed)', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
      mockNdaCreate.mockResolvedValueOnce(nda() as any)

      await createReq({ contentHtml: '<p>safe</p><script>alert(1)</script>' })
      const created = (mockNdaCreate.mock.calls[0][0] as any).data
      expect(created.customContentHtml).toBe('<p>safe</p>')
    })

    it('all-script payload collapses to null (legacy fallback)', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
      mockNdaCreate.mockResolvedValueOnce(nda() as any)

      await createReq({ contentHtml: '<script>alert(1)</script>' })
      const created = (mockNdaCreate.mock.calls[0][0] as any).data
      expect(created.customContentHtml).toBeNull()
    })

    it('rejects oversized payload with 400 (zod cap)', async () => {
      const big = 'a'.repeat(60_000)
      const res = await createReq({ contentHtml: big })
      expect(res.status).toBe(400)
      expect(mockNdaCreate).not.toHaveBeenCalled()
    })

    it('rejects extra body keys (strict schema)', async () => {
      const res = await createReq({ contentHtml: '<p>x</p>', extra: 'nope' })
      expect(res.status).toBe(400)
    })

    it('returns 404 when lead not found / not in caller org', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/bad-lead/nda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(res.status).toBe(404)
      expect(mockNdaCreate).not.toHaveBeenCalled()
    })
  })

  describe('GET /leads/:leadId/nda/default-html', () => {
    function leadWithOrg(overrides: Record<string, unknown> = {}) {
      return {
        id: 'lead-1',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+15551234567',
        organization: { name: 'Acme Tax LLC' },
        ...overrides,
      }
    }

    it('returns rendered HTML containing template-v1 headings', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      const res = await app.request('/leads/lead-1/nda/default-html')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(typeof json.data.contentHtml).toBe('string')
      expect(json.data.contentHtml).toMatch(/<h2>/)
      expect(json.data.contentHtml).toContain('Jane Doe')
      expect(json.data.contentHtml).toContain('Acme Tax LLC')
    })

    it('returns 404 when lead not in caller org', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/foreign/nda/default-html')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /leads/:leadId/nda/preview-pdf', () => {
    function leadWithOrg(overrides: Record<string, unknown> = {}) {
      return {
        id: 'lead-1',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+15551234567',
        organization: { name: 'Acme Tax LLC' },
        ...overrides,
      }
    }

    async function previewReq(body: unknown = {}) {
      return app.request('/leads/lead-1/nda/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    it('streams application/pdf bytes for legacy preview', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      const res = await previewReq()

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/pdf')
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      const buf = Buffer.from(await res.arrayBuffer())
      expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    }, 15_000)

    it('renders custom HTML when provided', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      const res = await previewReq({ contentHtml: '<p>Hello custom</p>' })
      expect(res.status).toBe(200)
      const buf = Buffer.from(await res.arrayBuffer())
      expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    }, 15_000)

    it('returns 400 for oversized payload', async () => {
      const big = 'a'.repeat(60_000)
      const res = await previewReq({ contentHtml: big })
      expect(res.status).toBe(400)
    })

    it('returns 404 for unknown lead', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(null)
      const res = await previewReq()
      expect(res.status).toBe(404)
    })
  })

  describe('GET /leads/:leadId/nda', () => {
    it('lists NDAs for the lead with computed url', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
      mockNdaFindMany.mockResolvedValueOnce([nda({ id: 'n1' }), nda({ id: 'n2' })] as any)

      const res = await app.request('/leads/lead-1/nda')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(2)
      expect(json.data[0].url).toContain('/nda/')
      // scoped by org
      const listCall = mockNdaFindMany.mock.calls[0][0] as any
      expect(listCall.where).toEqual({ leadId: 'lead-1', organizationId: 'org-1' })
    })

    it('returns 404 when lead belongs to another org (cross-org isolation)', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/foreign/nda')
      expect(res.status).toBe(404)
      // Prove the lookup was org-scoped, not a bare ID match
      const where = (mockLeadFindFirst.mock.calls[0][0] as any).where
      expect(where).toMatchObject({ id: 'foreign', organizationId: 'org-1' })
    })
  })

  describe('PATCH /leads/:leadId/nda/:id/deposit', () => {
    async function patchDeposit(body: unknown) {
      return app.request('/leads/lead-1/nda/nda-1/deposit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    it('accepts PENDING -> PAID with note + paidAt', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ depositStatus: 'PENDING' }) as any)
      mockNdaUpdate.mockResolvedValueOnce(nda({ depositStatus: 'PAID' }) as any)

      const res = await patchDeposit({
        depositStatus: 'PAID',
        depositNote: 'wire received',
        depositPaidAt: '2026-04-24T12:00:00Z',
      })
      expect(res.status).toBe(200)
      const data = (mockNdaUpdate.mock.calls[0][0] as any).data
      expect(data.depositStatus).toBe('PAID')
      expect(data.depositPaidAt).toEqual(new Date('2026-04-24T12:00:00Z'))
    })

    it('returns 409 for blocked transition (PAID -> FORFEITED)', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ depositStatus: 'PAID' }) as any)
      const res = await patchDeposit({ depositStatus: 'FORFEITED' })
      expect(res.status).toBe(409)
      expect(mockNdaUpdate).not.toHaveBeenCalled()
    })

    it('rejects invalid enum value with 400', async () => {
      const res = await patchDeposit({ depositStatus: 'INVALID_STATUS' })
      expect(res.status).toBe(400)
    })

    it('rejects extra body keys (strict schema)', async () => {
      const res = await patchDeposit({ depositStatus: 'PAID', unexpected: 'field' })
      expect(res.status).toBe(400)
    })

    it('returns 404 when NDA not found in scope', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(null)
      const res = await patchDeposit({ depositStatus: 'PAID' })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /leads/:leadId/nda/:id/pdf', () => {
    it('returns presigned url when NDA is SIGNED', async () => {
      mockNdaFindFirst.mockResolvedValueOnce({
        signedPdfKey: 'leads/lead-1/nda/nda-1-signed.pdf',
        status: 'SIGNED',
      } as any)
      mockGetSignedUrl.mockResolvedValueOnce('https://r2.test/signed/abc')

      const res = await app.request('/leads/lead-1/nda/nda-1/pdf')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.url).toBe('https://r2.test/signed/abc')
    })

    it('returns 409 when NDA is not SIGNED yet', async () => {
      mockNdaFindFirst.mockResolvedValueOnce({ signedPdfKey: null, status: 'SENT' } as any)
      const res = await app.request('/leads/lead-1/nda/nda-1/pdf')
      expect(res.status).toBe(409)
    })

    it('returns 404 when NDA not in caller scope', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/lead-1/nda/missing/pdf')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /leads/:leadId/nda/:id/resend', () => {
    it('reuses token for active NDA (rotated=false, no update)', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ lead: lead() }) as any)

      const res = await app.request('/leads/lead-1/nda/nda-1/resend', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.rotated).toBe(false)
      expect(mockNdaUpdate).not.toHaveBeenCalled()
      expect(mockSendSms).toHaveBeenCalledTimes(1)
    })

    it('rotates token when expired (rotated=true, update called)', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(
        nda({ expiresAt: new Date('2020-01-01T00:00:00Z'), lead: lead() }) as any,
      )
      mockNdaUpdate.mockResolvedValueOnce(nda({ lead: lead() }) as any)

      const res = await app.request('/leads/lead-1/nda/nda-1/resend', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.rotated).toBe(true)
      expect(mockNdaUpdate).toHaveBeenCalledTimes(1)
    })

    it('returns 409 when NDA already SIGNED', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ status: 'SIGNED', lead: lead() }) as any)
      const res = await app.request('/leads/lead-1/nda/nda-1/resend', { method: 'POST' })
      expect(res.status).toBe(409)
    })

    it('returns 404 when NDA not in scope', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/lead-1/nda/nda-1/resend', { method: 'POST' })
      expect(res.status).toBe(404)
    })
  })
})
