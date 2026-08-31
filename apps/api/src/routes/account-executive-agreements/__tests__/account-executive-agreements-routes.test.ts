/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    accountExecutiveAgreementAcceptance: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue({ key: 'stored', url: 'https://r2.test/account-executive.pdf' }),
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.test/account-executive.pdf'),
  deleteFile: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../services/account-executive-agreements/account-executive-agreement-pdf', () => ({
  generateAccountExecutiveAgreementPdf: vi
    .fn()
    .mockResolvedValue(Buffer.from('%PDF-1.7\nsigned account executive agreement')),
  sha256Hex: vi.fn().mockReturnValue('a'.repeat(64)),
}))

vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: any, next: () => Promise<void>) => next(),
}))

import { Hono } from 'hono'
import { Prisma } from '@ella/db'
import { prisma } from '../../../lib/db'
import { uploadFile, getSignedDownloadUrl, deleteFile } from '../../../services/storage'
import { generateAccountExecutiveAgreementPdf } from '../../../services/account-executive-agreements/account-executive-agreement-pdf'
import type { AuthVariables } from '../../../middleware/auth'
import { accountExecutiveAgreementsRoute } from '../index'

const currentVersion = '2026.08.31'
const keyPattern = /^account-executive-agreements\/org-1\/staff-1\/2026\.08\.31\/.+\.pdf$/

function user(overrides: Partial<AuthVariables['user']> = {}): AuthVariables['user'] {
  return {
    id: 'clerk-1',
    staffId: 'staff-1',
    email: 'manager@test.com',
    name: 'Manager One',
    role: 'MANAGER',
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
  app.route('/account-executive-agreements', accountExecutiveAgreementsRoute)
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

describe('Account executive agreement routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns required status for managers', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      name: 'Manager One',
      role: 'MANAGER',
      organization: { name: 'Ella Tax Services LLC' },
    } as never)
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      version: currentVersion,
      signedAt: new Date('2026-08-31T00:00:00Z'),
    } as never)

    const res = await appWithUser().request('/account-executive-agreements/status')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      required: true,
      hasAccepted: true,
      currentVersion,
      acceptanceId: 'cmabc12345678901234567890',
      organizationName: 'Ella Tax Services LLC',
      signerName: 'Manager One',
    })
  })

  it('returns not required status for non-manager staff', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      name: 'Staff One',
      role: 'STAFF',
      organization: { name: 'Ella Tax Services LLC' },
    } as never)
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce(null)

    const res = await appWithUser(user({ role: 'STAFF' })).request(
      '/account-executive-agreements/status',
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ required: false, hasAccepted: false, currentVersion })
  })

  it('rejects acceptance when staff is not a manager', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Staff One',
      email: 'staff@test.com',
      role: 'STAFF',
      organization: { name: 'Ella Tax Services LLC' },
    } as never)

    const res = await appWithUser(user({ role: 'STAFF' })).request(
      '/account-executive-agreements/accept',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: currentVersion, signaturePngDataUrl: signaturePngDataUrl() }),
      },
    )

    expect(res.status).toBe(409)
    expect(vi.mocked(prisma.accountExecutiveAgreementAcceptance.create)).not.toHaveBeenCalled()
  })

  it('rejects acceptance with an outdated version', async () => {
    const res = await appWithUser().request('/account-executive-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: '2000.01.01', signaturePngDataUrl: signaturePngDataUrl() }),
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toMatchObject({ error: 'VERSION_MISMATCH' })
    expect(vi.mocked(prisma.accountExecutiveAgreementAcceptance.create)).not.toHaveBeenCalled()
  })

  it('creates acceptance and uploads signed PDF for managers', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Manager One',
      email: 'manager@test.com',
      role: 'MANAGER',
      organization: { name: 'Ella Tax Services LLC' },
    } as never)
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.create).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      version: currentVersion,
      signedAt: new Date('2026-08-31T00:00:00Z'),
      signerName: 'Manager One',
      signerEmail: 'manager@test.com',
    } as never)

    const res = await appWithUser().request('/account-executive-agreements/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': '203.0.113.10',
        'user-agent': 'Vitest',
      },
      body: JSON.stringify({ version: currentVersion, signaturePngDataUrl: signaturePngDataUrl() }),
    })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe('cmabc12345678901234567890')
    expect(uploadFile).toHaveBeenCalledWith(
      expect.stringMatching(keyPattern),
      expect.any(Buffer),
      'application/pdf',
    )
    expect(generateAccountExecutiveAgreementPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Ella Tax Services LLC',
        signerName: 'Manager One',
        signerEmail: 'manager@test.com',
        signaturePngDataUrl: signaturePngDataUrl(),
      }),
    )
    expect(vi.mocked(prisma.accountExecutiveAgreementAcceptance.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          signedPdfR2Key: expect.stringMatching(keyPattern),
          signerName: 'Manager One',
          signerEmail: 'manager@test.com',
          signerIpAddress: '203.0.113.10',
          signerUserAgent: 'Vitest',
        }),
      }),
    )
  })

  it('returns existing acceptance without regenerating PDF when already signed', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Manager One',
      email: 'manager@test.com',
      role: 'MANAGER',
      organization: { name: 'Ella Tax Services LLC' },
    } as never)
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      version: currentVersion,
      signedAt: new Date('2026-08-31T00:00:00Z'),
      signerName: 'Manager One',
      signerEmail: 'manager@test.com',
    } as never)

    const res = await appWithUser().request('/account-executive-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: currentVersion, signaturePngDataUrl: signaturePngDataUrl() }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe('cmabc12345678901234567890')
    expect(generateAccountExecutiveAgreementPdf).not.toHaveBeenCalled()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('does not create acceptance when storage is not configured', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Manager One',
      email: 'manager@test.com',
      role: 'MANAGER',
      organization: { name: 'Ella Tax Services LLC' },
    } as never)
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(uploadFile).mockResolvedValueOnce({ key: 'stored', url: null })

    const res = await appWithUser().request('/account-executive-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: currentVersion, signaturePngDataUrl: signaturePngDataUrl() }),
    })

    expect(res.status).toBe(500)
    expect(vi.mocked(prisma.accountExecutiveAgreementAcceptance.create)).not.toHaveBeenCalled()
    expect(deleteFile).toHaveBeenCalledWith(expect.stringMatching(keyPattern))
  })

  it('rejects invalid PNG signatures before upload or acceptance creation', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Manager One',
      email: 'manager@test.com',
      role: 'MANAGER',
      organization: { name: 'Ella Tax Services LLC' },
    } as never)
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(generateAccountExecutiveAgreementPdf).mockRejectedValueOnce(
      new Error('Signature image is not a valid PNG'),
    )

    const res = await appWithUser().request('/account-executive-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: currentVersion,
        signaturePngDataUrl: 'data:image/png;base64,bm90LXBuZw==',
      }),
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toMatchObject({ error: 'PDF_GENERATION_FAILED' })
    expect(uploadFile).not.toHaveBeenCalled()
    expect(vi.mocked(prisma.accountExecutiveAgreementAcceptance.create)).not.toHaveBeenCalled()
  })

  it('returns existing acceptance on duplicate create with a per-attempt key', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff-1',
      name: 'Manager One',
      email: 'manager@test.com',
      role: 'MANAGER',
      organization: { name: 'Ella Tax Services LLC' },
    } as never)
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.create).mockRejectedValueOnce(
      duplicateAcceptanceError(),
    )
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      version: currentVersion,
      signedAt: new Date('2026-08-31T00:00:00Z'),
      signerName: 'Manager One',
      signerEmail: 'manager@test.com',
    } as never)

    const res = await appWithUser().request('/account-executive-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: currentVersion, signaturePngDataUrl: signaturePngDataUrl() }),
    })

    expect(res.status).toBe(200)
    const uploadedKey = vi.mocked(uploadFile).mock.calls[0][0]
    expect(uploadedKey).toMatch(keyPattern)
    expect(deleteFile).toHaveBeenCalledWith(uploadedKey)
  })

  it('rejects extra fields supplied by caller schema', async () => {
    const res = await appWithUser().request('/account-executive-agreements/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: currentVersion,
        signaturePngDataUrl: signaturePngDataUrl(),
        signerName: 'Someone Else',
      }),
    })

    expect(res.status).toBe(400)
    expect(vi.mocked(prisma.accountExecutiveAgreementAcceptance.create)).not.toHaveBeenCalled()
  })

  it('returns NOT_ACCEPTED when no acceptance exists', async () => {
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findFirst).mockResolvedValueOnce(null)

    const res = await appWithUser().request('/account-executive-agreements/acceptance/me')
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toMatchObject({ error: 'NOT_ACCEPTED' })
  })

  it('forbids non-admin/manager from reading another staff acceptance', async () => {
    const res = await appWithUser(user({ role: 'STAFF' })).request(
      '/account-executive-agreements/acceptance/cmabc12345678901234567890',
    )

    expect(res.status).toBe(403)
    expect(vi.mocked(prisma.accountExecutiveAgreementAcceptance.findFirst)).not.toHaveBeenCalled()
  })

  it('forbids non-owner non-admin download', async () => {
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      staffId: 'staff-2',
      organizationId: 'org-1',
      signedPdfR2Key: 'account-executive-agreements/org-1/staff-2/2026.08.31/x.pdf',
    } as never)

    const res = await appWithUser(user({ role: 'STAFF' })).request(
      '/account-executive-agreements/download/cmabc12345678901234567890',
    )

    expect(res.status).toBe(403)
    expect(getSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('allows staff to download their own acceptance', async () => {
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      staffId: 'staff-1',
      organizationId: 'org-1',
      signedPdfR2Key: 'account-executive-agreements/org-1/staff-1/2026.08.31/x.pdf',
    } as never)

    const res = await appWithUser().request(
      '/account-executive-agreements/download/cmabc12345678901234567890',
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toBe('https://r2.test/account-executive.pdf')
  })

  it('allows org admin to download org acceptance and hides cross-org', async () => {
    vi.mocked(prisma.accountExecutiveAgreementAcceptance.findUnique).mockResolvedValueOnce({
      id: 'cmabc12345678901234567890',
      staffId: 'staff-2',
      organizationId: 'org-2',
      signedPdfR2Key: 'account-executive-agreements/org-2/staff-2/2026.08.31/x.pdf',
    } as never)

    const res = await appWithUser(user({ role: 'ADMIN', orgRole: 'org:admin' })).request(
      '/account-executive-agreements/download/cmabc12345678901234567890',
    )

    expect(res.status).toBe(404)
    expect(getSignedDownloadUrl).not.toHaveBeenCalled()
  })
})
