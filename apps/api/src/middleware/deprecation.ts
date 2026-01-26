/**
 * Deprecation Headers Middleware
 * Signals to API consumers that certain fields/params are deprecated
 *
 * Phase 4: Marks clientId-based queries as deprecated in favor of engagementId
 */
import type { Context, Next } from 'hono'

// Sunset date: 6 months from now (adjust as needed)
const SUNSET_DATE = 'Wed, 25 Jul 2026 00:00:00 GMT'

/**
 * Middleware to add deprecation headers when clientId is used
 * Applies to query params, body params, and URL paths
 */
export const deprecationHeadersMiddleware = async (c: Context, next: Next) => {
  await next()

  // Check if clientId is used in query params
  const clientIdInQuery = c.req.query('clientId')

  // Check if URL path contains 'clientId'
  const clientIdInPath = c.req.url.includes('clientId')

  if (clientIdInQuery || clientIdInPath) {
    // Add deprecation headers per RFC 8594
    c.header('Deprecation', 'true')
    c.header('Sunset', SUNSET_DATE)
    c.header('X-Deprecation-Reason', 'Use engagementId instead of clientId for TaxCase operations. clientId will be removed in a future release.')

    // Add Link header pointing to documentation (if available)
    c.header('Link', '</docs/api-migration>; rel="deprecation"; type="text/html"')
  }
}

/**
 * Add deprecation warning to response body for POST/PATCH requests
 * Use this for routes where body contains deprecated fields
 */
export function addDeprecationWarning(
  body: Record<string, unknown>,
  deprecatedFields: string[]
): Record<string, unknown> & { _deprecationWarning?: { fields: string[]; message: string } } {
  const usedDeprecatedFields = deprecatedFields.filter((f) => f in body)

  if (usedDeprecatedFields.length === 0) {
    return body
  }

  return {
    ...body,
    _deprecationWarning: {
      fields: usedDeprecatedFields,
      message: `The following fields are deprecated and will be removed: ${usedDeprecatedFields.join(', ')}. Use engagementId-based operations instead.`,
    },
  }
}
