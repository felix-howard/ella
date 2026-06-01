import { Hono } from 'hono'
import type Stripe from 'stripe'
import {
  constructStripeWebhookEvent,
  handleStripeWebhookEvent,
} from '../../services/stripe/webhook-handler'

const stripeWebhookRoute = new Hono()

stripeWebhookRoute.post('/', async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) {
    return c.json({ error: 'Missing Stripe signature' }, 400)
  }

  const rawBody = await c.req.text()

  let event: Stripe.Event
  try {
    event = constructStripeWebhookEvent(rawBody, signature)
  } catch (error) {
    if (error instanceof Error && error.message === 'Stripe webhook secret is not configured') {
      console.error('[StripeWebhook] STRIPE_WEBHOOK_SECRET not configured')
      return c.json({ error: 'Webhook not configured' }, 500)
    }

    console.error('[StripeWebhook] Verification failed:', error)
    return c.json({ error: 'Invalid Stripe webhook' }, 400)
  }

  try {
    const result = await handleStripeWebhookEvent(event)
    return c.json({ received: true, processed: result.processed, type: result.type })
  } catch (error) {
    console.error('[StripeWebhook] Handler error:', error)
    return c.json({ error: 'Processing failed' }, 500)
  }
})

export { stripeWebhookRoute }
