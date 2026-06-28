/**
 * Unit tests for NDA service CRUD + deposit + resend flows.
 * Prisma + storage + SMS side effects are mocked.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as ConfigModule from '../../../lib/config'

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
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  }
  return { prisma }
})

vi.mock('../../storage', () => ({
  getSignedDownloadUrl: vi.fn(),
  copyR2Object: vi.fn().mockResolvedValue({ key: 'copied' }),
  deleteFile: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../lib/config', async () => {
  const actual = await vi.importActual<typeof ConfigModule>('../../../lib/config')
  return {
    config: {
      ...actual.config,
      twilio: {
        ...actual.config.twilio,
        phoneNumber: '+15550001111',
      },
    },
  }
})

// Wrap the shared mock in vi.hoisted so it's available when vi.mock runs.
const { sharedSendInviteMock } = vi.hoisted(() => ({
  sharedSendInviteMock: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../agreement-sms', () => ({
  sendAgreementInviteSms: sharedSendInviteMock,
  sendAgreementInviteSmsBestEffort: sharedSendInviteMock,
  sendAgreementInviteSmsForClient: vi.fn().mockResolvedValue(undefined),
  sendAgreementInviteSmsForClientBestEffort: vi.fn().mockResolvedValue(undefined),
}))

import type * as TokenServiceModule from '../token-service'

vi.mock('../token-service', async () => {
  const actual = await vi.importActual<typeof TokenServiceModule>('../token-service')
  const fixedToken = vi.fn(() => 'tok_fixed_28_char_aaaaaaaaaa')
  return {
    ...actual,
    generateAgreementToken: fixedToken,
    generateNdaToken: fixedToken,
  }
})

import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../../lib/db'
import { copyR2Object, getSignedDownloadUrl } from '../../storage'
import { sendAgreementInviteSms } from '../agreement-sms'
import {
  createNdaForLead,
  listNdasForLead,
  updateDeposit,
  getPresignedPdfUrl,
  resendNda,
  extendAgreementForEntity,
  createAgreementDraftForEntity,
  updateAgreementDraftForEntity,
  discardAgreementDraftForEntity,
  sendAgreementDraftForEntity,
  buildNdaUrl,
} from '../agreement-service'

const mockLeadFindFirst = vi.mocked(prisma.lead.findFirst)
const mockStaffFindUnique = vi.mocked(prisma.staff.findUnique)
const mockNdaCreate = vi.mocked(prisma.agreement.create)
const mockNdaFindFirst = vi.mocked(prisma.agreement.findFirst)
const mockNdaFindMany = vi.mocked(prisma.agreement.findMany)
const mockNdaUpdate = vi.mocked(prisma.agreement.update)
const mockNdaUpdateMany = vi.mocked(prisma.agreement.updateMany)
const mockNdaDeleteMany = vi.mocked(prisma.agreement.deleteMany)
const mockGetSignedUrl = vi.mocked(getSignedDownloadUrl)
const mockCopyR2Object = vi.mocked(copyR2Object)
const mockSendSms = vi.mocked(sendAgreementInviteSms)

function lead(overrides: Record<string, unknown> = {}) {
  return { id: 'lead-1', firstName: 'Jane', phone: '+15551234567', ...overrides }
}

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

/** lead() shape augmented with the organization relation that
 *  loadEntityWithOrg/loadEntityForV2Snapshot expect from prisma.lead.findFirst.
 *  Includes full v2 firm/governing fields so NDA paths pass setup-validation. */
function leadWithOrg(overrides: Record<string, unknown> = {}) {
  return { ...lead(), businessName: null, organization: ORG_V2_FIELDS, ...overrides }
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
    organization: { name: 'Acme Tax LLC' },
    ...overrides,
  }
}

function draftAgreement(overrides: Record<string, unknown> = {}) {
  return nda({
    type: 'NDA',
    status: 'DRAFT',
    isActive: false,
    expiresAt: null,
    depositStatus: null,
    depositAmount: null,
    createdByUserId: 'staff-creator',
    lastEditedByUserId: 'staff-creator',
    sentByUserId: null,
    source: 'MANUAL',
    sourceSnapshot: null,
    updatedAt: new Date('2026-06-25T10:00:00.000Z'),
    ...overrides,
  })
}

describe('NDA service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStaffFindUnique.mockResolvedValue(staffWithSignature() as any)
  })

  describe('createNdaForLead', () => {
    it('creates NDA with token + expiry, sends invite SMS', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockNdaCreate.mockResolvedValueOnce(nda() as any)

      const result = await createNdaForLead({ leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' })

      expect(mockNdaCreate).toHaveBeenCalledTimes(1)
      const call = mockNdaCreate.mock.calls[0][0] as any
      expect(call.data).toMatchObject({
        leadId: 'lead-1',
        organizationId: 'org-1',
        createdByUserId: 'staff-1',
        templateVersion: 'v2', // currentTemplate bumped to v2
        status: 'SENT',
        token: 'tok_fixed_28_char_aaaaaaaaaa',
        isActive: true,
      })
      expect(call.data.expiresAt).toBeInstanceOf(Date)
      expect(mockSendSms).toHaveBeenCalledTimes(1)
      const smsArg = mockSendSms.mock.calls[0][0] as any
      expect(smsArg.orgId).toBe('org-1')
      expect(smsArg.staffId).toBe('staff-1')
      expect(smsArg.url).toContain('/agreements/tok_fixed_28_char_aaaaaaaaaa')
      expect(smsArg.lead).toEqual(lead())
      expect(result.url).toContain('/agreements/tok_fixed_28_char_aaaaaaaaaa')
      expect((prisma as any).$transaction).toHaveBeenCalledTimes(1)
      expect((prisma as any).$executeRaw).toHaveBeenCalledTimes(1)
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

  // Phase 07: type-aware active-engagement gate. Only NDA type triggers the
  // gate; other types can be sent in parallel even with an active NDA.
  describe('createAgreementForEntity — type-aware active-engagement gate', () => {
    it('blocks new NDA when an active SIGNED NDA with PENDING deposit exists', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockNdaFindFirst.mockResolvedValueOnce(
        nda({ status: 'SIGNED', isActive: true, depositStatus: 'PENDING' }) as any,
      )

      await expect(
        createNdaForLead({ leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 409 })

      expect(mockNdaCreate).not.toHaveBeenCalled()
      expect(mockSendSms).not.toHaveBeenCalled()
    })

    it('blocks new NDA when an outstanding SENT+isActive NDA invite exists', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockNdaFindFirst.mockResolvedValueOnce(
        nda({ status: 'SENT', isActive: true, depositStatus: null }) as any,
      )

      await expect(
        createNdaForLead({ leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 409 })

      expect(mockNdaCreate).not.toHaveBeenCalled()
    })

    it('allows ENGAGEMENT_LETTER even when an active NDA blocks new NDAs', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      // findFirst should NOT be invoked for non-NDA types — guard against
      // accidental gate firing by leaving the mock unset; if the gate runs
      // it'll return undefined and the test still passes for non-NDA paths.
      mockNdaCreate.mockResolvedValueOnce(nda({ id: 'el-1', type: 'ENGAGEMENT_LETTER' }) as any)

      const res = await createNdaForLead({
        leadId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'ENGAGEMENT_LETTER',
        contentHtml: '<p>Engagement scope: 2026 tax prep.</p>',
      })

      expect(res.agreement.id).toBe('el-1')
      expect(res.url).toContain('/agreements/tok_fixed_28_char_aaaaaaaaaa')
      expect(res.url).not.toContain('/nda/')
      // Defense-in-depth: the gate query must not run for non-NDA types.
      expect(mockNdaFindFirst).not.toHaveBeenCalled()
      expect(mockNdaCreate).toHaveBeenCalledTimes(1)
    })

    it('allows new NDA when only a non-NDA agreement is active', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      // The gate query is type-scoped (where.type === 'NDA') so any
      // ENGAGEMENT_LETTER row is excluded server-side. The mock returns null
      // because the WHERE clause filters out the EL row.
      mockNdaFindFirst.mockResolvedValueOnce(null)
      mockNdaCreate.mockResolvedValueOnce(nda() as any)

      const res = await createNdaForLead({ leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' })

      expect(res.agreement.id).toBe('nda-1')
      // Confirm the gate was actually invoked and scoped to type='NDA'.
      const gateWhere = (mockNdaFindFirst.mock.calls[0][0] as any).where
      expect(gateWhere.type).toBe('NDA')
      expect(gateWhere.organizationId).toBe('org-1')
      expect(gateWhere.leadId).toBe('lead-1')
    })

    it('allows new NDA when prior NDA is SIGNED with REFUNDED deposit (engagement closed)', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      // gate query filter: depositStatus IN (PENDING, PAID) — REFUNDED row is
      // excluded by the WHERE clause server-side, so findFirst returns null.
      mockNdaFindFirst.mockResolvedValueOnce(null)
      mockNdaCreate.mockResolvedValueOnce(nda() as any)

      const res = await createNdaForLead({ leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' })

      expect(res.agreement.id).toBe('nda-1')
    })
  })

  describe('listNdasForLead', () => {
    it('returns NDAs without public URL or token fields', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockNdaFindMany.mockResolvedValueOnce([nda({ id: 'n1' }), nda({ id: 'n2' })] as any)

      const list = await listNdasForLead('lead-1', 'org-1')

      expect(list).toHaveLength(2)
      expect(list[0].url).toBeUndefined()
      expect(list[0].token).toBeUndefined()
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

    it('returns 409 when agreement is still DRAFT', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(draftAgreement({ depositAmount: '300.00' }) as any)

      await expect(
        updateDeposit({
          ndaId: 'draft-1',
          leadId: 'lead-1',
          orgId: 'org-1',
          status: 'PAID',
          note: null,
          paidAt: null,
        }),
      ).rejects.toMatchObject({ status: 409 })
      expect(mockNdaUpdate).not.toHaveBeenCalled()
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
      mockNdaFindFirst
        .mockResolvedValueOnce(
          nda({
            lead: lead(),
            expiresAt: new Date('2020-01-01T00:00:00Z'),
            isActive: true,
          }) as any,
        )
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          nda({
            lead: lead(),
            expiresAt: new Date('2020-01-01T00:00:00Z'),
            isActive: true,
          }) as any,
        )
        .mockResolvedValueOnce(nda({ token: 'new_token_aaaaaaaaaaaaaaaaa', lead: lead() }) as any)
      mockNdaUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const result = await resendNda({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
      })

      expect(result.rotated).toBe(true)
      expect(mockNdaUpdateMany).toHaveBeenCalledTimes(1)
      const updateArgs = mockNdaUpdateMany.mock.calls[0][0] as any
      expect(updateArgs.where).toMatchObject({
        id: 'nda-1',
        leadId: 'lead-1',
        organizationId: 'org-1',
        status: { in: ['SENT', 'EXPIRED'] },
      })
      const data = updateArgs.data
      expect(data).toMatchObject({ status: 'SENT', isActive: true })
      expect(data.token).toBeDefined()
      expect(data.expiresAt).toBeInstanceOf(Date)
    })

    it('rotates token when isActive=false (sign-in-progress crashed path)', async () => {
      mockNdaFindFirst
        .mockResolvedValueOnce(nda({ isActive: false, lead: lead() }) as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(nda({ isActive: false, lead: lead() }) as any)
        .mockResolvedValueOnce(nda({ lead: lead() }) as any)
      mockNdaUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const result = await resendNda({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
      })
      expect(result.rotated).toBe(true)
    })

    it('does not touch customContentHtml on rotate (post-create immutability)', async () => {
      mockNdaFindFirst
        .mockResolvedValueOnce(
          nda({
            customContentHtml: '<p>Original custom</p>',
            expiresAt: new Date('2020-01-01T00:00:00Z'),
            lead: lead(),
          }) as any,
        )
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          nda({
            customContentHtml: '<p>Original custom</p>',
            expiresAt: new Date('2020-01-01T00:00:00Z'),
            lead: lead(),
          }) as any,
        )
        .mockResolvedValueOnce(nda({ lead: lead() }) as any)
      mockNdaUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      await resendNda({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
      })

      const data = (mockNdaUpdateMany.mock.calls[0][0] as any).data
      expect(data).not.toHaveProperty('customContentHtml')
    })

    it('returns 409 when token rotation loses the status race', async () => {
      mockNdaFindFirst
        .mockResolvedValueOnce(
          nda({
            lead: lead(),
            expiresAt: new Date('2020-01-01T00:00:00Z'),
          }) as any,
        )
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          nda({
            lead: lead(),
            expiresAt: new Date('2020-01-01T00:00:00Z'),
          }) as any,
        )
      mockNdaUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      await expect(
        resendNda({ ndaId: 'nda-1', leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 409 })
      expect(mockSendSms).not.toHaveBeenCalled()
    })

    it('reuses token when another resend already rotated under the lock', async () => {
      mockNdaFindFirst
        .mockResolvedValueOnce(
          nda({
            lead: lead(),
            expiresAt: new Date('2020-01-01T00:00:00Z'),
          }) as any,
        )
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          nda({
            token: 'new_token_aaaaaaaaaaaaaaaaa',
            lead: lead(),
            expiresAt: new Date('2030-01-01T00:00:00Z'),
            isActive: true,
          }) as any,
        )

      const result = await resendNda({
        ndaId: 'nda-1',
        leadId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
      })

      expect(result.rotated).toBe(false)
      expect(result.url).toContain('/agreements/new_token_aaaaaaaaaaaaaaaaa')
      expect(mockNdaUpdateMany).not.toHaveBeenCalled()
      expect(mockSendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/agreements/new_token_aaaaaaaaaaaaaaaaa'),
        }),
      )
    })

    it('returns 409 when another active NDA blocks rotation', async () => {
      mockNdaFindFirst
        .mockResolvedValueOnce(
          nda({
            lead: lead(),
            expiresAt: new Date('2020-01-01T00:00:00Z'),
          }) as any,
        )
        .mockResolvedValueOnce(nda({ id: 'nda-blocking', status: 'SENT' }) as any)

      await expect(
        resendNda({ ndaId: 'nda-1', leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 409 })
      expect(mockNdaUpdateMany).not.toHaveBeenCalled()
      expect(mockSendSms).not.toHaveBeenCalled()
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

    it('returns 409 when DRAFT', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ status: 'DRAFT', lead: lead() }) as any)
      await expect(
        resendNda({ ndaId: 'nda-1', leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 409 })
      expect(mockNdaUpdateMany).not.toHaveBeenCalled()
      expect(mockSendSms).not.toHaveBeenCalled()
    })

    it('returns 404 when NDA not found in scope', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(null)
      await expect(
        resendNda({ ndaId: 'nda-x', leadId: 'lead-1', orgId: 'org-1', staffId: 'staff-1' }),
      ).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('extendAgreementForEntity', () => {
    it('returns 409 when guarded extension loses the status race', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda() as any).mockResolvedValueOnce(null)
      mockNdaUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      await expect(
        extendAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          agreementId: 'nda-1',
          orgId: 'org-1',
        }),
      ).rejects.toMatchObject({ status: 409 })
      expect((mockNdaUpdateMany.mock.calls[0][0] as any).where).toMatchObject({
        id: 'nda-1',
        leadId: 'lead-1',
        organizationId: 'org-1',
        status: { in: ['SENT', 'EXPIRED'] },
      })
    })

    it('returns 409 when another active NDA blocks extension', async () => {
      mockNdaFindFirst
        .mockResolvedValueOnce(nda() as any)
        .mockResolvedValueOnce(nda({ id: 'nda-blocking', status: 'SENT' }) as any)

      await expect(
        extendAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          agreementId: 'nda-1',
          orgId: 'org-1',
        }),
      ).rejects.toMatchObject({ status: 409 })
      expect(mockNdaUpdateMany).not.toHaveBeenCalled()
    })

    it('returns 409 when DRAFT', async () => {
      mockNdaFindFirst.mockResolvedValueOnce(nda({ status: 'DRAFT' }) as any)

      await expect(
        extendAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          agreementId: 'nda-1',
          orgId: 'org-1',
        }),
      ).rejects.toMatchObject({ status: 409 })
      expect(mockNdaUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe('agreement draft lifecycle', () => {
    it('creates inactive drafts without public URL, token exposure, or SMS', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockNdaCreate.mockResolvedValueOnce(
        draftAgreement({
          id: 'draft-1',
          type: 'ENGAGEMENT_LETTER',
          title: '2026 Engagement Letter',
          customContentHtml: '<p>Tax prep scope.</p>',
          depositAmount: '250.00',
        }) as any,
      )

      const result = await createAgreementDraftForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'ENGAGEMENT_LETTER',
        title: '2026 Engagement Letter',
        contentHtml: '<p>Tax prep scope.</p>',
        depositAmount: '250.00',
      })

      const data = (mockNdaCreate.mock.calls[0][0] as any).data
      expect(data).toMatchObject({
        leadId: 'lead-1',
        organizationId: 'org-1',
        createdByUserId: 'staff-1',
        lastEditedByUserId: 'staff-1',
        status: 'DRAFT',
        isActive: false,
        expiresAt: null,
        depositAmount: '250.00',
        depositStatus: null,
      })
      expect(result.url).toBeUndefined()
      expect(result.token).toBeUndefined()
      expect(mockSendSms).not.toHaveBeenCalled()
    })

    it('sends draft with creator firm snapshot and sender audit', async () => {
      const updatedAt = new Date('2026-06-25T10:00:00.000Z')
      const draft = draftAgreement({
        id: 'draft-1',
        updatedAt,
        createdByUserId: 'staff-creator',
        depositAmount: '300.00',
      })
      const sent = nda({
        id: 'draft-1',
        status: 'SENT',
        isActive: true,
        sentByUserId: 'staff-sender',
        createdByUserId: 'staff-creator',
        lead: lead(),
      })
      mockNdaFindFirst.mockImplementation(((args: any) => {
        if (args.where?.status === 'DRAFT') return draft as any
        if (args.where?.type === 'NDA') return null
        if (args.where?.id === 'draft-1') return sent as any
        return null
      }) as any)
      mockStaffFindUnique.mockResolvedValue(staffWithSignature({ id: 'staff-creator' }) as any)
      mockLeadFindFirst.mockResolvedValueOnce(
        leadWithOrg({
          organization: { ...ORG_V2_FIELDS, firmPhone: null },
        }) as any,
      )
      mockNdaUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const result = await sendAgreementDraftForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        agreementId: 'draft-1',
        orgId: 'org-1',
        staffId: 'staff-sender',
        expectedUpdatedAt: updatedAt.toISOString(),
      })

      expect(mockStaffFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'staff-creator' } }),
      )
      expect((prisma as any).$transaction).toHaveBeenCalledTimes(1)
      expect((prisma as any).$executeRaw).toHaveBeenCalledTimes(1)
      const updateData = (mockNdaUpdateMany.mock.calls[0][0] as any).data
      expect(updateData).toMatchObject({
        status: 'SENT',
        isActive: true,
        sentByUserId: 'staff-sender',
        lastEditedByUserId: 'staff-sender',
        token: 'tok_fixed_28_char_aaaaaaaaaa',
        depositAmount: '300.00',
        depositStatus: 'PENDING',
      })
      expect(updateData).not.toHaveProperty('createdByUserId')
      expect(updateData.firmSignaturePngKey).toContain('agreement-firm-sigs/staff-creator/')
      expect(mockSendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          staffId: 'staff-sender',
          url: expect.stringContaining('/agreements/tok_fixed_28_char_aaaaaaaaaa'),
        }),
      )
      expect(result.url).toContain('/agreements/tok_fixed_28_char_aaaaaaaaaa')
    })

    it('rejects draft send when the original creator is outside the organization', async () => {
      const updatedAt = new Date('2026-06-25T10:00:00.000Z')
      mockNdaFindFirst.mockImplementation(((args: any) => {
        if (args.where?.status === 'DRAFT') {
          return draftAgreement({
            id: 'draft-1',
            type: 'ENGAGEMENT_LETTER',
            updatedAt,
            createdByUserId: 'staff-creator',
          }) as any
        }
        return null
      }) as any)
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockStaffFindUnique.mockResolvedValueOnce(
        staffWithSignature({ id: 'staff-creator', organizationId: 'org-other' }) as any,
      )

      await expect(
        sendAgreementDraftForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          agreementId: 'draft-1',
          orgId: 'org-1',
          staffId: 'staff-sender',
          expectedUpdatedAt: updatedAt.toISOString(),
        }),
      ).rejects.toMatchObject({ status: 422 })
      expect(mockCopyR2Object).not.toHaveBeenCalled()
      expect(mockNdaUpdateMany).not.toHaveBeenCalled()
      expect(mockSendSms).not.toHaveBeenCalled()
    })

    it('replaces an uploaded PDF source when inline HTML is supplied', async () => {
      const updatedAt = new Date('2026-06-25T10:00:00.000Z')
      mockNdaFindFirst.mockImplementation(((args: any) => {
        if (args.where?.status === 'DRAFT') {
          return draftAgreement({
            id: 'draft-1',
            type: 'ENGAGEMENT_LETTER',
            updatedAt,
            uploadedPdfKey: 'agreement-uploads/lead-1/old.pdf',
            customContentHtml: null,
          }) as any
        }
        if (args.where?.id === 'draft-1') {
          return draftAgreement({
            id: 'draft-1',
            type: 'ENGAGEMENT_LETTER',
            uploadedPdfKey: null,
            customContentHtml: '<p>Updated scope</p>',
          }) as any
        }
        return null
      }) as any)
      mockNdaUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      await updateAgreementDraftForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        agreementId: 'draft-1',
        orgId: 'org-1',
        staffId: 'staff-2',
        type: 'ENGAGEMENT_LETTER',
        contentHtml: '<p>Updated scope</p>',
        expectedUpdatedAt: updatedAt.toISOString(),
      })

      const updateData = (mockNdaUpdateMany.mock.calls[0][0] as any).data
      expect(updateData.uploadedPdfKey).toBeNull()
      expect(updateData.templateId).toBeNull()
      expect(updateData.customContentHtml).toBe('<p>Updated scope</p>')
    })

    it('rejects stale draft updates with 409', async () => {
      mockNdaFindFirst.mockImplementation(((args: any) => {
        if (args.where?.status === 'DRAFT') {
          return draftAgreement({
            id: 'draft-1',
            updatedAt: new Date('2026-06-25T10:01:00.000Z'),
          }) as any
        }
        return null
      }) as any)

      await expect(
        updateAgreementDraftForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          agreementId: 'draft-1',
          orgId: 'org-1',
          staffId: 'staff-2',
          expectedUpdatedAt: '2026-06-25T10:00:00.000Z',
        }),
      ).rejects.toMatchObject({ status: 409 })
      expect(mockNdaUpdateMany).not.toHaveBeenCalled()
    })

    it('discards only scoped DRAFT rows', async () => {
      const updatedAt = new Date('2026-06-25T10:00:00.000Z')
      mockNdaFindFirst.mockImplementation(((args: any) => {
        if (args.where?.status === 'DRAFT') {
          return draftAgreement({ id: 'draft-1', updatedAt }) as any
        }
        return null
      }) as any)
      mockNdaDeleteMany.mockResolvedValueOnce({ count: 1 } as any)

      const result = await discardAgreementDraftForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        agreementId: 'draft-1',
        orgId: 'org-1',
        expectedUpdatedAt: updatedAt.toISOString(),
      })

      expect(mockNdaDeleteMany).toHaveBeenCalledWith({
        where: {
          id: 'draft-1',
          leadId: 'lead-1',
          organizationId: 'org-1',
          status: 'DRAFT',
          updatedAt,
        },
      })
      expect(result).toEqual({ id: 'draft-1', status: 'DISCARDED' })
    })

    it('rejects stale draft discards with 409', async () => {
      mockNdaFindFirst.mockImplementation(((args: any) => {
        if (args.where?.status === 'DRAFT') {
          return draftAgreement({
            id: 'draft-1',
            updatedAt: new Date('2026-06-25T10:01:00.000Z'),
          }) as any
        }
        return null
      }) as any)

      await expect(
        discardAgreementDraftForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          agreementId: 'draft-1',
          orgId: 'org-1',
          expectedUpdatedAt: '2026-06-25T10:00:00.000Z',
        }),
      ).rejects.toMatchObject({ status: 409 })
      expect(mockNdaDeleteMany).not.toHaveBeenCalled()
    })
  })

  describe('buildNdaUrl', () => {
    it('builds a portal URL with the canonical /agreements/ path prefix', () => {
      expect(buildNdaUrl('abcd')).toContain('/agreements/abcd')
    })
  })

  it('HTTPException shape is correct (sanity: matches Hono)', () => {
    expect(new HTTPException(404, { message: 'x' })).toBeInstanceOf(HTTPException)
  })
})
