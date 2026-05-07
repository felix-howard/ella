/**
 * NDA sanitizer tests — covers whitelist, OWASP XSS samples, length cap.
 * Output is rendered into PDF + signing page so any allowlist gap is a
 * direct XSS vector.
 */
import { describe, expect, it } from 'vitest'
import {
  AGREEMENT_HTML_MAX_LENGTH,
  sanitizeAgreementHtml,
} from '../sanitize-html'

describe('sanitizeAgreementHtml', () => {
  it('returns empty string for empty/null/undefined', () => {
    expect(sanitizeAgreementHtml('')).toBe('')
    expect(sanitizeAgreementHtml(null)).toBe('')
    expect(sanitizeAgreementHtml(undefined)).toBe('')
  })

  it('round-trips whitelisted formatting tags', () => {
    const html =
      '<p><strong>x</strong><em>y</em><a href="https://e.com">z</a></p>'
    const out = sanitizeAgreementHtml(html)
    expect(out).toContain('<p>')
    expect(out).toContain('<strong>x</strong>')
    expect(out).toContain('<em>y</em>')
    expect(out).toContain('href="https://e.com"')
    expect(out).toContain('z</a>')
  })

  it('preserves headings, lists, line breaks', () => {
    const html =
      '<h2>H2</h2><h3>H3</h3>' +
      '<ul><li>a</li></ul><ol><li>b</li></ol><p>x<br />y</p>'
    const out = sanitizeAgreementHtml(html)
    expect(out).toContain('<h2>H2</h2>')
    expect(out).toContain('<h3>H3</h3>')
    expect(out).toContain('<ul><li>a</li></ul>')
    expect(out).toContain('<ol><li>b</li></ol>')
    expect(out).toContain('<br />')
  })

  it('strips <script> entirely', () => {
    const out = sanitizeAgreementHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).toBe('<p>ok</p>')
    expect(out).not.toContain('<script')
  })

  it('strips <style> entirely', () => {
    const out = sanitizeAgreementHtml('<style>body{display:none}</style><p>x</p>')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('display:none')
  })

  it('strips <iframe>', () => {
    const out = sanitizeAgreementHtml('<iframe src="https://evil.example"></iframe>')
    expect(out).not.toContain('<iframe')
  })

  it('strips inline event handlers like onclick', () => {
    const out = sanitizeAgreementHtml('<p onclick="x">y</p>')
    expect(out).not.toContain('onclick')
    expect(out).toContain('<p>y</p>')
  })

  it('strips javascript: URIs on anchors', () => {
    const out = sanitizeAgreementHtml('<a href="javascript:alert(1)">y</a>')
    expect(out).not.toContain('javascript:')
    // Anchor shell may remain but href is dropped
    expect(out).not.toContain('href="javascript:')
  })

  it('strips data: URIs on anchors', () => {
    const out = sanitizeAgreementHtml('<a href="data:text/html,<script>x</script>">y</a>')
    expect(out).not.toContain('data:')
    expect(out).not.toContain('<script')
  })

  it('forces rel="noopener noreferrer" on https anchors', () => {
    const out = sanitizeAgreementHtml('<a href="https://e.com">y</a>')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('preserves mailto: and tel: schemes', () => {
    expect(sanitizeAgreementHtml('<a href="mailto:a@b.com">m</a>')).toContain('href="mailto:a@b.com"')
    expect(sanitizeAgreementHtml('<a href="tel:+1">t</a>')).toContain('href="tel:+1"')
  })

  it('strips <img>, <table>, <svg> (not in NDA whitelist)', () => {
    const out = sanitizeAgreementHtml(
      '<table><tr><td>x</td></tr></table>' +
        '<img src=x onerror=alert(1)>' +
        '<svg onload=alert(1)></svg>',
    )
    expect(out).not.toContain('<table')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('<svg')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('onload')
  })

  it('throws when input exceeds 50KB length cap', () => {
    const giant = '<p>' + 'a'.repeat(AGREEMENT_HTML_MAX_LENGTH + 1) + '</p>'
    expect(() => sanitizeAgreementHtml(giant)).toThrow(/exceeds/)
  })

  it('passes input at exactly the length cap', () => {
    const filler = 'a'.repeat(AGREEMENT_HTML_MAX_LENGTH - '<p></p>'.length)
    const exact = `<p>${filler}</p>`
    expect(exact.length).toBe(AGREEMENT_HTML_MAX_LENGTH)
    expect(() => sanitizeAgreementHtml(exact)).not.toThrow()
  })
})
