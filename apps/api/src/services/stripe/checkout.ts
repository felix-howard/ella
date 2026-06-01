import Stripe from 'stripe'
import { config } from '../../lib/config'
import type { CreateCheckoutSessionInput } from '../../routes/billing/schemas'
import {
  markPaymentQuoteStatus,
  persistPaymentQuote,
  persistStripeCheckoutSession,
  type CreateCheckoutSessionContext,
} from './persistence'
import { calculateCheckoutQuote, CheckoutQuoteError } from './quote-calculator'
import type { CheckoutQuote, LineKind } from './quote-calculator'

export interface CheckoutSessionResult {
  quoteId: string
  checkoutUrl: string
  sessionId: string
}

let stripeClient: Stripe | null = null

export function buildCheckoutSessionParams(
  quote: CheckoutQuote,
  input: CreateCheckoutSessionInput
): Stripe.Checkout.SessionCreateParams {
  const mode = quote.monthlyTotal > 0 ? 'subscription' : 'payment'
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []

  if (quote.monthlyTotal > 0) {
    lineItems.push(createLineItem('Ella monthly service', quote.monthlyTotal, 'monthly'))
  }
  if (quote.setupTotal > 0) {
    lineItems.push(createLineItem('Ella setup and one-time services', quote.setupTotal, 'setup'))
  }
  if (lineItems.length === 0) throw new CheckoutQuoteError('Payable total is required')

  return {
    mode,
    line_items: lineItems,
    success_url: config.stripe.successUrl,
    cancel_url: config.stripe.cancelUrl,
    customer_email: input.customerEmail,
    client_reference_id: quote.quoteId,
    metadata: compactMetadata({
      paymentQuoteId: quote.quoteId,
      quoteId: quote.quoteId,
      source: 'pricing_calculator',
    }),
  }
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
  context: CreateCheckoutSessionContext = {}
): Promise<CheckoutSessionResult> {
  assertStripeCheckoutConfig()

  const quote = calculateCheckoutQuote(input.pricingInput)
  await persistPaymentQuote(quote, input, context)

  const stripe = getStripeClient()
  const session = await createStripeSession(stripe, quote, input)

  if (!session.url) {
    await markPaymentQuoteStatus(quote.quoteId, 'stripe_missing_url')
    throw new Error('Stripe did not return a Checkout URL')
  }

  try {
    await persistStripeCheckoutSession(quote.quoteId, session)
  } catch (error) {
    await markPaymentQuoteStatus(quote.quoteId, 'checkout_persist_failed')
    throw error
  }

  return {
    quoteId: quote.quoteId,
    checkoutUrl: session.url,
    sessionId: session.id,
  }
}

function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(config.stripe.secretKey)
  return stripeClient
}

export function assertStripeCheckoutConfig(): void {
  if (!config.stripe.isConfigured) {
    throw new Error('Stripe is not configured')
  }

  if (config.nodeEnv !== 'production') return

  const urls = [config.stripe.successUrl, config.stripe.cancelUrl]
  const hasUnsafeReturnUrl = urls.some(isUnsafeProductionReturnUrl)

  if (hasUnsafeReturnUrl) {
    throw new Error('Stripe production return URLs must be valid HTTPS URLs')
  }
}

async function createStripeSession(
  stripe: Stripe,
  quote: CheckoutQuote,
  input: CreateCheckoutSessionInput
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.create(
      buildCheckoutSessionParams(quote, input),
      { idempotencyKey: quote.quoteId }
    )
  } catch (error) {
    await markPaymentQuoteStatus(quote.quoteId, 'stripe_create_failed')
    throw error
  }
}

function isUnsafeProductionReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    return (
      parsed.protocol !== 'https:' ||
      hostname === 'localhost' ||
      hostname === '::1' ||
      hostname.startsWith('127.')
    )
  } catch {
    return true
  }
}

function createLineItem(
  label: string,
  amount: number,
  kind: LineKind
): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    quantity: 1,
    price_data: {
      currency: config.stripe.currency,
      unit_amount: amount * 100,
      product_data: { name: label, metadata: { kind } },
      ...(kind === 'monthly' ? { recurring: { interval: 'month' as const } } : {}),
    },
  }
}

function compactMetadata(metadata: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(metadata).filter((entry): entry is [string, string] => Boolean(entry[1])))
}

export { calculateCheckoutQuote, CheckoutQuoteError }
export type { CheckoutQuote }
