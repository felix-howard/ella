import type Stripe from 'stripe'
import { config } from '../../lib/config'
import { getStripeClient } from './client'
import type { CreateCheckoutSessionInput } from '../../routes/billing/schemas'
import {
  markPaymentQuoteStatus,
  persistPaymentQuote,
  persistStripeCheckoutSession,
  type CreateCheckoutSessionContext,
} from './persistence'
import { calculateCheckoutQuote, CheckoutQuoteError } from './quote-calculator'
import type { CheckoutQuote } from './quote-calculator'
import { toCheckoutLineItems, type CheckoutLineItem } from './checkout-line-items'

const SUBSCRIPTION_AUTHORIZATION_TEXT =
  'By subscribing, you authorize ELLA TAX SERVICES LLC to charge you according to the terms and conditions in the engagement letter.'

export interface CheckoutSessionResult {
  quoteId: string
  checkoutUrl: string
  sessionId: string
}

/**
 * Inputs to the generalized Stripe Checkout params builder. Both quote sources
 * (calculator + custom) funnel through here as a normalized `CheckoutLineItem[]`
 * plus session options, so the builder no longer hardcodes "monthly + setup".
 *
 * Coupon attach is XOR: a pre-applied `stripeCouponId` (→ `discounts`) OR
 * `allowPromotionCodes` (→ the checkout promo-code field), never both — Stripe
 * rejects the combination.
 */
export interface CheckoutSessionParamsOptions {
  quoteId: string
  customerEmail?: string
  customerId?: string
  customerCreation?: 'always' | 'if_required'
  successUrl?: string
  cancelUrl?: string
  extraMetadata?: Record<string, string | undefined>
  /** Pre-applied Stripe coupon id → `discounts: [{ coupon }]`. */
  stripeCouponId?: string
  /** Show the promo-code field at checkout → `allow_promotion_codes: true`. */
  allowPromotionCodes?: boolean
  /** `metadata.source` tag; defaults to the calculator value for backwards-compat. */
  metadataSource?: string
}

export function buildCheckoutSessionParams(
  lineItems: CheckoutLineItem[],
  opts: CheckoutSessionParamsOptions
): Stripe.Checkout.SessionCreateParams {
  if (lineItems.length === 0) throw new CheckoutQuoteError('Payable total is required')
  if (opts.stripeCouponId && opts.allowPromotionCodes) {
    throw new CheckoutQuoteError('A checkout cannot use a coupon and promotion codes together')
  }

  // Any recurring line (month/year) makes the whole session a subscription;
  // one-time lines then ride along on the first invoice. All-one-time → payment.
  const anyRecurring = lineItems.some((item) => item.interval !== 'one_time')

  return {
    mode: anyRecurring ? 'subscription' : 'payment',
    line_items: lineItems.map(toStripeLineItem),
    success_url: opts.successUrl ?? config.stripe.successUrl,
    cancel_url: opts.cancelUrl ?? config.stripe.cancelUrl,
    ...buildCustomerParams(opts, anyRecurring),
    client_reference_id: opts.quoteId,
    ...buildDiscountParams(opts),
    ...(anyRecurring ? buildSubscriptionCustomTextParams() : {}),
    metadata: compactMetadata({
      paymentQuoteId: opts.quoteId,
      quoteId: opts.quoteId,
      source: opts.metadataSource ?? 'pricing_calculator',
      ...opts.extraMetadata,
    }),
  }
}

function buildCustomerParams(
  opts: CheckoutSessionParamsOptions,
  anyRecurring: boolean
): Pick<Stripe.Checkout.SessionCreateParams, 'customer' | 'customer_email' | 'customer_creation'> {
  const customerId = opts.customerId?.trim()
  if (customerId) return { customer: customerId }
  if (opts.customerCreation && anyRecurring) {
    throw new CheckoutQuoteError('Customer creation is only supported for one-time checkout')
  }

  return {
    customer_email: opts.customerEmail,
    ...(opts.customerCreation ? { customer_creation: opts.customerCreation } : {}),
  }
}

function buildDiscountParams(
  opts: CheckoutSessionParamsOptions
): Pick<Stripe.Checkout.SessionCreateParams, 'discounts' | 'allow_promotion_codes'> {
  if (opts.stripeCouponId) return { discounts: [{ coupon: opts.stripeCouponId }] }
  if (opts.allowPromotionCodes) return { allow_promotion_codes: true }
  return {}
}

function buildSubscriptionCustomTextParams(): Pick<
  Stripe.Checkout.SessionCreateParams,
  'custom_text'
> {
  return {
    custom_text: {
      submit: {
        message: SUBSCRIPTION_AUTHORIZATION_TEXT,
      },
    },
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
      buildCheckoutSessionParams(toCheckoutLineItems(quote), {
        quoteId: quote.quoteId,
        customerEmail: input.customerEmail,
      }),
      { idempotencyKey: quote.quoteId }
    )
  } catch (error) {
    await markPaymentQuoteStatus(quote.quoteId, 'stripe_create_failed')
    throw error
  }
}

/** Shared with the deposit checkout flow, which derives its own return URLs from PORTAL_URL. */
export function isUnsafeProductionReturnUrl(url: string): boolean {
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

/** Normalized line item → Stripe `price_data` line. Recurring interval carries through; one-time has none. */
function toStripeLineItem(item: CheckoutLineItem): Stripe.Checkout.SessionCreateParams.LineItem {
  const isRecurring = item.interval !== 'one_time'
  return {
    quantity: item.quantity,
    price_data: {
      currency: config.stripe.currency,
      unit_amount: item.unitAmountCents,
      product_data: {
        name: formatStripeProductText(item.label, ' '),
        metadata: { kind: isRecurring ? 'monthly' : 'setup' },
        // Hosted Stripe Checkout does not support rich bullet styling here, so
        // multiline descriptions are flattened into readable comma-separated text.
        ...(item.description
          ? { description: formatStripeProductText(item.description, ', ') }
          : {}),
      },
      ...(item.interval !== 'one_time' ? { recurring: { interval: item.interval } } : {}),
    },
  }
}

function formatStripeProductText(value: string, separator: ' ' | ', '): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s+/, '').replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(separator)
}

function compactMetadata(metadata: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(metadata).filter((entry): entry is [string, string] => Boolean(entry[1])))
}

export { calculateCheckoutQuote, CheckoutQuoteError }
export type { CheckoutQuote }
