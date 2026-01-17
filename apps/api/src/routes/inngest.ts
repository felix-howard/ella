/**
 * Inngest Route
 * Serves Inngest background job functions via /api/inngest endpoint
 */

import { Hono } from 'hono'
import { serve } from 'inngest/hono'
import { inngest } from '../lib/inngest'
import { classifyDocumentJob } from '../jobs'
import { config } from '../lib/config'

const inngestRoute = new Hono()

// Security check: Production requires signing key
if (!config.inngest.isProductionReady) {
  console.error('[Inngest] SECURITY WARNING: INNGEST_SIGNING_KEY not set in production!')
  console.error('[Inngest] Background jobs are DISABLED until signing key is configured.')
}

// Inngest serve endpoint - handles function discovery, invocation, and dev UI
// Signing key validates requests from Inngest cloud (required in production)
inngestRoute.on(
  ['GET', 'POST', 'PUT'],
  '/',
  (c, next) => {
    // Block Inngest in production without signing key
    if (!config.inngest.isProductionReady) {
      return c.json(
        { error: 'Inngest not configured for production. Set INNGEST_SIGNING_KEY.' },
        503
      )
    }
    return next()
  },
  serve({
    client: inngest,
    functions: [classifyDocumentJob],
    signingKey: config.inngest.signingKey || undefined,
  })
)

export { inngestRoute }
