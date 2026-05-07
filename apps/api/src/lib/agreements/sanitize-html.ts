/**
 * Agreement-specific HTML sanitizer. Stricter whitelist than the form-intro
 * sanitizer because the output is rendered into PDF (react-pdf node tree) AND
 * streamed to the public signing page. Defence-in-depth: Tiptap on FE already
 * restricts input, but we never trust client output.
 *
 * Length cap of 50KB blocks DOS via giant payloads.
 */
import sanitizeHtml from 'sanitize-html'

export const AGREEMENT_HTML_MAX_LENGTH = 50_000

export const AGREEMENT_ALLOWED_TAGS = [
  'p',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'a',
  'br',
] as const

export const AGREEMENT_ALLOWED_SCHEMES = ['https', 'mailto', 'tel'] as const

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...AGREEMENT_ALLOWED_TAGS],
  allowedAttributes: { a: ['href', 'rel'] },
  allowedSchemes: [...AGREEMENT_ALLOWED_SCHEMES],
  allowedSchemesAppliedToAttributes: ['href'],
  disallowedTagsMode: 'discard',
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
}

/**
 * Sanitize agreement HTML for persistence. Throws if length cap exceeded so
 * callers can surface a 413-style error instead of silently truncating.
 */
export function sanitizeAgreementHtml(input: string | null | undefined): string {
  if (!input) return ''
  // Length cap measures raw input (pre-trim) so a giant whitespace-padded
  // payload can't sneak past as a DOS vector.
  if (input.length > AGREEMENT_HTML_MAX_LENGTH) {
    throw new Error(`Agreement HTML exceeds ${AGREEMENT_HTML_MAX_LENGTH} byte cap`)
  }
  return sanitizeHtml(input.trim(), OPTIONS)
}
