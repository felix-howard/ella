/**
 * Default HTML renderer tests — verifies template → HTML serialization,
 * variable substitution survival, escape behavior, and round-trip through
 * sanitizeAgreementHtml.
 *
 * v1-specific tests pass `templateV1` explicitly so they remain valid now that
 * `currentTemplate` defaults to v2. A separate describe block tests v2 output.
 */
import { describe, expect, it } from 'vitest'
import { renderDefaultAgreementHtml } from '../render-default-html'
import { sanitizeAgreementHtml } from '../sanitize-html'
import { templateV1 } from '../template-v1'
import { templateV2 } from '../template-v2'
import type { TemplateVars } from '../types'

function buildVars(overrides: Partial<TemplateVars> = {}): TemplateVars {
  return {
    leadFullName: 'Nguyen Long',
    orgName: 'Ella Advisors',
    depositAmount: '$300',
    date: '2026-04-25',
    templateVersion: 'v1',
    ...overrides,
  }
}

describe('renderDefaultAgreementHtml — template v1', () => {
  it('emits all 7 template-v1 section headings as <h2>', () => {
    const html = renderDefaultAgreementHtml(buildVars(), templateV1)
    expect(html).toContain('<h2>1. Parties</h2>')
    expect(html).toContain('<h2>2. Definition of Confidential Information</h2>')
    expect(html).toContain('<h2>3. Obligations</h2>')
    expect(html).toContain('<h2>4. Term</h2>')
    expect(html).toContain('5. Initial Payment Acknowledgement')
    expect(html).toContain('<h2>6. Governing Law</h2>')
    expect(html).toContain('<h2>7. Signature</h2>')
  })

  it('substitutes leadFullName into output (no {{ markers)', () => {
    const html = renderDefaultAgreementHtml(buildVars({ leadFullName: 'Jane Doe' }), templateV1)
    expect(html).toContain('Jane Doe')
    expect(html).not.toContain('{{')
    expect(html).not.toContain('${')
  })

  it('embeds depositAmount in section 5 heading and paragraph', () => {
    const html = renderDefaultAgreementHtml(buildVars({ depositAmount: '$777' }), templateV1)
    expect(html).toContain('<h2>5. Initial Payment Acknowledgement ($777)</h2>')
    expect(html).toContain('non-refundable initial payment of $777')
  })

  it('escapes HTML-meta characters in variable values', () => {
    const html = renderDefaultAgreementHtml(
      buildVars({ leadFullName: '<script>alert(1)</script>' }),
      templateV1,
    )
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
  })

  it('leaves apostrophes/quotes raw (round-trip-safe with sanitize-html)', () => {
    const html = renderDefaultAgreementHtml(buildVars(), templateV1)
    expect(html).toContain("Company's discretion")
    expect(html).not.toContain('&#39;')
    expect(html).not.toContain('&quot;')
  })

  it('round-trips through sanitizeAgreementHtml unchanged', () => {
    const html = renderDefaultAgreementHtml(buildVars(), templateV1)
    const sanitized = sanitizeAgreementHtml(html)
    expect(sanitized).toBe(html)
  })

  it('produces only <h2> and <p> top-level tags', () => {
    const html = renderDefaultAgreementHtml(buildVars(), templateV1)
    const tags = html.match(/<(\/?)([a-z0-9]+)/gi) ?? []
    const tagNames = new Set(tags.map((t) => t.replace(/<\/?/, '').toLowerCase()))
    expect(tagNames).toEqual(new Set(['h2', 'p']))
  })
})

describe('renderDefaultAgreementHtml — template v2', () => {
  const v2Vars: TemplateVars = {
    leadFullName: 'Jane Doe',
    orgName: 'Ella Advisors',
    depositAmount: '$300',
    date: '2026-05-06',
    templateVersion: 'v2',
    governingState: 'Texas',
    governingCounty: 'Harris County, Texas',
  }

  it('emits sections 1-20 headings (not 21 — handled by SignatureBlock)', () => {
    const html = renderDefaultAgreementHtml(v2Vars, templateV2)
    expect(html).toContain('<h2>1. Purpose of Agreement</h2>')
    expect(html).toContain('<h2>20. Client Acknowledgment</h2>')
    expect(html).not.toContain('<h2>21. Signatures</h2>')
  })

  it('emits <ul> bullet lists for sections with bullets', () => {
    const html = renderDefaultAgreementHtml(v2Vars, templateV2)
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>Tax advice and tax planning concepts</li>')
  })

  it('emits <ol> ordered lists for sections with ordered items', () => {
    const html = renderDefaultAgreementHtml(v2Vars, templateV2)
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>Disclose Protected Firm Information to any third party;</li>')
  })

  it('renders governing law with state + county from vars', () => {
    const html = renderDefaultAgreementHtml(v2Vars, templateV2)
    expect(html).toContain('State of Texas')
    expect(html).toContain('Harris County, Texas')
  })

  it('uses fallback placeholders when governing law vars are absent', () => {
    const html = renderDefaultAgreementHtml(
      { ...v2Vars, governingState: undefined, governingCounty: undefined },
      templateV2,
    )
    expect(html).toContain('[State]')
    expect(html).toContain('[County, State]')
  })

  it('round-trips through sanitizeAgreementHtml unchanged', () => {
    const html = renderDefaultAgreementHtml(v2Vars, templateV2)
    const sanitized = sanitizeAgreementHtml(html)
    expect(sanitized).toBe(html)
  })
})
