/**
 * Integration tests for the staff-facing NDA handlers, driven through
 * Hono's test utilities with the prisma + storage + SMS layers mocked.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => {
  const prisma: any = {
    lead: { findFirst: vi.fn() },
    staff: { findUnique: vi.fn() },
    agreement: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  }
  return { prisma }
})

vi.mock('../../../services/storage', () => ({
  getSignedDownloadUrl: vi.fn(),
  copyR2Object: vi.fn().mockResolvedValue({ key: 'copied' }),
  deleteFile: vi.fn().mockResolvedValue(true),
}))

// Mock both new and legacy export names. agreement-create-ops imports
// Wrap the shared mock in vi.hoisted so it's available when vi.mock runs.
const { sharedSendInviteMock } = vi.hoisted(() => ({
  sharedSendInviteMock: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../../services/agreements/agreement-sms', () => ({
  sendAgreementInviteSms: sharedSendInviteMock,
  sendAgreementInviteSmsBestEffort: sharedSendInviteMock,
  sendAgreementInviteSmsForClient: vi.fn().mockResolvedValue(undefined),
  sendAgreementInviteSmsForClientBestEffort: vi.fn().mockResolvedValue(undefined),
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
  return {
    authMiddleware,
    requireOrgAdmin,
    requireAdminOrManager: requireOrgAdmin,
    clerkMiddleware: authMiddleware,
  }
})

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { getSignedDownloadUrl } from '../../../services/storage'
import { sendAgreementInviteSms } from '../../../services/agreements/agreement-sms'
import { staffRoute } from '../staff-handlers'
import {
  discardAgreementDraftBodySchema,
  saveAgreementDraftBodySchema,
  sendAgreementDraftBodySchema,
  updateAgreementDraftBodySchema,
} from '../schemas'

const mockLeadFindFirst = vi.mocked(prisma.lead.findFirst)
const mockStaffFindUnique = vi.mocked(prisma.staff.findUnique)
const mockNdaCreate = vi.mocked(prisma.agreement.create)
const mockNdaFindFirst = vi.mocked(prisma.agreement.findFirst)
const mockNdaFindMany = vi.mocked(prisma.agreement.findMany)
const mockNdaUpdate = vi.mocked(prisma.agreement.update)
const mockNdaUpdateMany = vi.mocked(prisma.agreement.updateMany)
const mockNdaDeleteMany = vi.mocked(prisma.agreement.deleteMany)
const mockGetSignedUrl = vi.mocked(getSignedDownloadUrl)
const mockSendSms = vi.mocked(sendAgreementInviteSms)

const app = new Hono()
app.route('/leads', staffRoute)

describe('agreement draft body schemas', () => {
  it('preserves omitted editable fields and requires concurrency for update/send/discard', () => {
    const expectedUpdatedAt = '2026-06-25T10:00:00.000Z'

    const saveBody = saveAgreementDraftBodySchema.parse({})
    const updateBody = updateAgreementDraftBodySchema.parse({ expectedUpdatedAt })
    const sendBody = sendAgreementDraftBodySchema.parse({ expectedUpdatedAt })
    const discardBody = discardAgreementDraftBodySchema.parse({ expectedUpdatedAt })

    expect(saveBody).toEqual({})
    expect(updateBody).toEqual({ expectedUpdatedAt })
    expect(sendBody).toEqual({ expectedUpdatedAt })
    expect(discardBody).toEqual({ expectedUpdatedAt })
    expect(() => updateAgreementDraftBodySchema.parse({})).toThrow()
    expect(() => sendAgreementDraftBodySchema.parse({})).toThrow()
    expect(() => discardAgreementDraftBodySchema.parse({})).toThrow()
  })
})

const ORG_V2_FIELDS = {
  id: 'org-1',
  name: 'Acme Tax LLC',
  address: '10700 Richmond Ave',
  city: 'Houston',
  state: 'TX',
  zip: '77042',
  governingState: 'Texas',
  governingCounty: 'Harris County',
  firmPhone: '+15551234567',
  firmEmail: 'office@acme.test',
  firmWebsite: 'https://acme.test',
}

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    firstName: 'Jane',
    phone: '+15551234567',
    businessName: null,
    organization: ORG_V2_FIELDS,
    ...overrides,
  }
}

function staffWithSignature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff-1',
    organizationId: 'org-1',
    name: 'Felix Howard',
    email: 'felix@acme.test',
    title: 'Managing Partner, CPA',
    signaturePngKey: 'staff-signatures/staff-1/abc.png',
    ...overrides,
  }
}

function nda(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nda-1',
    leadId: 'lead-1',
    organizationId: 'org-1',
    type: 'NDA',
    title: 'Non-Disclosure Agreement',
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
    organization: { name: 'Acme Tax LLC' },
    ...overrides,
  }
}

describe('Staff NDA handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStaffFindUnique.mockResolvedValue(staffWithSignature() as any)
  })

  describe('POST /leads/:leadId/nda', () => {
    async function createReq(body: unknown = {}) {
      return app.request('/leads/lead-1/agreements', {
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
      expect(json.data.token).toBeUndefined()
      expect(json.url).toMatch(/\/agreements\/[A-Za-z0-9]{28}$/)
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

    it.each(['ENGAGEMENT_LETTER', 'SERVICE_AGREEMENT', 'CUSTOM'] as const)(
      'accepts depositAmount when creating %s agreements',
      async (type) => {
        mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
        mockNdaCreate.mockResolvedValueOnce(
          nda({
            id: `${type.toLowerCase().replaceAll('_', '-')}-1`,
            type,
            title: `${type} Test`,
            depositAmount: '500.00',
            depositStatus: 'PENDING',
          }) as any
        )

        const res = await createReq({
          type,
          title: `${type} Test`,
          contentHtml: '<p>Agreement terms</p>',
          depositAmount: '500.00',
        })

        expect(res.status).toBe(201)
        const created = (mockNdaCreate.mock.calls[0][0] as any).data
        expect(created.type).toBe(type)
        expect(created.depositAmount).toBe('500.00')
        expect(created.depositStatus).toBe('PENDING')
      }
    )

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

    it('rejects uploaded PDF source for CONSENT_7216', async () => {
      const res = await createReq({
        type: 'CONSENT_7216',
        uploadedPdfKey: 'agreement-uploads/lead-1/source.pdf',
      })
      expect(res.status).toBe(400)
      expect(mockLeadFindFirst).not.toHaveBeenCalled()
      expect(mockNdaCreate).not.toHaveBeenCalled()
    })

    it('rejects custom title for CONSENT_7216', async () => {
      const res = await createReq({
        type: 'CONSENT_7216',
        title: 'Custom Consent Title',
      })
      expect(res.status).toBe(400)
      expect(mockLeadFindFirst).not.toHaveBeenCalled()
      expect(mockNdaCreate).not.toHaveBeenCalled()
    })

    it('returns 404 when lead not found / not in caller org', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/bad-lead/agreements', {
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

    it('returns rendered HTML with v2 section headings (currentTemplate is v2)', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      const res = await app.request('/leads/lead-1/agreements/default-html')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(typeof json.data.contentHtml).toBe('string')
      expect(json.data.contentHtml).toMatch(/<h2>/)
      // v2 template: recipient name is in HeaderBlock PDF component, not HTML body.
      // Org name is also not interpolated into body sections (it's in the PDF header).
      // Verify v2-specific section headings are present instead.
      expect(json.data.contentHtml).toContain('1. Purpose of Agreement')
      expect(json.data.contentHtml).toContain('20. Client Acknowledgment')
    })

    it('returns the built-in Engagement Letter when requested by type', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      const res = await app.request('/leads/lead-1/agreements/default-html?type=ENGAGEMENT_LETTER')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.contentHtml).toContain('Engagement Letter')
      expect(json.data.contentHtml).toContain('Acceptance and Signature')
      expect(json.data.contentHtml).toContain('[Amount]')
    })

    it('returns 404 when lead not in caller org', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/foreign/agreements/default-html')
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
      return app.request('/leads/lead-1/agreements/preview-pdf', {
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

    it('rejects custom title or content for CONSENT_7216 preview', async () => {
      const titleRes = await previewReq({
        type: 'CONSENT_7216',
        title: 'Custom Consent Title',
      })
      expect(titleRes.status).toBe(400)

      const contentRes = await previewReq({
        type: 'CONSENT_7216',
        contentHtml: '<p>Custom consent</p>',
      })
      expect(contentRes.status).toBe(400)
      expect(mockLeadFindFirst).not.toHaveBeenCalled()
    })

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
    it('lists NDAs for the lead without exposing public url or token', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
      mockNdaFindMany.mockResolvedValueOnce([nda({ id: 'n1' }), nda({ id: 'n2' })] as any)

      const res = await app.request('/leads/lead-1/agreements')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(2)
      expect(json.data[0].url).toBeUndefined()
      expect(json.data[0].token).toBeUndefined()
      // scoped by org
      const listCall = mockNdaFindMany.mock.calls[0][0] as any
      expect(listCall.where).toEqual({ leadId: 'lead-1', organizationId: 'org-1' })
    })

    it('does not return a public url or token for draft agreements', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
      mockNdaFindMany.mockResolvedValueOnce([
        nda({ id: 'draft-active', status: 'DRAFT', isActive: true }),
        nda({ id: 'sent-inactive', status: 'SENT', isActive: false }),
        nda({ id: 'signed-active', status: 'SIGNED', isActive: true }),
      ] as any)

      const res = await app.request('/leads/lead-1/agreements')
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

    it('returns 404 when lead belongs to another org (cross-org isolation)', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/foreign/agreements')
      expect(res.status).toBe(404)
      // Prove the lookup was org-scoped, not a bare ID match
      const where = (mockLeadFindFirst.mock.calls[0][0] as any).where
      expect(where).toMatchObject({ id: 'foreign', organizationId: 'org-1' })
    })
  })

  describe('DELETE /leads/:leadId/agreements/:id/draft', () => {
    const updatedAt = new Date('2026-06-25T10:00:00.000Z')

    function discardReq(body: unknown = { expectedUpdatedAt: updatedAt.toISOString() }) {
      return app.request('/leads/lead-1/agreements/draft-1/draft', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    it('passes DELETE body freshness into the guarded discard operation', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({
        id: 'draft-1',
        status: 'DRAFT',
        isActive: false,
        updatedAt,
      }) as any)
      mockNdaDeleteMany.mockResolvedValueOnce({ count: 1 } as any)

      const res = await discardReq()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toEqual({ id: 'draft-1', status: 'DISCARDED' })
      expect(mockNdaDeleteMany).toHaveBeenCalledWith({
        where: {
          id: 'draft-1',
          leadId: 'lead-1',
          organizationId: 'org-1',
          status: 'DRAFT',
          updatedAt,
        },
      })
    })

    it('rejects missing discard freshness before loading the draft', async () => {
      const res = await discardReq({})

      expect(res.status).toBe(400)
      expect(mockNdaFindFirst).not.toHaveBeenCalled()
      expect(mockNdaDeleteMany).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /leads/:leadId/nda/:id/deposit', () => {
    async function patchDeposit(body: unknown) {
      return app.request('/leads/lead-1/agreements/nda-1/deposit', {
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

      const res = await app.request('/leads/lead-1/agreements/nda-1/pdf')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.url).toBe('https://r2.test/signed/abc')
    })

    it('returns 409 when NDA is not SIGNED yet', async () => {
      mockNdaFindFirst.mockResolvedValueOnce({ signedPdfKey: null, status: 'SENT' } as any)
      const res = await app.request('/leads/lead-1/agreements/nda-1/pdf')
      expect(res.status).toBe(409)
    })

    it('returns 404 when NDA not in caller scope', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/lead-1/agreements/missing/pdf')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /leads/:leadId/nda/:id/resend', () => {
    it('reuses token for active NDA (rotated=false, no update)', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ lead: lead() }) as any)

      const res = await app.request('/leads/lead-1/agreements/nda-1/resend', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.rotated).toBe(false)
      expect(mockNdaUpdate).not.toHaveBeenCalled()
      expect(mockSendSms).toHaveBeenCalledTimes(1)
    })

    it('rotates token when expired (rotated=true, update called)', async () => {
      mockNdaFindFirst
        .mockResolvedValueOnce(
          nda({ expiresAt: new Date('2020-01-01T00:00:00Z'), lead: lead() }) as any
        )
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          nda({ expiresAt: new Date('2020-01-01T00:00:00Z'), lead: lead() }) as any
        )
        .mockResolvedValueOnce(nda({ lead: lead() }) as any)
      mockNdaUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const res = await app.request('/leads/lead-1/agreements/nda-1/resend', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.rotated).toBe(true)
      expect(mockNdaUpdateMany).toHaveBeenCalledTimes(1)
    })

    it('returns 409 when NDA already SIGNED', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ status: 'SIGNED', lead: lead() }) as any)
      const res = await app.request('/leads/lead-1/agreements/nda-1/resend', { method: 'POST' })
      expect(res.status).toBe(409)
    })

    it('returns 404 when NDA not in scope', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(null)
      const res = await app.request('/leads/lead-1/agreements/nda-1/resend', { method: 'POST' })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /leads/:leadId/agreements/:id/void', () => {
    it('voids a sent agreement and strips the token from the response', async () => {
      mockNdaFindFirst
        .mockResolvedValueOnce(nda({ status: 'SENT' }) as any)
        .mockResolvedValueOnce(
          nda({
            status: 'VOIDED',
            isActive: false,
            voidedByUserId: 'staff-1',
            voidReason: 'Sent wrong agreement',
          }) as any,
        )
      mockNdaUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const res = await app.request('/leads/lead-1/agreements/nda-1/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Sent wrong agreement' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('VOIDED')
      expect(json.data.token).toBeUndefined()
      expect(mockNdaUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'nda-1',
          leadId: 'lead-1',
          organizationId: 'org-1',
          status: { in: ['SENT', 'EXPIRED'] },
        },
        data: expect.objectContaining({
          status: 'VOIDED',
          isActive: false,
          voidedByUserId: 'staff-1',
          voidReason: 'Sent wrong agreement',
        }),
      })
    })

    it('rejects too-short void reasons before loading the agreement', async () => {
      const res = await app.request('/leads/lead-1/agreements/nda-1/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'no' }),
      })

      expect(res.status).toBe(400)
      expect(mockNdaFindFirst).not.toHaveBeenCalled()
      expect(mockNdaUpdateMany).not.toHaveBeenCalled()
    })
  })
})
