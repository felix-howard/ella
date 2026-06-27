import { Hono } from 'hono'
import type Stripe from 'stripe'
import {
  constructStripeWebhookEvent,
  handleStripeWebhookEvent,
} from '../../services/stripe/webhook-handler'
import {
  claimWebhookProcessing,
  isWebhookTerminal,
  markWebhookFailed,
  markWebhookProcessed,
  markWebhookReceived,
} from '../../services/stripe/stripe-webhook-event-log-service'

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

  let logAvailable = false
  try {
    await markWebhookReceived(event)
    logAvailable = true
    if (!(await claimWebhookProcessing(event.id))) {
      if (!(await isWebhookTerminal(event.id))) {
        return c.json(
          {
            error: 'Webhook already processing',
            received: true,
            processed: false,
            type: event.type,
          },
          409
        )
      }
      return c.json({
        received: true,
        processed: false,
        duplicate: true,
        type: event.type,
      })
    }
  } catch (error) {
    console.error('[StripeWebhook] Event logging failed; continuing processing:', error)
  }

  try {
    const result = await handleStripeWebhookEvent(event)
    if (logAvailable) {
      await markWebhookProcessed(event.id, result).catch((error) => {
        console.error('[StripeWebhook] Failed to mark event processed:', error)
      })
    }
    return c.json({ received: true, processed: result.processed, type: result.type })
  } catch (error) {
    if (logAvailable) {
      await markWebhookFailed(event.id, error).catch((logError) => {
        console.error('[StripeWebhook] Failed to mark event failed:', logError)
      })
    }
    console.error('[StripeWebhook] Handler error:', error)
    return c.json({ error: 'Processing failed' }, 500)
  }
})

export { stripeWebhookRoute }
