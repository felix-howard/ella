/**
 * Render template-v1 sections to an HTML string suitable for pre-filling the
 * Tiptap editor when staff opens the customization modal. Output round-trips
 * through `sanitizeAgreementHtml` losslessly because every emitted tag is in
 * the agreement whitelist.
 *
 * Variables (`leadFullName`, `depositAmount`, etc) are already resolved by
 * `templateV1.render(vars)` — this module only serializes structure.
 */
import { templateV1 } from './template-v1'
import type { TemplateVars } from './types'

// Only escape characters required in HTML5 text content. Quotes/apostrophes
// are intentionally left raw so the round-trip through sanitize-html (which
// decodes them back to literals) is lossless.
//
// SAFETY: this helper is for TEXT NODES ONLY. Never use it to interpolate
// values into attribute positions — quote escaping is required there. Today
// the renderer emits zero attributes; if that changes, switch attribute
// values to a separate escapeAttr helper that also covers `"` and `'`.
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (ch) => HTML_ESCAPES[ch] ?? ch)
}

export function renderDefaultAgreementHtml(vars: TemplateVars): string {
  const sections = templateV1.render(vars)
  const parts: string[] = []
  for (const section of sections) {
    parts.push(`<h2>${escapeHtml(section.heading)}</h2>`)
    for (const paragraph of section.paragraphs) {
      parts.push(`<p>${escapeHtml(paragraph)}</p>`)
    }
  }
  return parts.join('')
}
