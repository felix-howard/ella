import { describe, expect, it } from 'vitest'
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import {
  decodeContractorSignaturePng,
  generateContractorAgreementPdf,
  loadContractorAgreementTemplate,
  sha256Hex,
} from '../contractor-agreement-pdf'

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
)

function pngDataUrl(buffer = ONE_PIXEL_PNG): string {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

function pageImageCount(doc: PDFDocument, pageIndex: number): number {
  const resources = doc.getPage(pageIndex).node.Resources()
  const xObjectRef = resources?.get(PDFName.of('XObject'))
  if (!xObjectRef) return 0
  const xObject = resources?.context.lookup(xObjectRef, PDFDict)
  return xObject?.keys().length ?? 0
}

describe('contractor agreement PDF generation', () => {
  it('overlays firm and contractor signatures onto the source template', async () => {
    const pdf = await generateContractorAgreementPdf({
      contractor: {
        name: 'Agent One',
        email: 'agent@test.com',
        signaturePngDataUrl: pngDataUrl(),
      },
      firmSigner: {
        name: 'TUYET DUONG',
        email: 'kaytax76@gmail.com',
        title: 'Owner',
        signaturePngBuffer: ONE_PIXEL_PNG,
      },
      signedAt: new Date('2026-05-15T00:00:00Z'),
    })

    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF')
    const [templateDoc, signedDoc] = await Promise.all([
      loadContractorAgreementTemplate().then((bytes) => PDFDocument.load(bytes)),
      PDFDocument.load(pdf),
    ])
    expect(signedDoc.getPageCount()).toBe(12)
    expect(pageImageCount(signedDoc, 10) - pageImageCount(templateDoc, 10)).toBe(2)
    expect(sha256Hex(pdf)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects non-PNG signature data URLs', () => {
    expect(() => decodeContractorSignaturePng('data:text/plain;base64,SGk='))
      .toThrow('Invalid signature image format')
  })
})
