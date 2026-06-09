/**
 * Anonymous custom (free-form) payment link: build a frozen CheckoutQuote from
 * typed line items, persist it, then create a Stripe Checkout Session (with an
 * optional pre-applied coupon or promo-code field). No recipient/SMS — the
 * caller gets the Checkout URL back directly, mirroring `createCheckoutSession`.
 */
import type Stripe from 'stripe'
import type { CreateCustomCheckoutInput } from '../../routes/billing/schemas'
import { getStripeClient } from './client'
import {
  assertStripeCheckoutConfig,
  buildCheckoutSessionParams,
  type CheckoutSessionResult,
} from './checkout'
import { buildCustomQuote } from './custom-quote-builder'
import { CheckoutQuoteError } from './quote-calculator'
import {
  markPaymentQuoteStatus,
  persistCustomPaymentQuote,
  persistStripeCheckoutSession,
  type CreateCheckoutSessionContext,
} from './persistence'
import { getActiveCouponById } from '../coupons/coupon-service'
import type { CheckoutLineItem } from './checkout-line-items'
import type { CouponSessionOptions } from './quote-rebuild'

export async function createCustomCheckoutSession(
  input: CreateCustomCheckoutInput,
  context: CreateCheckoutSessionContext = {}
): Promise<CheckoutSessionResult> {
  assertStripeCheckoutConfig()

  const { quote, lineItems, billingInterval } = buildCustomQuote({
    billingInterval: input.billingInterval,
    items: input.items,
    oneTimeItems: input.oneTimeItems,
  })

  const couponOptions = await resolveCreateCouponOptions(input, context.organizationId ?? null)

  await persistCustomPaymentQuote(
    {
      quote,
      lineItems,
      billingInterval,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      businessName: input.businessName,
      appliedCouponId: input.couponId,
      allowPromotionCodes: input.allowPromotionCodes,
    },
    context
  )

  const session = await createCustomStripeSession(quote.quoteId, lineItems, input, couponOptions)

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

  return { quoteId: quote.quoteId, checkoutUrl: session.url, sessionId: session.id }
}

async function createCustomStripeSession(
  quoteId: string,
  lineItems: CheckoutLineItem[],
  input: CreateCustomCheckoutInput,
  couponOptions: CouponSessionOptions
): Promise<Stripe.Checkout.Session> {
  try {
    return await getStripeClient().checkout.sessions.create(
      buildCheckoutSessionParams(lineItems, {
        quoteId,
        customerEmail: input.customerEmail,
        metadataSource: 'custom_link',
        ...couponOptions,
      }),
      { idempotencyKey: quoteId }
    )
  } catch (error) {
    await markPaymentQuoteStatus(quoteId, 'stripe_create_failed')
    throw error
  }
}

/** Resolve the owner-selected coupon to a Stripe coupon id, enforcing org scope + XOR. */
async function resolveCreateCouponOptions(
  input: CreateCustomCheckoutInput,
  organizationId: string | null
): Promise<CouponSessionOptions> {
  if (input.couponId) {
    if (!organizationId) {
      throw new CheckoutQuoteError('An organization is required to apply a coupon')
    }
    const coupon = await getActiveCouponById(input.couponId, organizationId)
    if (!coupon?.stripeCouponId) {
      throw new CheckoutQuoteError('Selected coupon is not available')
    }
    return { stripeCouponId: coupon.stripeCouponId }
  }
  if (input.allowPromotionCodes) return { allowPromotionCodes: true }
  return {}
}
