/**
 * Phase 07 fills in full test coverage. This stub proves the module wires up
 * and produces a valid PDF byte stream.
 */
import React, { type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import {
  generateSignedPdf,
  resolveAgreementPdfSubtitle,
  shouldRenderAgreementPdfHeader,
  type GenerateSignedPdfInput,
} from '../pdf-generator'
import { PdfConsentAuthorizationBlock } from '../pdf-consent-authorization-block'
import { getTemplate } from '../../../lib/agreements/template-registry'

// 1x1 transparent PNG (valid minimal PNG for signature placeholder).
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
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

function textContent(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textContent).join(' ')
  if (React.isValidElement<{ children?: ReactNode }>(node)) {
    if (typeof node.type === 'function') {
      const component = node.type as (props: { children?: ReactNode }) => ReactNode
      return textContent(component(node.props))
    }
    return textContent(node.props.children)
  }
  return ''
}

describe('generateSignedPdf', () => {
  it('registers the built-in CONSENT_7216 template', () => {
    const template = getTemplate('consent-7216-v1')

    expect(template.version).toBe('consent-7216-v1')
    expect(template.title).toBe('Consent to Use and Disclose Tax Return Information')
    expect(
      JSON.stringify(
        template.render({
          leadFullName: 'Jane Doe',
          orgName: 'Acme Tax',
          depositAmount: '',
          date: '2026-06-19',
          templateVersion: 'consent-7216-v1',
        })
      )
    ).toContain('Federal law generally prohibits')
  })

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
        })
      )
    ).rejects.toThrow(/Unknown agreement template version/)
  })

  it('throws on non-finite deposit amount', async () => {
    await expect(
      generateSignedPdf(
        buildInput({
          agreement: { templateVersion: 'v1', depositAmount: 'not-a-number' },
        })
      )
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
      })
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
      })
    )

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('omits the generated parties header and subtitle for engagement letters', () => {
    expect(shouldRenderAgreementPdfHeader('ENGAGEMENT_LETTER')).toBe(false)
    expect(
      resolveAgreementPdfSubtitle('ENGAGEMENT_LETTER', 'Professional Services Engagement')
    ).toBeUndefined()
  })

  it('omits the generated parties header but keeps legal subtitle for CONSENT_7216', () => {
    expect(shouldRenderAgreementPdfHeader('CONSENT_7216')).toBe(false)
    expect(
      resolveAgreementPdfSubtitle(
        'CONSENT_7216',
        'Internal Revenue Code §7216 and Treas. Reg. §301.7216-3'
      )
    ).toBe('Internal Revenue Code §7216 and Treas. Reg. §301.7216-3')
  })

  it('keeps the generated parties header and subtitle for NDA PDFs', () => {
    expect(shouldRenderAgreementPdfHeader('NDA')).toBe(true)
    expect(resolveAgreementPdfSubtitle('NDA', 'Mutual Confidentiality')).toBe(
      'Mutual Confidentiality'
    )
  })

  it('renders signed CONSENT_7216 PDF with taxpayer authorization fields', async () => {
    const buffer = await generateSignedPdf(
      buildInput({
        agreement: {
          type: 'CONSENT_7216',
          templateVersion: 'consent-7216-v1',
          depositAmount: '0.00',
          title: 'Consent to Use and Disclose Tax Return Information',
        },
        consentFields: {
          taxpayerName: 'Jane Doe',
          businessName: 'Doe Consulting LLC',
          tinLastFour: '1234',
          signerTitle: 'Owner',
        },
      })
    )

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('renders consent authorization text without generic dual-signature artifacts', () => {
    const block = PdfConsentAuthorizationBlock({
      mode: 'signed',
      taxpayerName: 'Jane Doe',
      businessName: null,
      tinLastFour: '1234',
      signaturePngBuffer: TRANSPARENT_PNG,
      printedName: 'Jane A. Doe',
      title: 'Owner',
      signedAt: '2026-04-23',
      audit: {
        signedAtIso: '2026-04-23T12:00:00.000Z',
        ipAddress: '203.0.113.42',
        userAgent: 'Mozilla/5.0 Test',
      },
    })
    const text = textContent(block).replace(/\s+/g, ' ')

    expect(text).toContain('Taxpayer Authorization and Signature')
    expect(text).toContain('Taxpayer Name Jane Doe')
    expect(text).toContain('Business Name Not applicable')
    expect(text).toContain('EIN/SSN Last Four ***-**-1234')
    expect(text).toContain('Printed Name Jane A. Doe')
    expect(text).toContain('Title Owner')
    expect(text).toContain('Date 2026-04-23')
    expect(text).toContain('Signed at: 2026-04-23T12:00:00.000Z')
    expect(text).toContain('IP address: 203.0.113.42')
    expect(text).toContain('User agent: Mozilla/5.0 Test')
    expect(text).not.toContain('Firm Name')
    expect(text).not.toContain('Client Name / Business Name')
    expect(text).not.toContain('21. Signatures')
  })

  it('rejects custom content for CONSENT_7216 PDF rendering', async () => {
    await expect(
      generateSignedPdf(
        buildInput({
          agreement: {
            type: 'CONSENT_7216',
            templateVersion: 'consent-7216-v1',
            depositAmount: '0.00',
            customContentHtml: '<p>Custom consent</p>',
          },
          mode: 'preview',
        })
      )
    ).rejects.toThrow(/CONSENT_7216 PDF uses the built-in consent document/)
  })

  it('requires consent fields for signed CONSENT_7216 PDF', async () => {
    await expect(
      generateSignedPdf(
        buildInput({
          agreement: {
            type: 'CONSENT_7216',
            templateVersion: 'consent-7216-v1',
            depositAmount: '0.00',
          },
        })
      )
    ).rejects.toThrow(/CONSENT_7216 signed PDF requires consent fields/)
  })

  it('allows CONSENT_7216 preview PDF without taxpayer authorization fields', async () => {
    const buffer = await generateSignedPdf(
      buildInput({
        agreement: {
          type: 'CONSENT_7216',
          templateVersion: 'consent-7216-v1',
          depositAmount: '0.00',
        },
        mode: 'preview',
      })
    )

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('renders long pasted custom HTML across multiple pages', async () => {
    const paragraph =
      'To the fullest extent permitted by law, Firm liability for any claim arising out of this engagement shall be limited to the fees paid by Client to Firm for the services giving rise to the claim. Firm shall not be liable for indirect, incidental, consequential, special, punitive, or exemplary damages, including lost profits, business interruption, penalties, assessments, or government findings, except to the extent prohibited by law.'
    const customContentHtml = Array.from(
      { length: 70 },
      (_, i) => `<p>${i + 1}. ${paragraph}</p>`
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
      })
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
      })
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
