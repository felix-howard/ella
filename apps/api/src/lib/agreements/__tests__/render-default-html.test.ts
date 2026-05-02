/**
 * Default HTML renderer tests — verifies template-v1 → HTML serialization,
 * variable substitution survival, escape behavior, and round-trip through
 * sanitizeAgreementHtml.
 */
import { describe, expect, it } from 'vitest'
import { renderDefaultAgreementHtml } from '../render-default-html'
import { sanitizeAgreementHtml } from '../sanitize-html'
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

describe('renderDefaultAgreementHtml', () => {
  it('emits all 7 template-v1 section headings as <h2>', () => {
    const html = renderDefaultAgreementHtml(buildVars())
    expect(html).toContain('<h2>1. Parties</h2>')
    expect(html).toContain('<h2>2. Definition of Confidential Information</h2>')
    expect(html).toContain('<h2>3. Obligations</h2>')
    expect(html).toContain('<h2>4. Term</h2>')
    expect(html).toContain('5. Deposit Acknowledgement')
    expect(html).toContain('<h2>6. Governing Law</h2>')
    expect(html).toContain('<h2>7. Signature</h2>')
  })

  it('substitutes leadFullName into output (no {{ markers)', () => {
    const html = renderDefaultAgreementHtml(buildVars({ leadFullName: 'Jane Doe' }))
    expect(html).toContain('Jane Doe')
    expect(html).not.toContain('{{')
    expect(html).not.toContain('${')
  })

  it('embeds depositAmount in section 5 heading and paragraph', () => {
    const html = renderDefaultAgreementHtml(buildVars({ depositAmount: '$777' }))
    expect(html).toContain('<h2>5. Deposit Acknowledgement ($777)</h2>')
    expect(html).toContain('non-refundable engagement deposit of $777')
  })

  it('escapes HTML-meta characters in variable values', () => {
    const html = renderDefaultAgreementHtml(
      buildVars({ leadFullName: '<script>alert(1)</script>' }),
    )
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
  })

  it('leaves apostrophes/quotes raw (round-trip-safe with sanitize-html)', () => {
    const html = renderDefaultAgreementHtml(buildVars())
    expect(html).toContain("Company's discretion")
    expect(html).not.toContain('&#39;')
    expect(html).not.toContain('&quot;')
  })

  it('round-trips through sanitizeAgreementHtml unchanged', () => {
    const html = renderDefaultAgreementHtml(buildVars())
    const sanitized = sanitizeAgreementHtml(html)
    expect(sanitized).toBe(html)
  })

  it('produces only <h2> and <p> top-level tags', () => {
    const html = renderDefaultAgreementHtml(buildVars())
    const tags = html.match(/<(\/?)([a-z0-9]+)/gi) ?? []
    const tagNames = new Set(tags.map((t) => t.replace(/<\/?/, '').toLowerCase()))
    expect(tagNames).toEqual(new Set(['h2', 'p']))
  })
})
