/**
 * Server-side HTML sanitization for rich text inputs (campaign form intro, etc).
 * Single source of truth — callers MUST pass user-submitted HTML through here
 * before persisting, since the portal renders it via dangerouslySetInnerHTML.
 */
import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'a']
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel']

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ALLOWED_SCHEMES,
  allowedSchemesAppliedToAttributes: ['href'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
}

/** Strip disallowed tags/attrs/schemes and force safe rel on anchors. */
export function sanitizeFormIntroContent(dirty: string): string {
  if (!dirty) return ''
  return sanitizeHtml(dirty, OPTIONS)
}
