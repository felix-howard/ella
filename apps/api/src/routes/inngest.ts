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

// Inngest serve endpoint - handles function discovery, invocation, and dev UI
// Signing key validates requests from Inngest cloud (required in production)
inngestRoute.on(
  ['GET', 'POST', 'PUT'],
  '/',
  serve({
    client: inngest,
    functions: [classifyDocumentJob],
    signingKey: config.inngest.signingKey || undefined,
  })
)

export { inngestRoute }
