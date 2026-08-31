import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  decodeSignaturePng,
  generateAccountExecutiveAgreementPdf,
  sha256Hex,
} from '../account-executive-agreement-pdf'

// Valid 1x1 PNG.
const validPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('account executive agreement PDF', () => {
  it('generates a valid PDF from the agreement content', async () => {
    const buffer = await generateAccountExecutiveAgreementPdf({
      companyName: 'Ella Tax Services LLC',
      signerName: 'Jane Q. Manager',
      signerEmail: 'jane@ella.tax',
      signaturePngDataUrl: validPng,
      signedAt: new Date('2026-08-31T00:00:00Z'),
    })

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    const doc = await PDFDocument.load(buffer)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('produces a deterministic sha256 for identical bytes', () => {
    const bytes = Buffer.from('account-executive-agreement')
    expect(sha256Hex(bytes)).toBe(sha256Hex(Buffer.from('account-executive-agreement')))
    expect(sha256Hex(bytes)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('rejects a non-PNG signature payload', () => {
    expect(() => decodeSignaturePng('data:image/png;base64,bm90LXBuZw==')).toThrow(
      /not a valid PNG/,
    )
  })

  it('rejects a non-PNG data URL prefix', () => {
    expect(() => decodeSignaturePng('data:image/jpeg;base64,abcd')).toThrow(
      /Invalid signature image format/,
    )
  })
})
