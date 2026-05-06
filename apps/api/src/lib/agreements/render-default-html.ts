/**
 * Render built-in template sections to an HTML string suitable for pre-filling
 * the Tiptap editor when staff opens the customization modal. Output round-trips
 * through `sanitizeAgreementHtml` losslessly because every emitted tag is in
 * the agreement whitelist.
 *
 * Variables (`leadFullName`, `depositAmount`, etc) are already resolved by
 * `template.render(vars)` — this module only serializes structure to HTML.
 *
 * Serialization order per section:
 *   heading → paragraphs → bullets (<ul>) → ordered (<ol>) → trailingParagraphs
 */
import { currentTemplate } from './template-registry'
import type { NdaTemplate, TemplateVars } from './types'

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

function serializeBullets(items: string[]): string {
  if (items.length === 0) return ''
  const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  return `<ul>${lis}</ul>`
}

function serializeOrdered(items: string[]): string {
  if (items.length === 0) return ''
  const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  return `<ol>${lis}</ol>`
}

/**
 * Render template sections to HTML.
 *
 * @param vars   Template variables already resolved for the agreement.
 * @param template  Override which template to render. Defaults to `currentTemplate`
 *                  (v2 as of this version). Pass `getTemplate('v1')` to render legacy.
 */
export function renderDefaultAgreementHtml(vars: TemplateVars, template: NdaTemplate = currentTemplate): string {
  const sections = template.render(vars)
  const parts: string[] = []
  for (const section of sections) {
    parts.push(`<h2>${escapeHtml(section.heading)}</h2>`)
    for (const paragraph of section.paragraphs) {
      parts.push(`<p>${escapeHtml(paragraph)}</p>`)
    }
    if (section.bullets && section.bullets.length > 0) {
      parts.push(serializeBullets(section.bullets))
    }
    if (section.ordered && section.ordered.length > 0) {
      parts.push(serializeOrdered(section.ordered))
    }
    if (section.trailingParagraphs && section.trailingParagraphs.length > 0) {
      for (const paragraph of section.trailingParagraphs) {
        parts.push(`<p>${escapeHtml(paragraph)}</p>`)
      }
    }
  }
  return parts.join('')
}
