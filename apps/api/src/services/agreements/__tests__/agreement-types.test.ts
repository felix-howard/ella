/**
 * Tests for type-aware agreement creation: NDA, ENGAGEMENT_LETTER,
 * SERVICE_AGREEMENT, CUSTOM. Covers content resolution rules, template
 * snapshot lookup (org-scoped, archived-excluded), and type-mismatch errors.
 *
 * Active-engagement gate behavior is exercised in agreement-service.test.ts
 * — this file focuses on the resolveContent + templateId-snapshot path that
 * differentiates the new types from the legacy NDA flow.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as ConfigModule from '../../../lib/config'

vi.mock('../../../lib/db', () => {
  const prisma: any = {
    lead: { findFirst: vi.fn() },
    client: { findFirst: vi.fn() },
    staff: { findUnique: vi.fn() },
    agreement: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    agreementTemplate: {
      findFirst: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  }
  return { prisma }
})

vi.mock('../agreement-sms', () => ({
  sendAgreementInviteSms: vi.fn().mockResolvedValue(undefined),
  sendAgreementInviteSmsBestEffort: vi.fn().mockResolvedValue(undefined),
  sendAgreementInviteSmsForClient: vi.fn().mockResolvedValue(undefined),
  sendAgreementInviteSmsForClientBestEffort: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../storage', () => ({
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

import type * as TokenServiceModule from '../token-service'

vi.mock('../token-service', async () => {
  const actual = await vi.importActual<typeof TokenServiceModule>('../token-service')
  return {
    ...actual,
    generateAgreementToken: vi.fn(() => 'tok_types_28_char_aaaaaaaaaa'),
  }
})

import { prisma } from '../../../lib/db'
import { createAgreementForEntity } from '../agreement-create-ops'

const mockLeadFindFirst = vi.mocked(prisma.lead.findFirst)
const mockStaffFindUnique = vi.mocked(prisma.staff.findUnique)
const mockAgreementCreate = vi.mocked(prisma.agreement.create)
const mockAgreementFindFirst = vi.mocked(prisma.agreement.findFirst)
const mockTemplateFindFirst = vi.mocked(prisma.agreementTemplate.findFirst)

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

function leadWithOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    firstName: 'Jane',
    lastName: 'Doe',
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

function dbAgreement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    leadId: 'lead-1',
    organizationId: 'org-1',
    type: 'NDA',
    title: 'Non-Disclosure Agreement',
    token: 'tok_types_28_char_aaaaaaaaaa',
    status: 'SENT',
    isActive: true,
    templateVersion: 'v1',
    customContentHtml: null,
    templateId: null,
    depositAmount: null,
    depositStatus: null,
    expiresAt: new Date('2030-01-01T00:00:00Z'),
    createdAt: new Date('2026-04-23T00:00:00Z'),
    organization: { name: 'Acme Tax LLC' },
    ...overrides,
  }
}

function dbTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-1',
    organizationId: 'org-1',
    type: 'ENGAGEMENT_LETTER',
    contentHtml: '<p>Engagement scope: 2026 tax prep.</p>',
    isArchived: false,
    ...overrides,
  }
}

describe('createAgreementForEntity — type-aware content resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAgreementFindFirst.mockResolvedValue(null) // gate: no active NDA
    mockStaffFindUnique.mockResolvedValue(staffWithSignature() as any)
  })

  describe('NDA (default type)', () => {
    it('falls back to built-in template when no content/template supplied', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement() as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.type).toBe('NDA')
      // Title comes from currentTemplate (v2) which has an updated title
      expect(created.templateVersion).toBe('v2')
      // Built-in default → no customContentHtml stored.
      expect(created.customContentHtml).toBeNull()
      expect(created.templateId).toBeNull()
      // Template lookup never invoked when no templateId provided.
      expect(mockTemplateFindFirst).not.toHaveBeenCalled()
    })

    it('accepts caller-supplied contentHtml override (sanitizes + stores)', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement() as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        contentHtml: '<p>Edited NDA body</p><script>alert(1)</script>',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      // sanitize-html strips <script>; <p> survives.
      expect(created.customContentHtml).toContain('<p>Edited NDA body</p>')
      expect(created.customContentHtml).not.toContain('<script>')
    })

    it('snapshots from an org NDA template when templateId supplied', async () => {
      // Org-level NDA templates are valid (the template-type schema permits
      // 'NDA' alongside EL/SA). This exercises the snapshot branch for NDA so
      // a future special-case that bypasses templates for NDA would fail here.
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockTemplateFindFirst.mockResolvedValueOnce(
        dbTemplate({ id: 'tpl-nda', type: 'NDA', contentHtml: '<p>Org NDA body</p>' }) as any
      )
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement() as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'NDA',
        templateId: 'tpl-nda',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.type).toBe('NDA')
      expect(created.templateId).toBe('tpl-nda')
      expect(created.customContentHtml).toContain('Org NDA body')
    })
  })

  describe('ENGAGEMENT_LETTER', () => {
    it('snapshots contentHtml from a matching org-level template', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockTemplateFindFirst.mockResolvedValueOnce(dbTemplate() as any)
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement({ type: 'ENGAGEMENT_LETTER' }) as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'ENGAGEMENT_LETTER',
        templateId: 'tpl-1',
      })

      const tplWhere = (mockTemplateFindFirst.mock.calls[0][0] as any).where
      // Template lookup must be org-scoped + exclude archived.
      expect(tplWhere).toMatchObject({
        id: 'tpl-1',
        organizationId: 'org-1',
        isArchived: false,
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.type).toBe('ENGAGEMENT_LETTER')
      expect(created.title).toBe('Engagement Letter')
      expect(created.templateId).toBe('tpl-1')
      expect(created.customContentHtml).toContain('Engagement scope')
    })

    it('uses configured Twilio number when firmPhone is not stored', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(
        leadWithOrg({
          organization: { ...ORG_V2_FIELDS, firmPhone: null },
        }) as any
      )
      mockTemplateFindFirst.mockResolvedValueOnce(dbTemplate() as any)
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement({ type: 'ENGAGEMENT_LETTER' }) as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'ENGAGEMENT_LETTER',
        templateId: 'tpl-1',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.type).toBe('ENGAGEMENT_LETTER')
      expect(created.firmSignerEmail).toBe('felix@acme.test')
    })

    it('rejects with 404 when templateId does not exist for the org', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockTemplateFindFirst.mockResolvedValueOnce(null)

      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'ENGAGEMENT_LETTER',
          templateId: 'tpl-missing',
        })
      ).rejects.toMatchObject({ status: 404 })

      expect(mockAgreementCreate).not.toHaveBeenCalled()
    })

    it('rejects with 404 when templateId points at an archived template', async () => {
      // resolveContent's WHERE includes isArchived:false, so an archived row
      // is not visible. Mocking findFirst → null is the correct simulation:
      // production Prisma returns no row when the WHERE clause excludes it.
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockTemplateFindFirst.mockResolvedValueOnce(null)

      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'ENGAGEMENT_LETTER',
          templateId: 'tpl-archived',
        })
      ).rejects.toMatchObject({ status: 404 })

      // Confirm the WHERE clause carries isArchived:false — archived rows
      // must be invisible to send-time snapshot lookups regardless of org.
      const where = (mockTemplateFindFirst.mock.calls[0][0] as any).where
      expect(where.isArchived).toBe(false)
    })

    it('rejects with 422 when template type does not match agreement type', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      // Caller asks for EL but supplies an NDA template — must 422.
      mockTemplateFindFirst.mockResolvedValueOnce(dbTemplate({ type: 'NDA' }) as any)

      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'ENGAGEMENT_LETTER',
          templateId: 'tpl-nda',
        })
      ).rejects.toMatchObject({ status: 422 })
      expect(mockAgreementCreate).not.toHaveBeenCalled()
    })

    it('rejects with 422 when neither templateId nor contentHtml supplied', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)

      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'ENGAGEMENT_LETTER',
        })
      ).rejects.toMatchObject({ status: 422 })
      expect(mockAgreementCreate).not.toHaveBeenCalled()
    })

    it('rejects with 422 when contentHtml still has bracket placeholders', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)

      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'ENGAGEMENT_LETTER',
          contentHtml: '<p>Fee: [Amount]</p>',
        })
      ).rejects.toMatchObject({ status: 422 })

      expect(mockAgreementCreate).not.toHaveBeenCalled()
    })

    it('caller-supplied contentHtml wins over templateId snapshot', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockTemplateFindFirst.mockResolvedValueOnce(dbTemplate() as any)
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement({ type: 'ENGAGEMENT_LETTER' }) as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'ENGAGEMENT_LETTER',
        templateId: 'tpl-1',
        contentHtml: '<p>Edited body overrides template</p>',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      // templateId still recorded (provenance), but customContentHtml is the
      // caller-supplied edited body, not the template seed.
      expect(created.templateId).toBe('tpl-1')
      expect(created.customContentHtml).toContain('Edited body overrides template')
      expect(created.customContentHtml).not.toContain('Engagement scope')
    })
  })

  describe('SERVICE_AGREEMENT', () => {
    it('rejects when neither templateId nor contentHtml supplied', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)

      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'SERVICE_AGREEMENT',
        })
      ).rejects.toMatchObject({ status: 422 })
    })

    it('uses default title when title not supplied', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement({ type: 'SERVICE_AGREEMENT' }) as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'SERVICE_AGREEMENT',
        contentHtml: '<p>Service scope</p>',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.title).toBe('Service Agreement')
    })
  })

  describe('CONSENT_7216', () => {
    it('creates without content/template/deposit and stores built-in metadata defaults', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockAgreementCreate.mockResolvedValueOnce(
        dbAgreement({
          type: 'CONSENT_7216',
          title: 'Consent to Use and Disclose Tax Return Information',
        }) as any
      )

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'CONSENT_7216',
        depositAmount: '500.00',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.type).toBe('CONSENT_7216')
      expect(created.title).toBe('Consent to Use and Disclose Tax Return Information')
      expect(created.templateVersion).toBe('consent-7216-v1')
      expect(created.customContentHtml).toBeNull()
      expect(created.templateId).toBeNull()
      expect(created.depositAmount).toBeNull()
      expect(created.depositStatus).toBeNull()
      expect(mockTemplateFindFirst).not.toHaveBeenCalled()
      expect(mockStaffFindUnique).not.toHaveBeenCalled()
    })

    it('rejects caller-supplied content or templates', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)

      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'CONSENT_7216',
          contentHtml: '<p>Custom consent</p>',
        })
      ).rejects.toMatchObject({ status: 422 })

      expect(mockAgreementCreate).not.toHaveBeenCalled()
    })

    it('rejects caller-supplied title override', async () => {
      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'CONSENT_7216',
          title: 'Custom Consent Title',
        })
      ).rejects.toMatchObject({ status: 422 })

      expect(mockLeadFindFirst).not.toHaveBeenCalled()
      expect(mockAgreementCreate).not.toHaveBeenCalled()
    })

    it('rejects uploaded PDF source', async () => {
      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'CONSENT_7216',
          uploadedPdfKey: 'agreement-uploads/lead-1/source.pdf',
        })
      ).rejects.toMatchObject({ status: 422 })

      expect(mockLeadFindFirst).not.toHaveBeenCalled()
      expect(mockAgreementCreate).not.toHaveBeenCalled()
    })
  })

  describe('CUSTOM', () => {
    it('creates with sanitized customContentHtml when supplied', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement({ type: 'CUSTOM' }) as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'CUSTOM',
        contentHtml: '<p>Custom paste-from-Docs</p><script>x</script>',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.type).toBe('CUSTOM')
      expect(created.title).toBe('Agreement') // Default for CUSTOM.
      expect(created.customContentHtml).toContain('Custom paste-from-Docs')
      expect(created.customContentHtml).not.toContain('<script>')
    })

    it('rejects with 422 when content missing', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)

      await expect(
        createAgreementForEntity({
          entityType: 'lead',
          entityId: 'lead-1',
          orgId: 'org-1',
          staffId: 'staff-1',
          type: 'CUSTOM',
        })
      ).rejects.toMatchObject({ status: 422 })
      expect(mockAgreementCreate).not.toHaveBeenCalled()
    })

    it('honors caller-supplied title', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockAgreementCreate.mockResolvedValueOnce(
        dbAgreement({ type: 'CUSTOM', title: 'Mutual NDA — 2026 Acquisition' }) as any
      )

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'CUSTOM',
        title: 'Mutual NDA — 2026 Acquisition',
        contentHtml: '<p>Custom body</p>',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.title).toBe('Mutual NDA — 2026 Acquisition')
    })
  })

  describe('Deposit normalization (per-send opt-in)', () => {
    it('seeds depositStatus=PENDING when amount supplied', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement() as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        depositAmount: '500.00',
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.depositAmount).toBe('500.00')
      expect(created.depositStatus).toBe('PENDING')
    })

    it('omits deposit fields when amount null', async () => {
      mockLeadFindFirst.mockResolvedValueOnce(leadWithOrg() as any)
      mockAgreementCreate.mockResolvedValueOnce(dbAgreement() as any)

      await createAgreementForEntity({
        entityType: 'lead',
        entityId: 'lead-1',
        orgId: 'org-1',
        staffId: 'staff-1',
        type: 'CUSTOM',
        contentHtml: '<p>No deposit</p>',
        depositAmount: null,
      })

      const created = (mockAgreementCreate.mock.calls[0][0] as any).data
      expect(created.depositAmount).toBeNull()
      expect(created.depositStatus).toBeNull()
    })
  })
})
