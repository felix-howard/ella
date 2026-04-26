/**
 * NDA-specific HTML sanitizer. Stricter whitelist than the form-intro sanitizer
 * because the output is rendered into PDF (react-pdf node tree) AND streamed to
 * the public signing page. Defence-in-depth: Tiptap on FE already restricts
 * input, but we never trust client output.
 *
 * Length cap of 50KB blocks DOS via giant payloads.
 */
import sanitizeHtml from 'sanitize-html'

export const NDA_HTML_MAX_LENGTH = 50_000

export const NDA_ALLOWED_TAGS = [
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

export const NDA_ALLOWED_SCHEMES = ['https', 'mailto', 'tel'] as const

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...NDA_ALLOWED_TAGS],
  allowedAttributes: { a: ['href', 'rel'] },
  allowedSchemes: [...NDA_ALLOWED_SCHEMES],
  allowedSchemesAppliedToAttributes: ['href'],
  disallowedTagsMode: 'discard',
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
}

/**
 * Sanitize NDA HTML for persistence. Throws if length cap exceeded so callers
 * can surface a 413-style error instead of silently truncating.
 */
export function sanitizeNdaHtml(input: string | null | undefined): string {
  if (!input) return ''
  // Length cap measures raw input (pre-trim) so a giant whitespace-padded
  // payload can't sneak past as a DOS vector.
  if (input.length > NDA_HTML_MAX_LENGTH) {
    throw new Error(`NDA HTML exceeds ${NDA_HTML_MAX_LENGTH} byte cap`)
  }
  return sanitizeHtml(input.trim(), OPTIONS)
}
