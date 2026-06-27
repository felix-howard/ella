import type Stripe from 'stripe'
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import type { CreateCheckoutSessionInput } from '../../routes/billing/schemas'
import type { CheckoutQuote } from './quote-calculator'
import type { CheckoutInterval, CheckoutLineItem } from './checkout-line-items'

const CHECKOUT_CREATED_ALLOWED_STATUSES = [
  'pending_checkout',
  'sent',
  'checkout_created',
  'stripe_create_failed',
  'checkout_persist_failed',
  'stripe_missing_url',
]

export interface CreateCheckoutSessionContext {
  organizationId?: string | null
  createdByStaffId?: string | null
  clientId?: string | null
  leadId?: string | null
}

/**
 * Frozen source for a custom (free-form) quote. Unlike calculator quotes there
 * is no `pricingInput` to rebuild from, so the normalized `lineItems` are stored
 * inside `resultSnapshot` and read straight back at checkout (no recompute).
 */
export interface CustomQuotePersistInput {
  quote: CheckoutQuote
  lineItems: CheckoutLineItem[]
  billingInterval: CheckoutInterval
  customerEmail?: string
  customerName?: string
  businessName?: string
  /** Owner-attached coupon (`Coupon.id`). */
  appliedCouponId?: string
  allowPromotionCodes?: boolean
}

export async function persistPaymentQuote(
  quote: CheckoutQuote,
  input: CreateCheckoutSessionInput,
  context: CreateCheckoutSessionContext
): Promise<void> {
  await prisma.paymentQuote.create({
    data: {
      id: quote.quoteId,
      organizationId: context.organizationId,
      clientId: context.clientId,
      leadId: context.leadId,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      businessName: input.businessName,
      inputSnapshot: toPrismaJson(buildInputSnapshot(input)),
      resultSnapshot: toPrismaJson(quote),
      // Round to whole cents: the column is Int and a fractional total would
      // otherwise reach Prisma. Matches the custom path's buildCustomQuoteData.
      monthlyTotalCents: Math.round(quote.monthlyTotal * 100),
      setupTotalCents: Math.round(quote.setupTotal * 100),
      status: 'pending_checkout',
      createdByStaffId: context.createdByStaffId,
    },
  })
}

function buildInputSnapshot(input: CreateCheckoutSessionInput): Omit<CreateCheckoutSessionInput, 'quoteNotes'> {
  return {
    pricingInput: input.pricingInput,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    businessName: input.businessName,
  }
}

/**
 * Shared Prisma payload for a custom quote (both the anonymous-create and the
 * send-to-recipient flows). Callers spread this and add their own status/token/
 * recipient/sender fields. `billingInterval` is stored null for one-time links
 * to match the column's "null = one-time" contract.
 */
export function buildCustomQuoteData(input: CustomQuotePersistInput) {
  return {
    id: input.quote.quoteId,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    businessName: input.businessName,
    inputSnapshot: toPrismaJson({
      source: 'custom',
      billingInterval: input.billingInterval,
    }),
    resultSnapshot: toPrismaJson({ ...input.quote, lineItems: input.lineItems }),
    monthlyTotalCents: Math.round(input.quote.monthlyTotal * 100),
    setupTotalCents: Math.round(input.quote.setupTotal * 100),
    source: 'custom',
    billingInterval: input.billingInterval === 'one_time' ? null : input.billingInterval,
    appliedCouponId: input.appliedCouponId ?? null,
    allowPromotionCodes: input.allowPromotionCodes ?? false,
  }
}

/** Persist an anonymous custom quote (created from the workspace panel, no recipient). */
export async function persistCustomPaymentQuote(
  input: CustomQuotePersistInput,
  context: CreateCheckoutSessionContext
): Promise<void> {
  await prisma.paymentQuote.create({
    data: {
      ...buildCustomQuoteData(input),
      organizationId: context.organizationId,
      clientId: context.clientId,
      leadId: context.leadId,
      status: 'pending_checkout',
      createdByStaffId: context.createdByStaffId,
    },
  })
}

export async function persistStripeCheckoutSession(
  paymentQuoteId: string,
  session: Stripe.Checkout.Session
): Promise<void> {
  const sessionData = {
    stripeCustomerId: getStripeObjectId(session.customer),
    stripeSubscriptionId: getStripeObjectId(session.subscription),
    stripePaymentIntentId: getStripeObjectId(session.payment_intent),
    stripeInvoiceId: getStripeObjectId(session.invoice),
    status: session.status ?? 'created',
    url: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
  }

  await prisma.$transaction([
    prisma.stripeCheckoutSession.upsert({
      where: { stripeSessionId: session.id },
      create: {
        paymentQuoteId,
        stripeSessionId: session.id,
        ...sessionData,
      },
      update: sessionData,
    }),
    prisma.paymentQuote.updateMany({
      where: {
        id: paymentQuoteId,
        lastStripeEventAt: null,
        status: { in: CHECKOUT_CREATED_ALLOWED_STATUSES },
      },
      data: { status: 'checkout_created' },
    }),
  ])
}

export async function markPaymentQuoteStatus(paymentQuoteId: string, status: string): Promise<void> {
  try {
    await prisma.paymentQuote.updateMany({
      where: {
        id: paymentQuoteId,
        lastStripeEventAt: null,
        status: { notIn: ['paid', 'active', 'canceled'] },
      },
      data: { status },
    })
  } catch {
    // Preserve the original Stripe error path if status bookkeeping fails.
  }
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function getStripeObjectId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null

  const id = (value as { id?: unknown }).id
  return typeof id === 'string' ? id : null
}
