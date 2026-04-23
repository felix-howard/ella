/**
 * Unit tests for NDA template v1: verifies placeholder substitution,
 * section structure, and registry lookup behavior.
 */
import { describe, it, expect } from 'vitest'
import { templateV1, TEMPLATE_VERSION, TEMPLATE_TITLE } from '../template-v1'
import { getTemplate, currentTemplate } from '../template-registry'
import type { TemplateVars } from '../types'

function buildVars(overrides: Partial<TemplateVars> = {}): TemplateVars {
  return {
    leadFullName: 'Jane Doe',
    orgName: 'Acme Tax LLC',
    depositAmount: '$300',
    date: '2026-04-23',
    templateVersion: 'v1',
    ...overrides,
  }
}

describe('NDA template v1', () => {
  it('exposes stable version + title identifiers', () => {
    expect(TEMPLATE_VERSION).toBe('v1')
    expect(TEMPLATE_TITLE).toBe('Non-Disclosure Agreement')
    expect(templateV1.version).toBe('v1')
    expect(templateV1.title).toBe('Non-Disclosure Agreement')
  })

  it('renders all seven sections in order', () => {
    const sections = templateV1.render(buildVars())
    expect(sections.map((s) => s.heading)).toEqual([
      '1. Parties',
      '2. Definition of Confidential Information',
      '3. Obligations',
      '4. Term',
      expect.stringMatching(/^5\. Deposit Acknowledgement/),
      '6. Governing Law',
      '7. Signature',
    ])
    for (const s of sections) {
      expect(s.paragraphs.length).toBeGreaterThan(0)
    }
  })

  it('substitutes leadFullName, orgName, depositAmount, and date', () => {
    const sections = templateV1.render(
      buildVars({
        leadFullName: 'Nguyen Van A',
        orgName: 'Ella Advisors',
        depositAmount: '$500',
        date: '2026-12-31',
      }),
    )
    const allText = sections.flatMap((s) => [s.heading, ...s.paragraphs]).join('\n')
    expect(allText).toContain('Nguyen Van A')
    expect(allText).toContain('Ella Advisors')
    expect(allText).toContain('$500')
    expect(allText).toContain('2026-12-31')
  })

  it('embeds deposit amount in the section 5 heading', () => {
    const sections = templateV1.render(buildVars({ depositAmount: '$777' }))
    const depositSection = sections.find((s) => s.heading.startsWith('5. '))
    expect(depositSection).toBeDefined()
    expect(depositSection!.heading).toContain('$777')
  })

  it('leaves no unresolved placeholder tokens in output', () => {
    const sections = templateV1.render(buildVars())
    const rendered = JSON.stringify(sections)
    // Must not contain ${...}, {{...}}, or raw `vars.` references
    expect(rendered).not.toMatch(/\$\{[^}]+\}/)
    expect(rendered).not.toMatch(/\{\{[^}]+\}\}/)
    expect(rendered).not.toMatch(/vars\.\w+/)
  })

  it('escapes nothing and treats inputs as literal text (XSS safety deferred to PDF renderer)', () => {
    const sections = templateV1.render(
      buildVars({
        leadFullName: "Robert'); DROP TABLE leads;--",
        orgName: '<script>alert(1)</script>',
      }),
    )
    const allText = sections.flatMap((s) => s.paragraphs).join(' ')
    expect(allText).toContain("Robert'); DROP TABLE leads;--")
    expect(allText).toContain('<script>alert(1)</script>')
  })
})

describe('NDA template registry', () => {
  it('currentTemplate is templateV1', () => {
    expect(currentTemplate).toBe(templateV1)
  })

  it('getTemplate("v1") returns templateV1', () => {
    expect(getTemplate('v1')).toBe(templateV1)
  })

  it('getTemplate throws on unknown version', () => {
    expect(() => getTemplate('v999')).toThrow(/Unknown NDA template version: v999/)
  })
})
