/**
 * Tests for sanitizeFormIntroContent — single source of truth for rich text
 * sanitization before persistence. Portal renders output via
 * dangerouslySetInnerHTML, so any allowlist gap is a direct XSS hole.
 */
import { describe, it, expect } from 'vitest'
import { sanitizeFormIntroContent } from '../sanitize-html'

describe('sanitizeFormIntroContent', () => {
  it('passes through plain text', () => {
    expect(sanitizeFormIntroContent('Hello world')).toBe('Hello world')
  })

  it('preserves allowed formatting tags', () => {
    const html =
      '<p>para</p><strong>b</strong><em>i</em><u>u</u>' +
      '<h2>h2</h2><h3>h3</h3>' +
      '<ul><li>a</li></ul><ol><li>b</li></ol>'
    const out = sanitizeFormIntroContent(html)
    expect(out).toContain('<p>para</p>')
    expect(out).toContain('<strong>b</strong>')
    expect(out).toContain('<em>i</em>')
    expect(out).toContain('<u>u</u>')
    expect(out).toContain('<h2>h2</h2>')
    expect(out).toContain('<h3>h3</h3>')
    expect(out).toContain('<ul><li>a</li></ul>')
    expect(out).toContain('<ol><li>b</li></ol>')
  })

  it('strips <script> entirely', () => {
    const out = sanitizeFormIntroContent('<p>ok</p><script>alert(1)</script>')
    expect(out).toBe('<p>ok</p>')
    expect(out).not.toContain('<script')
  })

  it('preserves safe images and strips event handlers', () => {
    const out = sanitizeFormIntroContent(
      '<img src="https://example.com/hero.jpg" alt="Tax workshop" title="Hero" onerror="alert(1)">',
    )
    expect(out).toContain('<img')
    expect(out).toContain('src="https://example.com/hero.jpg"')
    expect(out).toContain('alt="Tax workshop"')
    expect(out).toContain('title="Hero"')
    expect(out).toContain('loading="lazy"')
    expect(out).not.toContain('onerror')
  })

  it('strips javascript: URLs on anchors', () => {
    const out = sanitizeFormIntroContent('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })

  it('strips data: URLs on anchors', () => {
    const out = sanitizeFormIntroContent('<a href="data:text/html,<script>alert(1)</script>">x</a>')
    expect(out).not.toContain('data:')
    expect(out).not.toContain('<script')
  })

  it('strips unsafe image URLs and removes empty images', () => {
    const out = sanitizeFormIntroContent(
      '<img src="javascript:alert(1)" alt="bad">' +
        '<img src="data:image/png;base64,abc" alt="bad">' +
        '<img src="relative.jpg" alt="bad">' +
        '<img src="/relative.jpg" alt="bad">' +
        '<img src="//example.com/protocol-relative.jpg" alt="bad">',
    )
    expect(out).not.toContain('<img')
    expect(out).not.toContain('javascript:')
    expect(out).not.toContain('data:image')
    expect(out).not.toContain('relative.jpg')
    expect(out).not.toContain('protocol-relative.jpg')
  })

  it('preserves https anchors and forces rel="noopener noreferrer" even with target=_blank', () => {
    const out = sanitizeFormIntroContent('<a href="https://example.com" target="_blank">link</a>')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('blocks exotic scheme bypasses (SVG, vbscript, whitespace, entity-encoded)', () => {
    // SVG not allowlisted — both tag and any inline script inside are removed
    const svg = sanitizeFormIntroContent('<svg onload=alert(1)><script>alert(1)</script></svg>')
    expect(svg).not.toContain('<svg')
    expect(svg).not.toContain('<script')
    expect(svg).not.toContain('onload')

    // vbscript: not in ALLOWED_SCHEMES
    const vb = sanitizeFormIntroContent('<a href="vbscript:msgbox(1)">x</a>')
    expect(vb).not.toContain('vbscript:')

    // Leading whitespace scheme trick
    const ws = sanitizeFormIntroContent('<a href=" javascript:alert(1)">x</a>')
    expect(ws).not.toContain('javascript:')

    // HTML-entity-encoded scheme
    const entity = sanitizeFormIntroContent('<a href="&#106;avascript:alert(1)">x</a>')
    expect(entity).not.toContain('javascript:')
    expect(entity).not.toContain('&#106;avascript')
  })

  it('preserves mailto: and tel: anchors', () => {
    const mailto = sanitizeFormIntroContent('<a href="mailto:x@y.com">mail</a>')
    expect(mailto).toContain('href="mailto:x@y.com"')

    const tel = sanitizeFormIntroContent('<a href="tel:+1">call</a>')
    expect(tel).toContain('href="tel:+1"')
  })

  it('removes disallowed tags (table, iframe, style)', () => {
    const html =
      '<table><tr><td>x</td></tr></table>' +
      '<iframe src="https://evil.example"></iframe>' +
      '<style>body{display:none}</style>'
    const out = sanitizeFormIntroContent(html)
    expect(out).not.toContain('<table')
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('display:none')
  })

  it('strips inline event handlers and style attributes on any allowed tag', () => {
    const out = sanitizeFormIntroContent(
      '<p onclick="x()" onmouseover="y()" style="color:red">text</p>' +
        '<h2 style="display:none">hide</h2><a href="https://e.com" style="x">a</a>',
    )
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('onmouseover')
    expect(out).not.toContain('style=')
    expect(out).toContain('<p>text</p>')
    expect(out).toContain('<h2>hide</h2>')
  })

  it('returns empty string for empty/null/undefined inputs', () => {
    expect(sanitizeFormIntroContent('')).toBe('')
    expect(sanitizeFormIntroContent(null as unknown as string)).toBe('')
    expect(sanitizeFormIntroContent(undefined as unknown as string)).toBe('')
  })
})
