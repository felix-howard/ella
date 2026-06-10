/**
 * Signing flow for the upload-your-own-PDF path: the uploaded source PDF is kept
 * intact and a generated Acceptance & Signature page is appended. pdf-lib +
 * react-pdf run for real; only prisma + storage are mocked.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import type * as PdfSignaturePageModule from '../pdf-signature-page'

vi.mock('../../../lib/db', () => ({
  prisma: {
    agreement: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}))

vi.mock('../../storage', () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.test/signed'),
  fetchImageBuffer: vi.fn().mockResolvedValue(null),
  fetchFileBuffer: vi.fn(),
}))

vi.mock('../pdf-signature-page', async (importOriginal) => {
  const actual = await importOriginal<typeof PdfSignaturePageModule>()
  return {
    ...actual,
    generateSignaturePagePdf: vi.fn(actual.generateSignaturePagePdf),
  }
})

vi.mock('../agreement-post-sign-notifications', () => ({
  notifyAdminsAgreementSigned: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../payments/deposit-payment-service', () => ({
  createDepositPaymentForAgreement: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '../../../lib/db'
import { uploadFile, fetchFileBuffer } from '../../storage'
import { generateSignaturePagePdf } from '../pdf-signature-page'
import { createDepositPaymentForAgreement } from '../../payments/deposit-payment-service'
import { signAgreement } from '../agreement-signing-service'
import { countPdfPages } from '../pdf-merge'

const mockFindUnique = vi.mocked(prisma.agreement.findUnique)
const mockUpdateMany = vi.mocked(prisma.agreement.updateMany)
const mockUpload = vi.mocked(uploadFile)
const mockFetchFile = vi.mocked(fetchFileBuffer)
const mockGenerateSignaturePagePdf = vi.mocked(generateSignaturePagePdf)
const mockCreateDepositPayment = vi.mocked(createDepositPaymentForAgreement)

const VALID_PNG_DATA_URL =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

async function makeBasePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([612, 792])
  return Buffer.from(await doc.save())
}

function uploadedAgreement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agr-1',
    leadId: null,
    clientId: 'client-1',
    organizationId: 'org-1',
    token: 'tok-1',
    status: 'SENT',
    isActive: true,
    type: 'ENGAGEMENT_LETTER',
    title: 'Engagement Agreement',
    createdByUserId: 'staff-1',
    templateVersion: 'engagement-letter-v1',
    customContentHtml: null,
    uploadedPdfKey: 'agreements/uploads/client-1/abc.pdf',
    depositAmount: '500.00',
    depositStatus: 'PENDING',
    expiresAt: new Date('2030-01-01T00:00:00Z'),
    createdAt: new Date('2026-06-01T00:00:00Z'),
    firmSignaturePngKey: 'agreement-firm-sigs/staff-1/x.png',
    firmSignerName: 'Tuyet Nguyen',
    firmSignerTitle: 'CPA',
    firmSignedAt: new Date('2026-06-01T00:00:00Z'),
    lead: null,
    client: { id: 'client-1', firstName: 'Lan', lastName: 'Nguyen', clientType: 'INDIVIDUAL' },
    organization: { id: 'org-1', name: 'Ella Tax LLC' },
    signer: { id: 'client-1', firstName: 'Lan', lastName: 'Nguyen', kind: 'client' },
    ...overrides,
  }
}

describe('signAgreement — uploaded PDF path', () => {
  beforeEach(() => vi.clearAllMocks())

  it('appends a signature page to the uploaded PDF and stores it', async () => {
    mockFindUnique.mockResolvedValueOnce(uploadedAgreement() as any)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
    mockFetchFile.mockResolvedValueOnce(await makeBasePdf(2))

    const result = await signAgreement({
      token: 'tok-1',
      signerName: 'Lan Nguyen',
      signerTitle: 'Owner',
      signaturePngDataUrl: VALID_PNG_DATA_URL,
      ip: '1.2.3.4',
      userAgent: 'vitest',
    })

    expect(result.status).toBe('SIGNED')
    // fetched the uploaded source PDF
    expect(mockFetchFile).toHaveBeenCalledWith('agreements/uploads/client-1/abc.pdf')

    // second uploadFile call is the signed PDF — 2 base pages + 1 appended page
    const pdfUpload = mockUpload.mock.calls.find((c) => c[2] === 'application/pdf')
    expect(pdfUpload).toBeDefined()
    const storedPdf = pdfUpload![1] as Buffer
    expect(await countPdfPages(storedPdf)).toBe(3)
    expect(mockGenerateSignaturePagePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        documentTitle: 'Engagement Agreement',
        depositAmountLabel: '$500.00',
      }),
    )
    expect(mockCreateDepositPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agr-1',
        title: 'Engagement Agreement',
        createdByUserId: 'staff-1',
        depositAmount: '500.00',
        depositStatus: 'PENDING',
        signer: expect.objectContaining({ id: 'client-1', kind: 'client' }),
      }),
    )
  })

  it('errors when the uploaded source PDF cannot be loaded', async () => {
    mockFindUnique.mockResolvedValueOnce(uploadedAgreement() as any)
    mockFetchFile.mockResolvedValueOnce(null)

    await expect(
      signAgreement({
        token: 'tok-1',
        signerName: 'Lan Nguyen',
        signerTitle: 'Owner',
        signaturePngDataUrl: VALID_PNG_DATA_URL,
        ip: '1.2.3.4',
        userAgent: 'vitest',
      }),
    ).rejects.toMatchObject({ status: 502 })
  })
})
