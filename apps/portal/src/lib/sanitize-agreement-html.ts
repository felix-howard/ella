/**
 * Client-side defence-in-depth sanitizer for Agreement HTML.
 * Server already sanitized at write (apps/api/src/lib/agreements/sanitize-html.ts);
 * this strips anything that slipped past or was injected by a man-in-the-middle.
 *
 * Whitelist mirrors the backend agreement whitelist + scheme set
 * `https | mailto | tel`. `target` is intentionally stripped — keeps signing
 * page in-tab so scroll-to-bottom gate state isn't lost. If the backend list
 * changes, update this file too — drift = security gap.
 */
import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br']
const ALLOWED_ATTR = ['href', 'rel']
const SECTION_HEADING_RE = /^\d{1,2}\.\s+\S[\s\S]{2,90}$/

export function sanitizeAgreementHtmlClient(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Match backend scheme set exactly — no http://, no #fragment, no data:/javascript:.
    ALLOWED_URI_REGEXP: /^(https:|mailto:|tel:)/i,
    FORBID_ATTR: ['style', 'target', 'onerror', 'onload', 'onclick'],
  })
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function isLikelySectionHeading(value: string): boolean {
  const text = compactText(value)
  if (!SECTION_HEADING_RE.test(text)) return false
  if (/[;,]$/.test(text)) return false

  const heading = text.replace(/^\d{1,2}\.\s+/, '')
  return /^[A-Z]/.test(heading)
}

function appendParagraph(
  doc: Document,
  target: DocumentFragment,
  nodes: Node[],
): void {
  if (nodes.length === 0) return

  const paragraph = doc.createElement('p')
  for (const node of nodes) {
    paragraph.appendChild(node.cloneNode(true))
  }

  if (compactText(paragraph.textContent ?? '')) {
    target.appendChild(paragraph)
  }
}

/**
 * Pasted PDF/Word text often turns section headings into inline bold text, e.g.
 * `<p>...parties.<strong>2. Fee Arrangement</strong></p>`. Keep the stored HTML
 * unchanged, but promote those obvious numbered headings at render time so the
 * client portal has scannable document hierarchy.
 */
export function formatAgreementHtmlForReading(html: string): string {
  if (!html) return ''

  const doc = new DOMParser().parseFromString(
    `<div data-agreement-root="true">${html}</div>`,
    'text/html',
  )
  const root = doc.querySelector('[data-agreement-root="true"]')
  if (!root) return html

  for (const paragraph of Array.from(root.querySelectorAll('p'))) {
    const replacement = doc.createDocumentFragment()
    const pendingNodes: Node[] = []
    let changed = false

    for (const child of Array.from(paragraph.childNodes)) {
      const isInlineStrongHeading =
        child.nodeType === Node.ELEMENT_NODE &&
        (child as Element).tagName.toLowerCase() === 'strong' &&
        isLikelySectionHeading(child.textContent ?? '')

      if (!isInlineStrongHeading) {
        pendingNodes.push(child)
        continue
      }

      appendParagraph(doc, replacement, pendingNodes)
      pendingNodes.length = 0

      const heading = doc.createElement('h2')
      heading.textContent = compactText(child.textContent ?? '')
      replacement.appendChild(heading)
      changed = true
    }

    appendParagraph(doc, replacement, pendingNodes)

    if (changed) {
      paragraph.replaceWith(replacement)
    }
  }

  return root.innerHTML
}
