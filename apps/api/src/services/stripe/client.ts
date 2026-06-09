import Stripe from 'stripe'
import { config } from '../../lib/config'

/**
 * Shared lazily-instantiated Stripe client. Used by the checkout flow and the
 * coupon sync service so we keep a single SDK instance / API version per process.
 */
let stripeClient: Stripe | null = null

export function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(config.stripe.secretKey)
  return stripeClient
}

/** Throw when Stripe credentials are missing — callers map this to a 503. */
export function assertStripeConfigured(): void {
  if (!config.stripe.isConfigured) {
    throw new Error('Stripe is not configured')
  }
}
