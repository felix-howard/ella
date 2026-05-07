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

export function sanitizeAgreementHtmlClient(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Match backend scheme set exactly — no http://, no #fragment, no data:/javascript:.
    ALLOWED_URI_REGEXP: /^(https:|mailto:|tel:)/i,
    FORBID_ATTR: ['style', 'target', 'onerror', 'onload', 'onclick'],
  })
}
