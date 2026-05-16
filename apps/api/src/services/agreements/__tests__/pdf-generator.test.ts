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
    agreement: { templateVersion: 'v1', depositAmount: '300.00' },
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
          agreement: { templateVersion: 'v999', depositAmount: '300.00' },
        }),
      ),
    ).rejects.toThrow(/Unknown agreement template version/)
  })

  it('throws on non-finite deposit amount', async () => {
    await expect(
      generateSignedPdf(
        buildInput({
          agreement: { templateVersion: 'v1', depositAmount: 'not-a-number' },
        }),
      ),
    ).rejects.toThrow(/Invalid deposit amount/)
  })

  it('renders custom HTML body when customContentHtml is provided', async () => {
    const buffer = await generateSignedPdf(
      buildInput({
        agreement: {
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

  it('renders custom HTML with nested bold italic marks', async () => {
    const buffer = await generateSignedPdf(
      buildInput({
        agreement: {
          type: 'ENGAGEMENT_LETTER',
          templateVersion: 'engagement-letter-v1',
          depositAmount: '15000.00',
          customContentHtml: '<p><strong><em>Firm will provide document review.</em></strong></p>',
          title: 'Engagement Letter',
        },
        mode: 'preview',
        firmSnapshot: {
          name: 'Acme Tax LLC',
          address: '123 Main St, Houston, TX 77001',
          signerName: '',
          signerTitle: '',
        },
        clientSnapshot: {
          nameOrBusiness: 'Jane Doe',
          address: '[Address]',
          clientType: 'INDIVIDUAL',
        },
      }),
    )

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('renders long pasted custom HTML across multiple pages', async () => {
    const paragraph =
      'To the fullest extent permitted by law, Firm liability for any claim arising out of this engagement shall be limited to the fees paid by Client to Firm for the services giving rise to the claim. Firm shall not be liable for indirect, incidental, consequential, special, punitive, or exemplary damages, including lost profits, business interruption, penalties, assessments, or government findings, except to the extent prohibited by law.'
    const customContentHtml = Array.from(
      { length: 70 },
      (_, i) => `<p>${i + 1}. ${paragraph}</p>`,
    ).join('')

    const buffer = await generateSignedPdf(
      buildInput({
        agreement: {
          type: 'ENGAGEMENT_LETTER',
          templateVersion: 'engagement-letter-v1',
          depositAmount: '15000.00',
          customContentHtml,
          title: 'Engagement Letter',
        },
        mode: 'preview',
        firmSnapshot: {
          name: 'Acme Tax LLC',
          address: '123 Main St, Houston, TX 77001',
          signerName: '',
          signerTitle: '',
        },
        clientSnapshot: {
          nameOrBusiness: 'Jane Doe',
          address: '[Address]',
          clientType: 'INDIVIDUAL',
        },
      }),
    )

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(10_000)
  }, 15_000)

  it('renders one large pasted paragraph with line breaks', async () => {
    const section = [
      '1. Scope of Services',
      '',
      'Firm will provide document review, organization, and reconstruction services related to Client’s DOL matter.',
      '',
      'The scope of services includes:',
      '',
      '1. Initial review of DOL request;',
      '2. Document checklist and project setup;',
      '3. Review of records for up to 10 employees;',
      '4. Reconstruction and organization of documents for up to 3 years;',
      '5. Payroll detail review and reconstruction;',
      '6. Employee compliance document reconstruction and organization;',
      '7. Final package review and organization.',
      '',
      'The services are limited to the above scope unless otherwise agreed in writing by both parties.',
    ].join('\n')
    const customContentHtml = `<p>${Array.from({ length: 18 }, (_, i) => `${i + 1}. ${section}`)
      .join('\n\n')
      .replace(/\n/g, '<br>')}</p>`

    const buffer = await generateSignedPdf(
      buildInput({
        agreement: {
          type: 'ENGAGEMENT_LETTER',
          templateVersion: 'engagement-letter-v1',
          depositAmount: '15000.00',
          customContentHtml,
          title: 'Engagement Letter',
        },
        mode: 'preview',
        firmSnapshot: {
          name: 'Acme Tax LLC',
          address: '123 Main St, Houston, TX 77001',
          signerName: '',
          signerTitle: '',
        },
        clientSnapshot: {
          nameOrBusiness: 'Jane Doe',
          address: '[Address]',
          clientType: 'INDIVIDUAL',
        },
      }),
    )

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(10_000)
  }, 15_000)

  it('preview mode produces PDF differing from signed mode (no signature block)', async () => {
    const preview = await generateSignedPdf(buildInput({ mode: 'preview' }))
    const signed = await generateSignedPdf(buildInput())
    expect(preview.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(Buffer.compare(preview, signed)).not.toBe(0)
  })
})
