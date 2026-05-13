/**
 * Server-side HTML sanitization for rich text inputs (campaign form intro, etc).
 * Single source of truth — callers MUST pass user-submitted HTML through here
 * before persisting, since the portal renders it via dangerouslySetInnerHTML.
 */
import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img']
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel']
const ABSOLUTE_HTTP_URL = /^https?:\/\//i

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'loading'],
  },
  allowedSchemes: ALLOWED_SCHEMES,
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  exclusiveFilter: (frame) =>
    frame.tag === 'img' && !ABSOLUTE_HTTP_URL.test(frame.attribs.src ?? ''),
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }, true),
  },
}

/** Strip disallowed tags/attrs/schemes and force safe rel on anchors. */
export function sanitizeFormIntroContent(dirty: string): string {
  if (!dirty) return ''
  return sanitizeHtml(dirty, OPTIONS)
}
