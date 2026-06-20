/**
 * Unit tests for the public signing service.
 * Verifies load, view rendering, and sign flow with concurrency + expiry.
 * Prisma, storage, and PDF generator are mocked.
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

vi.mock('../../storage', () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.test/signed/pdf'),
}))

vi.mock('../pdf-generator', () => ({
  generateSignedPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n...signed...')),
}))

vi.mock('../agreement-post-sign-notifications', () => ({
  notifyAdminsAgreementSigned: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../payments/deposit-payment-service', () => ({
  createDepositPaymentForAgreement: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '../../../lib/db'
import { uploadFile, getSignedDownloadUrl } from '../../storage'
import { generateSignedPdf } from '../pdf-generator'
import { createDepositPaymentForAgreement } from '../../payments/deposit-payment-service'
import { loadNdaByToken, toPublicView, signAgreement, signNda } from '../agreement-signing-service'

const mockFindUnique = vi.mocked(prisma.agreement.findUnique)
const mockUpdateMany = vi.mocked(prisma.agreement.updateMany)
const mockUpload = vi.mocked(uploadFile)
const mockGetSigned = vi.mocked(getSignedDownloadUrl)
const mockGenPdf = vi.mocked(generateSignedPdf)
const mockCreateDepositPayment = vi.mocked(createDepositPaymentForAgreement)

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const VALID_PNG_DATA_URL =
  'data:image/png;base64,' + Buffer.concat([PNG_MAGIC, Buffer.from('sig-bytes')]).toString('base64')

function activeNda(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nda-1',
    leadId: 'lead-1',
    clientId: null,
    organizationId: 'org-1',
    createdByUserId: 'staff-1',
    token: 'tok-abc',
    status: 'SENT',
    isActive: true,
    type: 'NDA',
    title: 'Non-Disclosure Agreement',
    templateVersion: 'v1',
    customContentHtml: null,
    uploadedPdfKey: null,
    depositAmount: '300.00',
    depositStatus: 'PENDING',
    expiresAt: new Date('2030-01-01T00:00:00Z'),
    createdAt: new Date('2026-04-23T00:00:00Z'),
    signedAt: null,
    signedPdfKey: null,
    lead: { id: 'lead-1', firstName: 'Jane', lastName: 'Doe' },
    client: null,
    organization: { id: 'org-1', name: 'Acme Tax LLC' },
    signer: { id: 'lead-1', firstName: 'Jane', lastName: 'Doe', kind: 'lead' },
    ...overrides,
  }
}

function activeClientNda(overrides: Record<string, unknown> = {}) {
  return activeNda({
    leadId: null,
    clientId: 'client-1',
    lead: null,
    client: { id: 'client-1', firstName: 'Lan', lastName: 'Nguyen' },
    signer: { id: 'client-1', firstName: 'Lan', lastName: 'Nguyen', kind: 'client' },
    ...overrides,
  })
}

describe('loadNdaByToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries by unique token with lead + client + org includes', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    const nda = await loadNdaByToken('tok-abc')
    expect(nda?.id).toBe('nda-1')
    expect(nda?.signer).toEqual({
      id: 'lead-1',
      firstName: 'Jane',
      lastName: 'Doe',
      kind: 'lead',
    })
    const call = mockFindUnique.mock.calls[0][0] as any
    expect(call.where).toEqual({ token: 'tok-abc' })
    expect(call.include.lead).toBeDefined()
    expect(call.include.client).toBeDefined()
    expect(call.include.organization).toBeDefined()
  })

  it('returns null when token is unknown', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await loadNdaByToken('bad')).toBeNull()
  })

  it('builds signer from client when NDA is client-scoped (no lead)', async () => {
    mockFindUnique.mockResolvedValueOnce(activeClientNda() as any)
    const nda = await loadNdaByToken('tok-abc')
    expect(nda?.signer).toEqual({
      id: 'client-1',
      firstName: 'Lan',
      lastName: 'Nguyen',
      kind: 'client',
    })
  })

  it('returns null when both lead and client are detached', async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeNda({ leadId: null, lead: null, clientId: null, client: null }) as any
    )
    expect(await loadNdaByToken('tok-abc')).toBeNull()
  })
})

describe('toPublicView', () => {
  it('renders template sections with full name + org + deposit', async () => {
    const view = await toPublicView(activeNda() as any)
    expect(view.status).toBe('SENT')
    expect(view.expired).toBe(false)
    expect(view.orgName).toBe('Acme Tax LLC')
    expect(view.leadFirstName).toBe('Jane')
    expect(view.depositAmount).toBe('$300.00')
    expect(view.templateVersion).toBe('v1')
    expect(view.templateTitle).toBe('Non-Disclosure Agreement')
    expect(view.templateSubtitle).toBeNull()
    expect(view.templateSections.length).toBeGreaterThan(0)
    const body = JSON.stringify(view.templateSections)
    expect(body).toContain('Jane Doe')
    expect(body).toContain('Acme Tax LLC')
    // v1 agreements: no firm/client snapshot returned.
    expect(view.firmSnapshot).toBeNull()
    expect(view.clientSnapshot).toBeNull()
  })

  it('flags expired=true when expiresAt is in the past', async () => {
    const view = await toPublicView(
      activeNda({ expiresAt: new Date('2020-01-01T00:00:00Z') }) as any
    )
    expect(view.expired).toBe(true)
  })

  it('handles missing last name gracefully', async () => {
    const view = await toPublicView(
      activeNda({
        lead: { id: 'lead-1', firstName: 'Jane', lastName: '' },
        signer: { id: 'lead-1', firstName: 'Jane', lastName: '', kind: 'lead' },
      }) as any
    )
    const body = JSON.stringify(view.templateSections)
    expect(body).toContain('Jane')
    // Shouldn't contain a stray trailing space-only token
    expect(body).not.toContain('Jane  ')
  })

  it('renders signer name from client when NDA is client-scoped', async () => {
    const view = await toPublicView(activeClientNda() as any)
    expect(view.leadFirstName).toBe('Lan')
    const body = JSON.stringify(view.templateSections)
    expect(body).toContain('Lan Nguyen')
  })

  it('exposes templateHtml when customContentHtml is set', async () => {
    const view = await toPublicView(
      activeNda({ customContentHtml: '<p>Custom NDA content</p>' }) as any
    )
    expect(view.templateHtml).toBe('<p>Custom NDA content</p>')
    // Legacy field still populated for back-compat
    expect(view.templateSections.length).toBeGreaterThan(0)
  })

  it('returns templateHtml=null when customContentHtml is null', async () => {
    const view = await toPublicView(activeNda({ customContentHtml: null }) as any)
    expect(view.templateHtml).toBeNull()
    expect(view.templateSections.length).toBeGreaterThan(0)
  })

  it('coerces empty-string customContentHtml to null (legacy render branch)', async () => {
    const view = await toPublicView(activeNda({ customContentHtml: '' }) as any)
    expect(view.templateHtml).toBeNull()
  })

  it('coerces undefined customContentHtml to null', async () => {
    const view = await toPublicView(activeNda({ customContentHtml: undefined }) as any)
    expect(view.templateHtml).toBeNull()
  })

  it('renders CONSENT_7216 through the built-in consent template, not NDA sections', async () => {
    const view = await toPublicView(
      activeClientNda({
        type: 'CONSENT_7216',
        title: 'Consent to Disclosure',
        templateVersion: 'consent-7216-v1',
        depositAmount: null,
      }) as any
    )
    expect(view.type).toBe('CONSENT_7216')
    expect(view.templateTitle).toBe('Consent to Disclosure')
    expect(view.templateSubtitle).toBe('Internal Revenue Code §7216 and Treas. Reg. §301.7216-3')
    const body = JSON.stringify(view.templateSections)
    expect(body).toContain('Federal law generally prohibits')
    expect(body).toContain('Electronic Systems and Secure Portals')
    expect(body).not.toContain('Protected Firm Information')
  })

  it('exposes CONSENT_7216 consent prefill values', async () => {
    const view = await toPublicView(
      activeClientNda({
        type: 'CONSENT_7216',
        templateVersion: 'consent-7216-v1',
        client: {
          id: 'client-1',
          firstName: 'Lan Consulting LLC',
          lastName: null,
          name: 'Lan Consulting LLC',
          clientType: 'BUSINESS',
        },
        signer: {
          id: 'client-1',
          firstName: 'Lan Consulting LLC',
          lastName: null,
          kind: 'client',
        },
      }) as any
    )

    expect(view.consentPrefill).toEqual({
      taxpayerName: 'Lan Consulting LLC',
      businessName: 'Lan Consulting LLC',
    })
  })

  it('builds firmSnapshot + clientSnapshot for v2 agreements with firm signature', async () => {
    mockGetSigned.mockResolvedValueOnce('https://r2.test/firm-sig.png')
    const view = await toPublicView(
      activeNda({
        templateVersion: 'v2',
        firmSignaturePngKey: 'agreement-firm-sigs/staff-1/abc.png',
        firmSignerName: 'Felix Howard',
        firmSignerTitle: 'Managing Partner, CPA',
        firmSignedAt: new Date('2026-05-06T17:00:00Z'),
        organization: {
          id: 'org-1',
          name: 'Acme Tax LLC',
          address: '10700 Richmond Ave Ste 117',
          city: 'Houston',
          state: 'TX',
          zip: '77042',
          governingState: 'Texas',
          governingCounty: 'Harris County',
        },
        client: null,
        lead: { id: 'lead-1', firstName: 'Jane', lastName: 'Doe', businessName: null },
      }) as any
    )
    expect(view.firmSnapshot).not.toBeNull()
    expect(view.firmSnapshot?.name).toBe('Acme Tax LLC')
    expect(view.firmSnapshot?.address).toContain('Houston')
    expect(view.firmSnapshot?.signerTitle).toBe('Managing Partner, CPA')
    expect(view.firmSnapshot?.signaturePresignedUrl).toBe('https://r2.test/firm-sig.png')
    expect(view.clientSnapshot?.clientType).toBe('INDIVIDUAL')
    expect(view.clientSnapshot?.nameOrBusiness).toBe('Jane Doe')
  })
})

describe('signNda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenPdf.mockResolvedValue(Buffer.from('%PDF-1.4\n...signed...'))
    mockGetSigned.mockResolvedValue('https://r2.test/signed/pdf')
  })

  const baseInput = {
    token: 'tok-abc',
    signerName: 'Jane Doe',
    signerTitle: 'Manager',
    signaturePngDataUrl: VALID_PNG_DATA_URL,
    ip: '203.0.113.1',
    userAgent: 'Mozilla/5.0 Test',
  }

  it('marks NDA SIGNED, uploads signature + PDF, returns download URL', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

    const result = await signNda(baseInput)

    expect(result.status).toBe('SIGNED')
    expect(result.downloadUrl).toBe('https://r2.test/signed/pdf')
    expect(result.signedAt).toBeInstanceOf(Date)

    // Upload invoked twice: PNG first, PDF second
    expect(mockUpload).toHaveBeenCalledTimes(2)
    const [pngCall, pdfCall] = mockUpload.mock.calls
    expect(pngCall[0]).toMatch(/signature\.png$/)
    expect(pngCall[2]).toBe('image/png')
    expect(pdfCall[0]).toMatch(/signed\.pdf$/)
    expect(pdfCall[2]).toBe('application/pdf')

    // Transactional guard: WHERE status=SENT AND isActive=true
    const updateArgs = mockUpdateMany.mock.calls[0][0] as any
    expect(updateArgs.where).toMatchObject({
      id: 'nda-1',
      status: 'SENT',
      isActive: true,
    })
    expect(updateArgs.data).toMatchObject({
      status: 'SIGNED',
      signerName: 'Jane Doe',
      clientAuthRepTitle: 'Manager',
      signerIpAddress: '203.0.113.1',
      signerUserAgent: 'Mozilla/5.0 Test',
      isActive: false,
    })
    expect(mockCreateDepositPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'nda-1',
        title: 'Non-Disclosure Agreement',
        organizationId: 'org-1',
        createdByUserId: 'staff-1',
        depositAmount: '300.00',
        depositStatus: 'PENDING',
      })
    )
  })

  it.each([
    {
      type: 'ENGAGEMENT_LETTER',
      title: '2026 Engagement Letter',
      contentHtml: '<p>Engagement terms</p>',
    },
    {
      type: 'SERVICE_AGREEMENT',
      title: 'Monthly Advisory Service Agreement',
      contentHtml: '<p>Service agreement terms</p>',
    },
    {
      type: 'CUSTOM',
      title: 'Custom Tax Advisory Agreement',
      contentHtml: '<p>Custom agreement terms</p>',
    },
  ])(
    'dispatches the initial-payment hook for signed $type inline agreements',
    async ({ type, title, contentHtml }) => {
      mockFindUnique.mockResolvedValueOnce(
        activeNda({
          id: `agr-${type.toLowerCase().replaceAll('_', '-')}`,
          type,
          title,
          customContentHtml: contentHtml,
          depositAmount: '750.00',
          depositStatus: 'PENDING',
        }) as any
      )
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      await signAgreement(baseInput)

      expect(mockCreateDepositPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `agr-${type.toLowerCase().replaceAll('_', '-')}`,
          title,
          depositAmount: '750.00',
          depositStatus: 'PENDING',
          signer: expect.objectContaining({ id: 'lead-1', kind: 'lead' }),
        })
      )
    }
  )

  it('persists consent taxpayer fields only for CONSENT_7216 signing', async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeClientNda({
        id: 'agreement-consent-7216',
        type: 'CONSENT_7216',
        title: 'Consent to Disclosure',
        depositAmount: null,
        depositStatus: null,
      }) as any
    )
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

    await signAgreement({
      ...baseInput,
      taxpayerName: 'Lan Nguyen',
      businessName: 'Lan Consulting LLC',
      tinLastFour: '1234',
      consentSignerTitle: 'Owner',
    })

    const updateArgs = mockUpdateMany.mock.calls[0][0] as any
    expect(updateArgs.data).toMatchObject({
      signerName: 'Jane Doe',
      clientAuthRepTitle: 'Owner',
      consentTaxpayerName: 'Lan Nguyen',
      consentBusinessName: 'Lan Consulting LLC',
      consentTinLastFour: '1234',
    })
    expect(mockGenPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        agreement: expect.objectContaining({ type: 'CONSENT_7216' }),
        consentFields: {
          taxpayerName: 'Lan Nguyen',
          businessName: 'Lan Consulting LLC',
          tinLastFour: '1234',
          signerTitle: 'Owner',
        },
      })
    )
    expect(mockCreateDepositPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agreement-consent-7216',
        depositAmount: null,
        depositStatus: null,
      })
    )
  })

  it('ignores consent taxpayer fields for non-consent signing', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

    await signAgreement({
      ...baseInput,
      taxpayerName: 'Jane Doe',
      businessName: 'Doe Consulting LLC',
      tinLastFour: '1234',
      consentSignerTitle: 'Owner',
    })

    const updateArgs = mockUpdateMany.mock.calls[0][0] as any
    expect(updateArgs.data).not.toHaveProperty('consentTaxpayerName')
    expect(updateArgs.data).not.toHaveProperty('consentBusinessName')
    expect(updateArgs.data).not.toHaveProperty('consentTinLastFour')
    expect(mockGenPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        agreement: expect.objectContaining({ type: 'NDA' }),
        consentFields: undefined,
      })
    )
  })

  it('rejects CONSENT_7216 signing without taxpayer name before upload', async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeClientNda({
        id: 'agreement-consent-7216',
        type: 'CONSENT_7216',
        title: 'Consent to Disclosure',
      }) as any
    )

    await expect(
      signAgreement({
        ...baseInput,
        taxpayerName: ' ',
        tinLastFour: '1234',
      })
    ).rejects.toMatchObject({ status: 400 })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('rejects CONSENT_7216 signing without a four-digit TIN suffix', async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeClientNda({
        id: 'agreement-consent-7216',
        type: 'CONSENT_7216',
        title: 'Consent to Disclosure',
      }) as any
    )

    await expect(
      signAgreement({
        ...baseInput,
        taxpayerName: 'Lan Nguyen',
        tinLastFour: '12A4',
      })
    ).rejects.toMatchObject({ status: 400 })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('rejects full TIN values for CONSENT_7216 signing', async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeClientNda({
        id: 'agreement-consent-7216',
        type: 'CONSENT_7216',
        title: 'Consent to Disclosure',
      }) as any
    )

    await expect(
      signAgreement({
        ...baseInput,
        taxpayerName: 'Lan Nguyen',
        tinLastFour: '123456789',
      })
    ).rejects.toMatchObject({ status: 400 })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('rejects oversized CONSENT_7216 taxpayer fields before upload', async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeClientNda({
        id: 'agreement-consent-7216',
        type: 'CONSENT_7216',
        title: 'Consent to Disclosure',
      }) as any
    )

    await expect(
      signAgreement({
        ...baseInput,
        taxpayerName: 'A'.repeat(161),
        businessName: 'B'.repeat(201),
        tinLastFour: '1234',
      })
    ).rejects.toMatchObject({ status: 400 })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('uses nonced keys (unique per attempt) for R2 uploads', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
    await signNda(baseInput)
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
    await signNda(baseInput)

    const [firstPng] = mockUpload.mock.calls[0]
    const [secondPng] = mockUpload.mock.calls[2]
    expect(firstPng).not.toBe(secondPng)
    expect(firstPng).toMatch(/leads\/lead-1\/nda\/nda-1-[a-z0-9]{10}-signature\.png/)
  })

  it('returns 404 when token unknown', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    await expect(signNda(baseInput)).rejects.toMatchObject({ status: 404 })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 409 when NDA status is not SENT (already SIGNED)', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda({ status: 'SIGNED' }) as any)
    await expect(signNda(baseInput)).rejects.toMatchObject({ status: 409 })
  })

  it('returns 409 when isActive is false (token rotated / disabled)', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda({ isActive: false }) as any)
    await expect(signNda(baseInput)).rejects.toMatchObject({ status: 409 })
  })

  it('returns 410 when NDA is expired', async () => {
    mockFindUnique.mockResolvedValueOnce(
      activeNda({ expiresAt: new Date('2020-01-01T00:00:00Z') }) as any
    )
    await expect(signNda(baseInput)).rejects.toMatchObject({ status: 410 })
  })

  it('returns 409 when concurrent writer wins race (updateMany count=0)', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    mockUpdateMany.mockResolvedValueOnce({ count: 0 } as any)
    await expect(signNda(baseInput)).rejects.toMatchObject({ status: 409 })
    // Upload attempted but DB row unchanged — orphaned R2 object tolerated per service comment
    expect(mockUpload).toHaveBeenCalled()
  })

  it('rejects non-PNG signature data URL (400)', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    await expect(
      signNda({ ...baseInput, signaturePngDataUrl: 'data:image/jpeg;base64,AAAA' })
    ).rejects.toMatchObject({ status: 400 })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('rejects payload without PNG magic bytes (400)', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    const junk = 'data:image/png;base64,' + Buffer.from('not-a-png-yikes').toString('base64')
    await expect(signNda({ ...baseInput, signaturePngDataUrl: junk })).rejects.toMatchObject({
      status: 400,
    })
  })

  it('passes signerName, IP, UA, and PNG buffer into PDF generator', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

    await signNda(baseInput)

    expect(mockGenPdf).toHaveBeenCalledTimes(1)
    const arg = mockGenPdf.mock.calls[0][0]
    expect(arg.signature.typedName).toBe('Jane Doe')
    expect(arg.signature.ipAddress).toBe('203.0.113.1')
    expect(arg.signature.userAgent).toBe('Mozilla/5.0 Test')
    expect(arg.signature.pngBuffer).toBeInstanceOf(Buffer)
    expect(arg.signature.pngBuffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true)
    expect(arg.lead).toEqual({ firstName: 'Jane', lastName: 'Doe' })
    expect(arg.organization).toEqual({ name: 'Acme Tax LLC' })
  })

  it('rejects missing signer title before upload', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    await expect(signNda({ ...baseInput, signerTitle: ' ' })).rejects.toMatchObject({
      status: 400,
    })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('uploads under clients/ prefix when NDA is client-scoped', async () => {
    mockFindUnique.mockResolvedValueOnce(activeClientNda() as any)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

    await signNda(baseInput)

    const [pngKey] = mockUpload.mock.calls[0]
    const [pdfKey] = mockUpload.mock.calls[1]
    expect(pngKey).toMatch(/^clients\/client-1\/nda\/nda-1-[a-z0-9]{10}-signature\.png$/)
    expect(pdfKey).toMatch(/^clients\/client-1\/nda\/nda-1-[a-z0-9]{10}-signed\.pdf$/)
  })
})
