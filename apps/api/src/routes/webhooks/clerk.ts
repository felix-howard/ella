/**
 * Clerk Webhook Route
 * Receives Clerk events with Svix signature verification
 * PUBLIC endpoint - no JWT auth required
 */
import { Hono } from 'hono'
import { Webhook } from 'svix'
import type { WebhookEvent } from '@clerk/backend'
import { config } from '../../lib/config'
import { handleClerkWebhook } from '../../services/clerk-webhook'

const clerkWebhookRoute = new Hono()

clerkWebhookRoute.post('/', async (c) => {
  const webhookSecret = config.clerk.webhookSecret
  if (!webhookSecret) {
    console.error('[ClerkWebhook] CLERK_WEBHOOK_SECRET not configured')
    return c.json({ error: 'Webhook not configured' }, 500)
  }

  // Get raw body for signature verification
  const rawBody = await c.req.text()

  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing svix headers' }, 400)
  }

  // Separate try/catch: verification errors -> 400, handler errors -> 500
  let event: WebhookEvent
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch (err) {
    console.error('[ClerkWebhook] Verification failed:', err)
    return c.json({ error: 'Invalid signature' }, 400)
  }

  try {
    await handleClerkWebhook(event)
    return c.json({ success: true })
  } catch (err) {
    console.error('[ClerkWebhook] Handler error:', err)
    return c.json({ error: 'Processing failed' }, 500)
  }
})

export { clerkWebhookRoute }
