/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    contractorAgreementAcceptance: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue({ key: 'stored', url: 'https://r2.test/contractor.pdf' }),
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.test/contractor.pdf'),
  deleteFile: vi.fn().mockResolvedValue(true),
  fetchImageBuffer: vi.fn().mockResolvedValue({
    buffer: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
    mimeType: 'image/png',
  }),
}))

vi.mock('../../../services/contractor-agreements/contractor-agreement-pdf', () => ({
  generateContractorAgreementPdf: vi
    .fn()
    .mockResolvedValue(Buffer.from('%PDF-1.7\nsigned contractor agreement')),
  sha256Hex: vi.fn().mockReturnValue('a'.repeat(64)),
}))

vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: any, next: () => Promise<void>) => next(),
}))

import { Hono } from 'hono'
import { Prisma } from '@ella/db'
import { prisma } from '../../../lib/db'
import {
  uploadFile,
  getSignedDownloadUrl,
  deleteFile,
  fetchImageBuffer,
} from '../../../services/storage'
import { generateContractorAgreementPdf } from '../../../services/contractor-agreements/contractor-agreement-pdf'
import type { AuthVariables } from '../../../middleware/auth'
import { contractorAgreementsRoute } from '../index'

const currentVersion = '2026.05.15'

function user(overrides: Partial<AuthVariables['user']> = {}): AuthVariables['user'] {
  return {
    id: 'clerk-1',
    staffId: 'staff-1',
    email: 'agent@test.com',
    name: 'Agent One',
    role: 'STAFF',
    organizationId: 'org-1',
    clerkOrgId: 'org-clerk-1',
    orgRole: 'org:member',
    ...overrides,
  }
}

function appWithUser(authUser = user()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', authUser)
    await next()
  })
  app.route('/contractor-agreements', contractorAgreementsRoute)
  return app
}

function signaturePngDataUrl() {
  return `data:image/png;base64,${Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')}`
}

function duplicateAcceptanceError() {
  const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype)
  return error
}

describe('Contractor agreement routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns required status for contractor agents', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      isContractorAgent: true,
      organization: {
        name: 'My Ella Team',
        address: '10700 Richmond Ave Ste 117',
        city: 'Houston',
        state: 'TX',
        zip: '77042',
        governingState: 'Texas',
        governingCounty: 'Harris County',
        firmPhone: '(878) 678-0999',
        firmEmail: 'myellatax@gmail.com',
        firmWebsite: 'http://ella.tax',
      },
    } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      version: currentVersion,
      signedAt: new Date('2026-05-15T00:00:00Z'),
    } as never)
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      name: 'Tuyet Duong',
      email: 'kaytax76@gmail.com',
      title: 'Owner',
      signaturePngKey: 'staff-signatures/admin/signature.png',
    } as never)

    const res = await appWithUser().request('/contractor-agreements/status')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      required: true,
      hasAccepted: true,
      currentVersion,
      acceptanceId: 'cmabc12345678901234567890',
      organization: {
        name: 'My Ella Team',
        address: '10700 Richmond Ave Ste 117',
        city: 'Houston',
        state: 'TX',
        zip: '77042',
        governingState: 'Texas',
        governingCounty: 'Harris County',
        firmPhone: '(878) 678-0999',
        firmEmail: 'myellatax@gmail.com',
        firmWebsite: 'http://ella.tax',
      },
      firmSigner: {
        name: 'Tuyet Duong',
        email: 'kaytax76@gmail.com',
        title: 'Owner',
        signatureUrl: 'https://r2.test/contractor.pdf',
      },
    })
    expect(getSignedDownloadUrl).toHaveBeenCalledWith('staff-signatures/admin/signature.png', 3600)
  })

  it('returns not required status for non-contractor staff', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ isContractorAgent: false } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce(null)

    const res = await appWithUser().request('/contractor-agreements/status')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      required: false,
      hasAccepted: false,
      currentVersion,
    })
  })

  it('rejects acceptance when staff is not marked contractor agent', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Agent One',
      email: 'agent@test.com',
      isContractorAgent: false,
    } as never)

    const res = await appWithUser().request('/contractor-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: currentVersion,
        signaturePngDataUrl: signaturePngDataUrl(),
      }),
    })

    expect(res.status).toBe(409)
    expect(vi.mocked(prisma.contractorAgreementAcceptance.create)).not.toHaveBeenCalled()
  })

  it('creates acceptance and uploads signed PDF for contractor agents', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Agent One',
      email: 'agent@test.com',
      isContractorAgent: true,
    } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      name: 'Tuyet Duong',
      email: 'kaytax76@gmail.com',
      title: 'Owner',
      signaturePngKey: 'staff-signatures/admin/signature.png',
    } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.create).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      version: currentVersion,
      signedAt: new Date('2026-05-15T00:00:00Z'),
      signerName: 'Agent One',
      signerEmail: 'agent@test.com',
      firmSignerName: 'Tuyet Duong',
      firmSignerEmail: 'kaytax76@gmail.com',
      firmSignerTitle: null,
    } as never)

    const res = await appWithUser().request('/contractor-agreements/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': '203.0.113.10',
        'user-agent': 'Vitest',
      },
      body: JSON.stringify({
        version: currentVersion,
        signaturePngDataUrl: signaturePngDataUrl(),
      }),
    })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe('cmabc12345678901234567890')
    expect(uploadFile).toHaveBeenCalledWith(
      expect.stringMatching(/^contractor-agreements\/org-1\/staff-1\/2026\.05\.15\/.+\.pdf$/),
      expect.any(Buffer),
      'application/pdf'
    )
    expect(fetchImageBuffer).toHaveBeenCalledWith('staff-signatures/admin/signature.png')
    expect(generateContractorAgreementPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        contractor: expect.objectContaining({
          name: 'Agent One',
          email: 'agent@test.com',
          signaturePngDataUrl: signaturePngDataUrl(),
        }),
        firmSigner: expect.objectContaining({
          name: 'Tuyet Duong',
          email: 'kaytax76@gmail.com',
        }),
      })
    )
    expect(vi.mocked(prisma.contractorAgreementAcceptance.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          signedPdfR2Key: expect.stringMatching(
            /^contractor-agreements\/org-1\/staff-1\/2026\.05\.15\/.+\.pdf$/
          ),
          signerName: 'Agent One',
          signerEmail: 'agent@test.com',
          firmSignerName: 'Tuyet Duong',
          firmSignerEmail: 'kaytax76@gmail.com',
          firmSignaturePngKey: 'staff-signatures/admin/signature.png',
          signerIpAddress: '203.0.113.10',
          signerUserAgent: 'Vitest',
        }),
      })
    )
  })

  it('returns existing acceptance without regenerating PDF when version is already signed', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Agent One',
      email: 'agent@test.com',
      isContractorAgent: true,
    } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      version: currentVersion,
      signedAt: new Date('2026-05-15T00:00:00Z'),
      signerName: 'Agent One',
      signerEmail: 'agent@test.com',
      firmSignerName: 'Tuyet Duong',
      firmSignerEmail: 'kaytax76@gmail.com',
      firmSignerTitle: 'Owner',
    } as never)

    const res = await appWithUser().request('/contractor-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: currentVersion, signaturePngDataUrl: signaturePngDataUrl() }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe('cmabc12345678901234567890')
    expect(generateContractorAgreementPdf).not.toHaveBeenCalled()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('does not create acceptance when storage is not configured', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Agent One',
      email: 'agent@test.com',
      isContractorAgent: true,
    } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      name: 'Tuyet Duong',
      email: 'kaytax76@gmail.com',
      title: 'Owner',
      signaturePngKey: 'staff-signatures/admin/signature.png',
    } as never)
    vi.mocked(uploadFile).mockResolvedValueOnce({ key: 'stored', url: null })

    const res = await appWithUser().request('/contractor-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: currentVersion, signaturePngDataUrl: signaturePngDataUrl() }),
    })

    expect(res.status).toBe(500)
    expect(vi.mocked(prisma.contractorAgreementAcceptance.create)).not.toHaveBeenCalled()
    expect(deleteFile).toHaveBeenCalledWith(
      expect.stringMatching(/^contractor-agreements\/org-1\/staff-1\/2026\.05\.15\/.+\.pdf$/)
    )
  })

  it('does not create acceptance when upload throws', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Agent One',
      email: 'agent@test.com',
      isContractorAgent: true,
    } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      name: 'Tuyet Duong',
      email: 'kaytax76@gmail.com',
      title: 'Owner',
      signaturePngKey: 'staff-signatures/admin/signature.png',
    } as never)
    vi.mocked(uploadFile).mockRejectedValueOnce(new Error('R2 down'))

    const res = await appWithUser().request('/contractor-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: currentVersion, signaturePngDataUrl: signaturePngDataUrl() }),
    })

    expect(res.status).toBe(500)
    expect(vi.mocked(prisma.contractorAgreementAcceptance.create)).not.toHaveBeenCalled()
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('rejects invalid PNG signatures before upload or acceptance creation', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Agent One',
      email: 'agent@test.com',
      isContractorAgent: true,
    } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      name: 'Tuyet Duong',
      email: 'kaytax76@gmail.com',
      title: 'Owner',
      signaturePngKey: 'staff-signatures/admin/signature.png',
    } as never)
    vi.mocked(generateContractorAgreementPdf).mockRejectedValueOnce(
      new Error('Signature image is not a valid PNG')
    )

    const res = await appWithUser().request('/contractor-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: currentVersion,
        signaturePngDataUrl: 'data:image/png;base64,bm90LXBuZw==',
      }),
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toMatchObject({
      error: 'PDF_GENERATION_FAILED',
      message: 'Signature image is not a valid PNG',
    })
    expect(uploadFile).not.toHaveBeenCalled()
    expect(vi.mocked(prisma.contractorAgreementAcceptance.create)).not.toHaveBeenCalled()
  })

  it('uses per-attempt PDF keys so duplicate cleanup cannot delete an accepted deterministic key', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Agent One',
      email: 'agent@test.com',
      isContractorAgent: true,
    } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      name: 'Tuyet Duong',
      email: 'kaytax76@gmail.com',
      title: 'Owner',
      signaturePngKey: 'staff-signatures/admin/signature.png',
    } as never)
    vi.mocked(prisma.contractorAgreementAcceptance.create).mockRejectedValueOnce(
      duplicateAcceptanceError()
    )
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      version: currentVersion,
      signedAt: new Date('2026-05-15T00:00:00Z'),
      signerName: 'Agent One',
      signerEmail: 'agent@test.com',
      firmSignerName: 'Tuyet Duong',
      firmSignerEmail: 'kaytax76@gmail.com',
      firmSignerTitle: 'Owner',
    } as never)

    const res = await appWithUser().request('/contractor-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: currentVersion, signaturePngDataUrl: signaturePngDataUrl() }),
    })

    expect(res.status).toBe(200)
    const uploadedKey = vi.mocked(uploadFile).mock.calls[0][0]
    expect(uploadedKey).toMatch(/^contractor-agreements\/org-1\/staff-1\/2026\.05\.15\/.+\.pdf$/)
    expect(uploadedKey).not.toBe('contractor-agreements/org-1/staff-1/2026.05.15.pdf')
    expect(deleteFile).toHaveBeenCalledWith(uploadedKey)
    expect(deleteFile).not.toHaveBeenCalledWith(
      'contractor-agreements/org-1/staff-1/2026.05.15.pdf'
    )
  })

  it('rejects signer metadata supplied by caller schema', async () => {
    const res = await appWithUser().request('/contractor-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: currentVersion,
        signaturePngDataUrl: signaturePngDataUrl(),
        signerName: 'Someone Else',
        firmSignerName: 'Fake Firm Signer',
      }),
    })

    expect(res.status).toBe(400)
    expect(vi.mocked(prisma.contractorAgreementAcceptance.create)).not.toHaveBeenCalled()
  })

  it('forbids non-admin download of another staff acceptance', async () => {
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      staffId: 'staff-2',
      organizationId: 'org-1',
      signedPdfR2Key: 'contractor-agreements/org-1/staff-2/2026.05.15.pdf',
    } as never)

    const res = await appWithUser().request(
      '/contractor-agreements/download/cmabc12345678901234567890'
    )

    expect(res.status).toBe(403)
    expect(getSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('allows staff to download their own acceptance', async () => {
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      staffId: 'staff-1',
      organizationId: 'org-1',
      signedPdfR2Key: 'contractor-agreements/org-1/staff-1/2026.05.15.pdf',
    } as never)

    const res = await appWithUser().request(
      '/contractor-agreements/download/cmabc12345678901234567890'
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toBe('https://r2.test/contractor.pdf')
    expect(getSignedDownloadUrl).toHaveBeenCalledWith(
      'contractor-agreements/org-1/staff-1/2026.05.15.pdf',
      3600
    )
  })

  it('allows org admin to download org acceptance', async () => {
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      staffId: 'staff-2',
      organizationId: 'org-1',
      signedPdfR2Key: 'contractor-agreements/org-1/staff-2/2026.05.15.pdf',
    } as never)

    const res = await appWithUser(user({ role: 'ADMIN', orgRole: 'org:admin' })).request(
      '/contractor-agreements/download/cmabc12345678901234567890'
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toBe('https://r2.test/contractor.pdf')
  })

  it('hides cross-org acceptances from org admins', async () => {
    vi.mocked(prisma.contractorAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      staffId: 'staff-2',
      organizationId: 'org-2',
      signedPdfR2Key: 'contractor-agreements/org-2/staff-2/2026.05.15.pdf',
    } as never)

    const res = await appWithUser(user({ role: 'ADMIN', orgRole: 'org:admin' })).request(
      '/contractor-agreements/download/cmabc12345678901234567890'
    )

    expect(res.status).toBe(404)
    expect(getSignedDownloadUrl).not.toHaveBeenCalled()
  })
})
