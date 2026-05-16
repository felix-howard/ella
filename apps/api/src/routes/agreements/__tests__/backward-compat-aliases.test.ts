/**
 * Verifies the back-compat alias `/public/nda/:token` resolves to the same
 * handler as the canonical `/public/agreements/:token`. Existing customer SMS
 * links carry the `/nda/` path; this test prevents accidental breakage of
 * those links during the rename.
 *
 * The actual handler logic (sign flow, expiry, rate-limit) is exercised in
 * public-handlers.test.ts. Here we only assert path-equivalence.
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
}))

vi.mock('../../../services/agreements/pdf-generator', () => ({
  generateSignedPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n...')),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { __resetRateLimitMapForTests } from '../../../middleware/rate-limiter'
import { publicRoute, SIGN_MAX_ATTEMPTS } from '../public-handlers'

const mockFindUnique = vi.mocked(prisma.agreement.findUnique)
const mockUpdateMany = vi.mocked(prisma.agreement.updateMany)

// Mount the router on BOTH paths exactly as app.ts:79-80 does, so this test
// catches a regression where someone removes the alias mount.
const app = new Hono()
app.route('/public/agreements', publicRoute)
app.route('/public/nda', publicRoute)

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const VALID_PNG_DATA_URL =
  'data:image/png;base64,' + Buffer.concat([PNG_MAGIC, Buffer.from('sig')]).toString('base64')

function freshToken(seed: string): string {
  const base = `tokalias${seed}${Date.now()}${Math.random().toString(36).slice(2)}`
  return base.replace(/[^A-Za-z0-9]/g, '').slice(0, 28).padEnd(28, 'x')
}

function activeAgreement(token: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    leadId: 'lead-1',
    organizationId: 'org-1',
    type: 'NDA',
    title: 'Non-Disclosure Agreement',
    token,
    status: 'SENT',
    isActive: true,
    templateVersion: 'v1',
    customContentHtml: null,
    templateId: null,
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

function signBody() {
  return {
    signerName: 'Jane Doe',
    signerTitle: 'Manager',
    signaturePngDataUrl: VALID_PNG_DATA_URL,
    agreementChecked: true,
  }
}

describe('Backward-compat aliases — /public/nda ↔ /public/agreements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitMapForTests()
  })

  describe('GET /:token', () => {
    it('both paths return the same view shape for the same token', async () => {
      const token = freshToken('view-parity')

      mockFindUnique.mockResolvedValueOnce(activeAgreement(token) as any)
      const ndaRes = await app.request(`/public/nda/${token}`)
      const ndaJson = await ndaRes.json()

      mockFindUnique.mockResolvedValueOnce(activeAgreement(token) as any)
      const aliasRes = await app.request(`/public/agreements/${token}`)
      const aliasJson = await aliasRes.json()

      expect(ndaRes.status).toBe(200)
      expect(aliasRes.status).toBe(200)
      // The two paths MUST produce identical envelopes, otherwise customer
      // SMS links and new wizard links diverge for the same token.
      expect(ndaJson).toEqual(aliasJson)
    })

    it('alias returns 404 when token not found, same as canonical', async () => {
      const token = freshToken('view-missing')
      mockFindUnique.mockResolvedValueOnce(null)
      const aliasRes = await app.request(`/public/nda/${token}`)
      expect(aliasRes.status).toBe(404)

      mockFindUnique.mockResolvedValueOnce(null)
      const canonicalRes = await app.request(`/public/agreements/${token}`)
      expect(canonicalRes.status).toBe(404)
    })
  })

  describe('POST /:token/sign', () => {
    async function postSign(path: string, token: string) {
      return app.request(`${path}/${token}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '203.0.113.1',
          'user-agent': 'Mozilla/5.0 Test',
        },
        body: JSON.stringify(signBody()),
      })
    }

    it('signs via /nda path, marks SIGNED', async () => {
      const token = freshToken('sign-nda-alias')
      mockFindUnique.mockResolvedValueOnce(activeAgreement(token) as any)
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const res = await postSign('/public/nda', token)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.status).toBe('SIGNED')
      expect(json.data.downloadUrl).toBe('https://r2.test/signed/pdf')
    })

    it('signs via /agreements path with identical behavior', async () => {
      const token = freshToken('sign-agreements-canonical')
      mockFindUnique.mockResolvedValueOnce(activeAgreement(token) as any)
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const res = await postSign('/public/agreements', token)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.status).toBe('SIGNED')
    })

    it('rate limit is per-token, shared across both path aliases', async () => {
      // Same token used for both mounts → limiter must aggregate attempts so
      // a brute-forcer can't double their attempts by alternating paths.
      // Driven from the imported SIGN_MAX_ATTEMPTS so this test self-adjusts
      // if the limit is ever tuned (otherwise a higher limit silently passes).
      const token = freshToken('rl-shared')
      mockFindUnique.mockResolvedValue(null as any) // 404 each — limiter still counts

      // Alternate paths to prove the bucket is keyed on token, not path.
      for (let i = 0; i < SIGN_MAX_ATTEMPTS; i++) {
        const path = i % 2 === 0 ? '/public/nda' : '/public/agreements'
        const r = await postSign(path, token)
        expect([404, 410, 409]).toContain(r.status)
      }

      // Next attempt — must trip the limiter regardless of path.
      const throttled = await postSign('/public/agreements', token)
      expect(throttled.status).toBe(429)
    })
  })
})
