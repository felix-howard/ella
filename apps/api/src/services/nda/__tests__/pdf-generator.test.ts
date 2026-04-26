/**
 * Phase 07 fills in full test coverage. This stub proves the module wires up
 * and produces a valid PDF byte stream.
 */
import { describe, expect, it } from 'vitest'
import { generateSignedPdf, type GenerateSignedPdfInput } from '../pdf-generator'

// 1x1 transparent PNG (valid minimal PNG for signature placeholder).
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

function buildInput(overrides: Partial<GenerateSignedPdfInput> = {}): GenerateSignedPdfInput {
  const signedAt = new Date('2026-04-23T12:00:00Z')
  return {
    ndaAgreement: { templateVersion: 'v1', depositAmount: '300.00' },
    lead: { firstName: 'Jane', lastName: 'Doe' },
    organization: { name: 'Acme Tax LLC' },
    signature: {
      pngBuffer: TRANSPARENT_PNG,
      typedName: 'Jane Doe',
      ipAddress: '203.0.113.42',
      userAgent: 'Mozilla/5.0 Test',
      signedAt,
    },
    ...overrides,
  }
}

describe('generateSignedPdf', () => {
  it('produces a PDF buffer with the %PDF- magic header', async () => {
    const buffer = await generateSignedPdf(buildInput())

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('is byte-deterministic for identical inputs', async () => {
    const [first, second] = await Promise.all([
      generateSignedPdf(buildInput()),
      generateSignedPdf(buildInput()),
    ])
    expect(Buffer.compare(first, second)).toBe(0)
  })

  it('throws on unknown template version', async () => {
    await expect(
      generateSignedPdf(
        buildInput({
          ndaAgreement: { templateVersion: 'v999', depositAmount: '300.00' },
        }),
      ),
    ).rejects.toThrow(/Unknown NDA template version/)
  })

  it('throws on non-finite deposit amount', async () => {
    await expect(
      generateSignedPdf(
        buildInput({
          ndaAgreement: { templateVersion: 'v1', depositAmount: 'not-a-number' },
        }),
      ),
    ).rejects.toThrow(/Invalid deposit amount/)
  })

  it('renders custom HTML body when customContentHtml is provided', async () => {
    const buffer = await generateSignedPdf(
      buildInput({
        ndaAgreement: {
          templateVersion: 'v1',
          depositAmount: '300.00',
          customContentHtml: '<h2>Custom Section</h2><p>Custom paragraph.</p>',
        },
      }),
    )
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    // Sanity: custom-HTML output diverges from legacy template output
    const legacy = await generateSignedPdf(buildInput())
    expect(Buffer.compare(buffer, legacy)).not.toBe(0)
  })

  it('preview mode produces PDF differing from signed mode (no signature block)', async () => {
    const preview = await generateSignedPdf(buildInput({ mode: 'preview' }))
    const signed = await generateSignedPdf(buildInput())
    expect(preview.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(Buffer.compare(preview, signed)).not.toBe(0)
  })
})
