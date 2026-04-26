/**
 * Unit tests for NDA service CRUD + deposit + resend flows.
 * Prisma + storage + SMS side effects are mocked.
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

vi.mock('../../storage', () => ({
  getSignedDownloadUrl: vi.fn(),
}))

vi.mock('../nda-sms', () => ({
  sendNdaInviteSms: vi.fn().mockResolvedValue(undefined),
}))

import type * as TokenServiceModule from '../token-service'

vi.mock('../token-service', async () => {
  const actual = await vi.importActual<typeof TokenServiceModule>('../token-service')
  return {
    ...actual,
    generateNdaToken: vi.fn(() => 'tok_fixed_28_char_aaaaaaaaaa'),
  }
})

import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../../lib/db'
import { getSignedDownloadUrl } from '../../storage'
import { sendNdaInviteSms } from '../nda-sms'
import {
  createNdaForLead,
  listNdasForLead,
  updateDeposit,
  getPresignedPdfUrl,
  resendNda,
  buildNdaUrl,
} from '../nda-service'

const mockLeadFindFirst = vi.mocked(prisma.lead.findFirst)
const mockNdaCreate = vi.mocked(prisma.ndaAgreement.create)
const mockNdaFindFirst = vi.mocked(prisma.ndaAgreement.findFirst)
const mockNdaFindMany = vi.mocked(prisma.ndaAgreement.findMany)
const mockNdaUpdate = vi.mocked(prisma.ndaAgreement.update)
const mockGetSignedUrl = vi.mocked(getSignedDownloadUrl)
const mockSendSms = vi.mocked(sendNdaInviteSms)

function lead(overrides: Record<string, unknown> = {}) {
  return { id: 'lead-1', firstName: 'Jane', phone: '+15551234567', ...overrides }
}

function nda(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nda-1',
    leadId: 'lead-1',
    organizationId: 'org-1',
    token: 'tok_fixed_28_char_aaaaaaaaaa',
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

describe('NDA service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createNdaForLead', () => {
    it('creates NDA with token + expiry, sends invite SMS', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
      mockNdaCreate.mockResolvedValueOnce(nda() as any)

      const result = await createNdaForLead({ leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' })

      expect(mockNdaCreate).toHaveBeenCalledTimes(1)
      const call = mockNdaCreate.mock.calls[0][0] as any
      expect(call.data).toMatchObject({
        leadId: 'lead-1',
        organizationId: 'org-1',
        createdByUserId: 'staff-1',
        templateVersion: 'v1',
        status: 'SENT',
        token: 'tok_fixed_28_char_aaaaaaaaaa',
        isActive: true,
      })
      expect(call.data.expiresAt).toBeInstanceOf(Date)
      expect(mockSendSms).toHaveBeenCalledTimes(1)
      const smsArg = mockSendSms.mock.calls[0][0] as any
      expect(smsArg.orgId).toBe('org-1')
      expect(smsArg.staffId).toBe('staff-1')
      expect(smsArg.url).toContain('/nda/tok_fixed_28_char_aaaaaaaaaa')
      expect(smsArg.lead).toEqual(lead())
      expect(result.url).toContain('/nda/tok_fixed_28_char_aaaaaaaaaa')
    })

    it('throws 404 when lead not found or cross-org', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(null)
      await expect(
        createNdaForLead({ leadId: 'lead-x', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 404 })
      expect(mockNdaCreate).not.toHaveBeenCalled()
      expect(mockSendSms).not.toHaveBeenCalled()
    })
  })

  describe('listNdasForLead', () => {
    it('returns NDAs with computed URL field', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(lead() as any)
      mockNdaFindMany.mockResolvedValueOnce([nda({ id: 'n1' }), nda({ id: 'n2' })] as any)

      const list = await listNdasForLead('lead-1', 'org-1')

      expect(list).toHaveLength(2)
      expect(list[0].url).toBe(buildNdaUrl('tok_fixed_28_char_aaaaaaaaaa'))
      expect(mockNdaFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { leadId: 'lead-1', organizationId: 'org-1' },
          orderBy: { createdAt: 'desc' },
        }),
      )
    })

    it('throws 404 when lead not in caller org', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(null)
      await expect(listNdasForLead('lead-x', 'org-1')).rejects.toMatchObject({ status: 404 })
      expect(mockNdaFindMany).not.toHaveBeenCalled()
    })
  })

  describe('updateDeposit', () => {
    it('allows PENDING -> PAID, sets depositPaidAt', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ depositStatus: 'PENDING' }) as any)
      mockNdaUpdate.mockResolvedValueOnce(nda({ depositStatus: 'PAID' }) as any)

      const paidAt = new Date('2026-04-24T12:00:00Z')
      await updateDeposit({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        status: 'PAID',
        note: 'wire received',
        paidAt,
      })

      const data = (mockNdaUpdate.mock.calls[0][0] as any).data
      expect(data.depositStatus).toBe('PAID')
      expect(data.depositNote).toBe('wire received')
      expect(data.depositPaidAt).toEqual(paidAt)
    })

    it('defaults depositPaidAt to now when PAID without explicit paidAt and none on record', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(
        nda({ depositStatus: 'PENDING', depositPaidAt: null }) as any,
      )
      mockNdaUpdate.mockResolvedValueOnce(nda() as any)

      await updateDeposit({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        status: 'PAID',
        note: null,
        paidAt: null,
      })

      const data = (mockNdaUpdate.mock.calls[0][0] as any).data
      expect(data.depositPaidAt).toBeInstanceOf(Date)
    })

    it('sets depositResolvedAt for REFUNDED transition', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ depositStatus: 'PAID' }) as any)
      mockNdaUpdate.mockResolvedValueOnce(nda({ depositStatus: 'REFUNDED' }) as any)

      await updateDeposit({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        status: 'REFUNDED',
        note: 'client canceled',
        paidAt: null,
      })

      const data = (mockNdaUpdate.mock.calls[0][0] as any).data
      expect(data.depositStatus).toBe('REFUNDED')
      expect(data.depositResolvedAt).toBeInstanceOf(Date)
    })

    it('blocks REFUNDED -> PENDING with 409 (transition whitelist)', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ depositStatus: 'REFUNDED' }) as any)

      await expect(
        updateDeposit({
          ndaId: 'nda-1',
          leadId: 'lead-1',
          orgId: 'org-1',
          status: 'PENDING',
          note: null,
          paidAt: null,
        }),
      ).rejects.toMatchObject({ status: 409 })
      expect(mockNdaUpdate).not.toHaveBeenCalled()
    })

    it('throws 404 when NDA not found in lead + org scope', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(null)
      await expect(
        updateDeposit({
          ndaId: 'nda-x',
          leadId: 'lead-1',
          orgId: 'org-1',
          status: 'PAID',
          note: null,
          paidAt: null,
        }),
      ).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('getPresignedPdfUrl', () => {
    it('returns signed URL when NDA is SIGNED and pdf key exists', async () => {
      mockNdaFindFirst.mockResolvedValueOnce({
        signedPdfKey: 'leads/lead-1/nda/nda-1-signed.pdf',
        status: 'SIGNED',
      } as any)
      mockGetSignedUrl.mockResolvedValueOnce('https://r2.test/signed/abc')

      const url = await getPresignedPdfUrl({ ndaId: 'nda-1', leadId: 'lead-1', orgId: 'org-1' })
      expect(url).toBe('https://r2.test/signed/abc')
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        'leads/lead-1/nda/nda-1-signed.pdf',
        900,
      )
    })

    it('returns 409 when NDA is not signed', async () => {
      mockNdaFindFirst.mockResolvedValueOnce({ signedPdfKey: null, status: 'SENT' } as any)
      await expect(
        getPresignedPdfUrl({ ndaId: 'nda-1', leadId: 'lead-1', orgId: 'org-1' }),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('returns 404 when NDA missing', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(null)
      await expect(
        getPresignedPdfUrl({ ndaId: 'bad', leadId: 'lead-1', orgId: 'org-1' }),
      ).rejects.toMatchObject({ status: 404 })
    })

    it('returns 500 when presigner fails unexpectedly', async () => {
      mockNdaFindFirst.mockResolvedValueOnce({
        signedPdfKey: 'key',
        status: 'SIGNED',
      } as any)
      mockGetSignedUrl.mockResolvedValueOnce(null as any)
      await expect(
        getPresignedPdfUrl({ ndaId: 'nda-1', leadId: 'lead-1', orgId: 'org-1' }),
      ).rejects.toMatchObject({ status: 500 })
    })
  })

  describe('resendNda', () => {
    it('reuses token when NDA is active + not expired', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ lead: lead() }) as any)

      const result = await resendNda({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
      })

      expect(result.rotated).toBe(false)
      expect(mockNdaUpdate).not.toHaveBeenCalled()
      expect(mockSendSms).toHaveBeenCalledTimes(1)
    })

    it('rotates token when expired', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(
        nda({
          lead: lead(),
          expiresAt: new Date('2020-01-01T00:00:00Z'),
          isActive: true,
        }) as any,
      )
      mockNdaUpdate.mockResolvedValueOnce(
        nda({ token: 'new_token_aaaaaaaaaaaaaaaaa', lead: lead() }) as any,
      )

      const result = await resendNda({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
      })

      expect(result.rotated).toBe(true)
      expect(mockNdaUpdate).toHaveBeenCalledTimes(1)
      const data = (mockNdaUpdate.mock.calls[0][0] as any).data
      expect(data).toMatchObject({ status: 'SENT', isActive: true })
      expect(data.token).toBeDefined()
      expect(data.expiresAt).toBeInstanceOf(Date)
    })

    it('rotates token when isActive=false (sign-in-progress crashed path)', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ isActive: false, lead: lead() }) as any)
      mockNdaUpdate.mockResolvedValueOnce(nda({ lead: lead() }) as any)

      const result = await resendNda({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
      })
      expect(result.rotated).toBe(true)
    })

    it('does not touch customContentHtml on rotate (post-create immutability)', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(
        nda({
          customContentHtml: '<p>Original custom</p>',
          expiresAt: new Date('2020-01-01T00:00:00Z'),
          lead: lead(),
        }) as any,
      )
      mockNdaUpdate.mockResolvedValueOnce(nda({ lead: lead() }) as any)

      await resendNda({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
      })

      const data = (mockNdaUpdate.mock.calls[0][0] as any).data
      expect(data).not.toHaveProperty('customContentHtml')
    })

    it('returns 409 when already SIGNED', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ status: 'SIGNED', lead: lead() }) as any)
      await expect(
        resendNda({ ndaId: 'nda-1', leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('returns 409 when VOIDED', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ status: 'VOIDED', lead: lead() }) as any)
      await expect(
        resendNda({ ndaId: 'nda-1', leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('returns 404 when NDA not found in scope', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(null)
      await expect(
        resendNda({ ndaId: 'nda-x', leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('buildNdaUrl', () => {
    it('builds a portal URL with the /nda/ path prefix', () => {
      expect(buildNdaUrl('abcd')).toContain('/nda/abcd')
    })
  })

  it('HTTPException shape is correct (sanity: matches Hono)', () => {
    expect(new HTTPException(404, { message: 'x' })).toBeInstanceOf(HTTPException)
  })
})
