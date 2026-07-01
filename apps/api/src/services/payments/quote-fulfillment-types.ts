/**
 * Shared types for the sent-quote webhook fulfillment side-effects
 * (quote-fulfillment-service + quote-fulfillment-notify).
 */
import type { Prisma } from '@ella/db'
import type { StripeReceiptFacts } from '../stripe/stripe-receipt-facts'

/**
 * Relations the fulfillment side-effects need off a PaymentQuote. Lead carries
 * the extra fields required to auto-convert it to a Client on first payment.
 */
export const sendableQuoteInclude = {
  client: { select: { id: true, firstName: true, lastName: true, phone: true } },
  lead: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      tags: true,
      notes: true,
      status: true,
      convertedToId: true,
      messagesLastReadAt: true,
    },
  },
} as const

export type SendableQuote = Prisma.PaymentQuoteGetPayload<{ include: typeof sendableQuoteInclude }>

/** SMS recipient resolved from the quote (client or lead). */
export interface QuoteSigner {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
  kind: 'lead' | 'client'
}

/**
 * Invoice facts the webhook extracts from a Stripe Invoice (version-agnostic),
 * so the fulfillment service never parses raw Stripe objects.
 */
export interface InvoiceFacts {
  id: string | null
  billingReason: string | null
  amountPaidCents: number
  amountDueCents: number
  paymentIntentId: string | null
  subscriptionId: string | null
  receiptFacts?: StripeReceiptFacts
}

/** True for a Prisma unique-constraint violation (deterministic-payToken dedupe). */
export function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === 'P2002')
}

/** Resolve a Stripe id from either a string id or an expanded object. */
export function stripeIdOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}
