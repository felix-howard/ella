import type Stripe from 'stripe'
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import type { CreateCheckoutSessionInput } from '../../routes/billing/schemas'
import type { CheckoutQuote } from './quote-calculator'

export interface CreateCheckoutSessionContext {
  organizationId?: string | null
  createdByStaffId?: string | null
  clientId?: string | null
  leadId?: string | null
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
      monthlyTotalCents: quote.monthlyTotal * 100,
      setupTotalCents: quote.setupTotal * 100,
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

export async function persistStripeCheckoutSession(
  paymentQuoteId: string,
  session: Stripe.Checkout.Session
): Promise<void> {
  await prisma.$transaction([
    prisma.stripeCheckoutSession.create({
      data: {
        paymentQuoteId,
        stripeSessionId: session.id,
        stripeCustomerId: getStripeObjectId(session.customer),
        stripeSubscriptionId: getStripeObjectId(session.subscription),
        stripePaymentIntentId: getStripeObjectId(session.payment_intent),
        status: session.status ?? 'created',
        url: session.url,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      },
    }),
    prisma.paymentQuote.update({
      where: { id: paymentQuoteId },
      data: { status: 'checkout_created' },
    }),
  ])
}

export async function markPaymentQuoteStatus(paymentQuoteId: string, status: string): Promise<void> {
  try {
    await prisma.paymentQuote.update({
      where: { id: paymentQuoteId },
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
