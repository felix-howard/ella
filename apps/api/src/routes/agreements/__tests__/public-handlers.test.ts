/**
 * Integration tests for public NDA handlers (token-protected, no auth).
 * Covers view, sign, double-sign (409), expiry (410), and per-token rate limit.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    agreement: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.test/signed/pdf'),
  deleteFile: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../services/agreements/pdf-generator', () => ({
  generateSignedPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n...')),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { __resetRateLimitMapForTests } from '../../../middleware/rate-limiter'
import { publicRoute } from '../public-handlers'

const mockFindUnique = vi.mocked(prisma.agreement.findUnique)
const mockUpdateMany = vi.mocked(prisma.agreement.updateMany)

const app = new Hono()
app.route('/public/nda', publicRoute)

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const VALID_PNG_DATA_URL =
  'data:image/png;base64,' + Buffer.concat([PNG_MAGIC, Buffer.from('sig')]).toString('base64')

// Unique-enough token per test case so per-token rate limiter doesn't leak state
function freshToken(seed: string): string {
  const base = `tokhandlers${seed}${Date.now()}${Math.random().toString(36).slice(2)}`
  return base
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 28)
    .padEnd(28, 'x')
}

function activeNda(token: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'nda-1',
    leadId: 'lead-1',
    organizationId: 'org-1',
    token,
    status: 'SENT',
    isActive: true,
    templateVersion: 'v1',
    depositAmount: '300.00',
    expiresAt: new Date('2030-01-01T00:00:00Z'),
    createdAt: new Date('2026-04-23T00:00:00Z'),
    signedAt: null,
    signedPdfKey: null,
    lead: { id: 'lead-1', firstName: 'Jane', lastName: 'Doe' },
    organization: { id: 'org-1', name: 'Acme Tax LLC' },
    ...overrides,
  }
}

function signBody(overrides: Record<string, unknown> = {}) {
  return {
    signerName: 'Jane Doe',
    signerTitle: 'Manager',
    signaturePngDataUrl: VALID_PNG_DATA_URL,
    agreementChecked: true,
    ...overrides,
  }
}

function expectPublicErrorResponseSanitized(json: Record<string, unknown>) {
  expect(Object.keys(json).sort()).toEqual(['error', 'message', 'success'])
}

describe('Public NDA handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitMapForTests()
  })

  describe('GET /public/nda/:token', () => {
    it('returns view for an active, unexpired NDA', async () => {
      const token = freshToken('view-ok')
      mockFindUnique.mockResolvedValueOnce(activeNda(token) as any)

      const res = await app.request(`/public/nda/${token}`)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('SENT')
      expect(json.data.expired).toBe(false)
      expect(json.data.templateSections.length).toBeGreaterThan(0)
      expect(json.data.depositAmount).toBe('$300.00')
    })

    it('returns 404 for unknown token', async () => {
      mockFindUnique.mockResolvedValueOnce(null)
      const res = await app.request(`/public/nda/${freshToken('view-missing')}`)
      expect(res.status).toBe(404)
    })

    it.each([
      {
        label: 'draft active',
        status: 'DRAFT',
        isActive: true,
        error: 'AGREEMENT_INACTIVE',
      },
      {
        label: 'draft inactive',
        status: 'DRAFT',
        isActive: false,
        error: 'AGREEMENT_INACTIVE',
      },
      {
        label: 'sent inactive',
        status: 'SENT',
        isActive: false,
        error: 'AGREEMENT_INACTIVE',
      },
      {
        label: 'signed active',
        status: 'SIGNED',
        isActive: true,
        error: 'AGREEMENT_SIGNED',
      },
      {
        label: 'voided active',
        status: 'VOIDED',
        isActive: true,
        error: 'AGREEMENT_VOIDED',
      },
    ])('returns 409 for non-public token: $label', async ({ label, status, isActive, error }) => {
      const token = freshToken(`view-${label}`)
      mockFindUnique.mockResolvedValueOnce(
        activeNda(token, { status, isActive }) as any
      )

      const res = await app.request(`/public/nda/${token}`)
      const json = await res.json()

      expect(res.status).toBe(409)
      expect(json).toMatchObject({ success: false, error })
      expectPublicErrorResponseSanitized(json)
    })

    it('still returns view with expired=true when expiry past (UI shows error)', async () => {
      const token = freshToken('view-expired')
      mockFindUnique.mockResolvedValueOnce(
        activeNda(token, { expiresAt: new Date('2020-01-01T00:00:00Z') }) as any
      )
      const res = await app.request(`/public/nda/${token}`)
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(json.data.expired).toBe(true)
    })
  })

  describe('POST /public/nda/:token/sign', () => {
    async function postSign(token: string, body: unknown, ip = '203.0.113.1') {
      return app.request(`/public/nda/${token}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': ip,
          'user-agent': 'Mozilla/5.0 Test',
        },
        body: JSON.stringify(body),
      })
    }

    it('signs NDA, marks SIGNED, returns download URL', async () => {
      const token = freshToken('sign-ok')
      mockFindUnique.mockResolvedValueOnce(activeNda(token) as any)
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const res = await postSign(token, signBody())
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('SIGNED')
      expect(json.data.downloadUrl).toBe('https://r2.test/signed/pdf')
    })

    it('accepts consent taxpayer fields for CONSENT_7216 signing', async () => {
      const token = freshToken('sign-consent')
      mockFindUnique.mockResolvedValueOnce(
        activeNda(token, {
          type: 'CONSENT_7216',
          depositAmount: null,
          depositStatus: null,
        }) as any
      )
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const res = await postSign(
        token,
        signBody({
          taxpayerName: 'Jane Doe',
          businessName: 'Jane Consulting LLC',
          tinLastFour: '1234',
          consentSignerTitle: 'Owner',
        })
      )

      expect(res.status).toBe(200)
      expect((mockUpdateMany.mock.calls[0][0] as any).data).toMatchObject({
        consentTaxpayerName: 'Jane Doe',
        consentBusinessName: 'Jane Consulting LLC',
        consentTinLastFour: '1234',
        clientAuthRepTitle: 'Owner',
      })
    })

    it('rejects full TIN values for CONSENT_7216 signing at the route schema', async () => {
      const token = freshToken('sign-consent-full-tin')
      const res = await postSign(
        token,
        signBody({
          taxpayerName: 'Jane Doe',
          tinLastFour: '123456789',
          consentSignerTitle: 'Owner',
        })
      )

      expect(res.status).toBe(400)
      expect(mockFindUnique).not.toHaveBeenCalled()
      expect(mockUpdateMany).not.toHaveBeenCalled()
    })

    it('keeps non-consent signing compatible without consent fields', async () => {
      const token = freshToken('sign-non-consent-no-consent-fields')
      mockFindUnique.mockResolvedValueOnce(activeNda(token) as any)
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const res = await postSign(token, signBody())

      expect(res.status).toBe(200)
      const data = (mockUpdateMany.mock.calls[0][0] as any).data
      expect(data).not.toHaveProperty('consentTaxpayerName')
      expect(data).not.toHaveProperty('consentBusinessName')
      expect(data).not.toHaveProperty('consentTinLastFour')
    })

    it('returns 409 on double-sign (updateMany count=0 — winning concurrent signer)', async () => {
      const token = freshToken('sign-race')
      mockFindUnique.mockResolvedValueOnce(activeNda(token) as any)
      mockUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      const res = await postSign(token, signBody())
      expect(res.status).toBe(409)
    })

    it('returns AGREEMENT_VOIDED when void wins a concurrent sign race', async () => {
      const token = freshToken('sign-race-voided')
      mockFindUnique
        .mockResolvedValueOnce(activeNda(token) as any)
        .mockResolvedValueOnce(
          activeNda(token, { status: 'VOIDED', isActive: false }) as any
        )
      mockUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      const res = await postSign(token, signBody())
      const json = await res.json()

      expect(res.status).toBe(409)
      expect(json).toMatchObject({
        success: false,
        error: 'AGREEMENT_VOIDED',
        message: 'Agreement has been revoked',
      })
      expectPublicErrorResponseSanitized(json)
    })

    it('returns 410 when NDA expired', async () => {
      const token = freshToken('sign-expired')
      mockFindUnique.mockResolvedValueOnce(
        activeNda(token, { expiresAt: new Date('2020-01-01T00:00:00Z') }) as any
      )
      const res = await postSign(token, signBody())
      expect(res.status).toBe(410)
      expect(mockUpdateMany).not.toHaveBeenCalled()
    })

    it('returns 409 when NDA not SENT (already SIGNED)', async () => {
      const token = freshToken('sign-twice')
      mockFindUnique.mockResolvedValueOnce(activeNda(token, { status: 'SIGNED' }) as any)
      const res = await postSign(token, signBody())
      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toMatchObject({ error: 'AGREEMENT_SIGNED' })
    })

    it('returns AGREEMENT_VOIDED when signing a voided token', async () => {
      const token = freshToken('sign-voided')
      mockFindUnique.mockResolvedValueOnce(
        activeNda(token, { status: 'VOIDED', isActive: false }) as any
      )

      const res = await postSign(token, signBody())
      const json = await res.json()

      expect(res.status).toBe(409)
      expect(json).toMatchObject({
        success: false,
        error: 'AGREEMENT_VOIDED',
        message: 'Agreement has been revoked',
      })
      expectPublicErrorResponseSanitized(json)
      expect(mockUpdateMany).not.toHaveBeenCalled()
    })

    it('returns 404 for unknown token', async () => {
      const token = freshToken('sign-bad')
      mockFindUnique.mockResolvedValueOnce(null)
      const res = await postSign(token, signBody())
      expect(res.status).toBe(404)
    })

    it('returns 400 when signaturePngDataUrl missing PNG prefix', async () => {
      const token = freshToken('sign-nopng')
      // schema-level rejection — no prisma call reached
      const res = await postSign(
        token,
        signBody({ signaturePngDataUrl: 'data:image/jpeg;base64,AAAA' })
      )
      expect(res.status).toBe(400)
      expect(mockFindUnique).not.toHaveBeenCalled()
    })

    it('returns 400 when agreementChecked is not true', async () => {
      const token = freshToken('sign-uncheck')
      const res = await postSign(token, signBody({ agreementChecked: false }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when signerName is empty', async () => {
      const token = freshToken('sign-noname')
      const res = await postSign(token, signBody({ signerName: '' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when signerName exceeds 120-char schema limit', async () => {
      const token = freshToken('sign-longname')
      const res = await postSign(token, signBody({ signerName: 'a'.repeat(121) }))
      expect(res.status).toBe(400)
    })

    it('accepts pathological but valid signerName (emoji, RTL, zero-width)', async () => {
      const token = freshToken('sign-exotic')
      mockFindUnique.mockResolvedValueOnce(activeNda(token) as any)
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const exotic = '\u202Edleofn\u202C\u200B\uD83D\uDE00 Jane'
      const res = await postSign(token, signBody({ signerName: exotic }))
      expect(res.status).toBe(200)
      const stored = (mockUpdateMany.mock.calls[0][0] as any).data.signerName
      expect(stored).toBe(exotic)
    })

    it('rate-limits after 3 attempts within 1 hour per token (429)', async () => {
      const token = freshToken('rl')
      // Three attempts get through; we can wire a 404 each since rate-limit runs first
      mockFindUnique.mockResolvedValue(null as any)

      for (let i = 0; i < 3; i++) {
        const res = await postSign(token, signBody())
        expect([404, 410, 409]).toContain(res.status) // any non-429 proves limiter didn't trip early
      }
      // 4th attempt hits the limiter
      const throttled = await postSign(token, signBody())
      expect(throttled.status).toBe(429)
      const json = await throttled.json()
      expect(json.error).toBe('RATE_LIMIT_EXCEEDED')
    })
  })
})
