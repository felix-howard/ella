/**
 * Unit tests for the public signing service.
 * Verifies load, view rendering, and sign flow with concurrency + expiry.
 * Prisma, storage, and PDF generator are mocked.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    ndaAgreement: {
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

import { prisma } from '../../../lib/db'
import { uploadFile, getSignedDownloadUrl } from '../../storage'
import { generateSignedPdf } from '../pdf-generator'
import { loadNdaByToken, toPublicView, signNda } from '../nda-signing-service'

const mockFindUnique = vi.mocked(prisma.ndaAgreement.findUnique)
const mockUpdateMany = vi.mocked(prisma.ndaAgreement.updateMany)
const mockUpload = vi.mocked(uploadFile)
const mockGetSigned = vi.mocked(getSignedDownloadUrl)
const mockGenPdf = vi.mocked(generateSignedPdf)

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const VALID_PNG_DATA_URL =
  'data:image/png;base64,' + Buffer.concat([PNG_MAGIC, Buffer.from('sig-bytes')]).toString('base64')

function activeNda(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nda-1',
    leadId: 'lead-1',
    organizationId: 'org-1',
    token: 'tok-abc',
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

describe('loadNdaByToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries by unique token with lead + org includes', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    const nda = await loadNdaByToken('tok-abc')
    expect(nda?.id).toBe('nda-1')
    const call = mockFindUnique.mock.calls[0][0] as any
    expect(call.where).toEqual({ token: 'tok-abc' })
    expect(call.include.lead).toBeDefined()
    expect(call.include.organization).toBeDefined()
  })

  it('returns null when token is unknown', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await loadNdaByToken('bad')).toBeNull()
  })
})

describe('toPublicView', () => {
  it('renders template sections with full name + org + deposit', () => {
    const view = toPublicView(activeNda() as any)
    expect(view.status).toBe('SENT')
    expect(view.expired).toBe(false)
    expect(view.orgName).toBe('Acme Tax LLC')
    expect(view.leadFirstName).toBe('Jane')
    expect(view.depositAmount).toBe('$300.00')
    expect(view.templateVersion).toBe('v1')
    expect(view.templateTitle).toBe('Non-Disclosure Agreement')
    expect(view.templateSections.length).toBeGreaterThan(0)
    const body = JSON.stringify(view.templateSections)
    expect(body).toContain('Jane Doe')
    expect(body).toContain('Acme Tax LLC')
  })

  it('flags expired=true when expiresAt is in the past', () => {
    const view = toPublicView(
      activeNda({ expiresAt: new Date('2020-01-01T00:00:00Z') }) as any,
    )
    expect(view.expired).toBe(true)
  })

  it('handles missing last name gracefully', () => {
    const view = toPublicView(
      activeNda({
        lead: { id: 'lead-1', firstName: 'Jane', lastName: '' },
      }) as any,
    )
    const body = JSON.stringify(view.templateSections)
    expect(body).toContain('Jane')
    // Shouldn't contain a stray trailing space-only token
    expect(body).not.toContain('Jane  ')
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
      signerIpAddress: '203.0.113.1',
      signerUserAgent: 'Mozilla/5.0 Test',
      isActive: false,
    })
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
      activeNda({ expiresAt: new Date('2020-01-01T00:00:00Z') }) as any,
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
      signNda({ ...baseInput, signaturePngDataUrl: 'data:image/jpeg;base64,AAAA' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('rejects payload without PNG magic bytes (400)', async () => {
    mockFindUnique.mockResolvedValueOnce(activeNda() as any)
    const junk = 'data:image/png;base64,' + Buffer.from('not-a-png-yikes').toString('base64')
    await expect(
      signNda({ ...baseInput, signaturePngDataUrl: junk }),
    ).rejects.toMatchObject({ status: 400 })
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
})
