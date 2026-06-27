import type Stripe from 'stripe'
import { getStripeClient } from './client'
export interface StripeReceiptFacts {
  stripeCustomerId?: string | null
  stripeInvoiceId?: string | null
  stripePaymentIntentId?: string | null
  stripeChargeId?: string | null
  stripeReceiptUrl?: string | null
  stripeReceiptNumber?: string | null
  stripeHostedInvoiceUrl?: string | null
  stripeInvoicePdfUrl?: string | null
  paymentMethodBrand?: string | null
  paymentMethodLast4?: string | null
}
export type PaymentReceiptData = Partial<Record<keyof StripeReceiptFacts, string>> & {
  receiptSyncedAt?: Date
}
const RECEIPT_FACT_KEYS = [
  'stripeCustomerId',
  'stripeInvoiceId',
  'stripePaymentIntentId',
  'stripeChargeId',
  'stripeReceiptUrl',
  'stripeReceiptNumber',
  'stripeHostedInvoiceUrl',
  'stripeInvoicePdfUrl',
  'paymentMethodBrand',
  'paymentMethodLast4',
] as const
export async function getReceiptFactsFromCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<StripeReceiptFacts> {
  const baseFacts: StripeReceiptFacts = {
    stripeCustomerId: stripeIdOf(session.customer),
    stripeInvoiceId: stripeIdOf(session.invoice),
    stripePaymentIntentId: stripeIdOf(session.payment_intent),
  }

  const invoiceFacts = await getReceiptFactsFromInvoice(session.invoice)
  const paymentIntentFacts = await getReceiptFactsFromPaymentIntentId(
    baseFacts.stripePaymentIntentId ?? invoiceFacts.stripePaymentIntentId
  )

  return mergeReceiptFacts(baseFacts, invoiceFacts, paymentIntentFacts)
}
export async function getReceiptFactsFromInvoice(invoice: unknown): Promise<StripeReceiptFacts> {
  const payloadFacts =
    typeof invoice === 'string' ? { stripeInvoiceId: invoice } : extractInvoiceFacts(invoice)
  const hasPaymentMethodFacts = Boolean(
    payloadFacts.stripeChargeId || payloadFacts.paymentMethodBrand || payloadFacts.paymentMethodLast4
  )
  if (hasPaymentMethodFacts || !payloadFacts.stripeInvoiceId) return payloadFacts

  try {
    const expandedInvoice = await getStripeClient().invoices.retrieve(
      payloadFacts.stripeInvoiceId,
      { expand: ['payments.data.payment.charge', 'payments.data.payment.payment_intent.latest_charge'] }
    )
    return mergeReceiptFacts(payloadFacts, extractInvoiceFacts(expandedInvoice))
  } catch (error) {
    console.error(
      `[StripeReceiptFacts] Unable to retrieve invoice receipt facts invoice=${payloadFacts.stripeInvoiceId}:`,
      error,
    )
    return payloadFacts
  }
}
export async function getReceiptFactsFromPaymentIntentId(
  paymentIntentId: string | null | undefined
): Promise<StripeReceiptFacts> {
  if (!paymentIntentId) return {}

  try {
    const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    })
    return extractPaymentIntentFacts(paymentIntent)
  } catch (error) {
    console.error(
      `[StripeReceiptFacts] Unable to retrieve payment intent receipt facts paymentIntent=${paymentIntentId}:`,
      error,
    )
    return { stripePaymentIntentId: paymentIntentId }
  }
}
export function toPaymentReceiptData(facts: StripeReceiptFacts, syncedAt: Date = new Date()): PaymentReceiptData {
  const data: PaymentReceiptData = {}
  for (const key of RECEIPT_FACT_KEYS) {
    const value = facts[key]
    if (value) data[key] = value
  }
  if (Object.keys(data).length > 0) data.receiptSyncedAt = syncedAt
  return data
}
export function mergeReceiptFacts(...factsList: StripeReceiptFacts[]): StripeReceiptFacts {
  const merged: StripeReceiptFacts = {}
  for (const facts of factsList) {
    for (const key of RECEIPT_FACT_KEYS) {
      if (!merged[key] && facts[key]) merged[key] = facts[key]
    }
  }
  return merged
}
function extractInvoiceFacts(invoice: unknown): StripeReceiptFacts {
  const obj = asRecord(invoice)
  if (!obj) return {}

  const paymentFacts = extractInvoicePaymentFacts(obj)
  return mergeReceiptFacts(
    {
      stripeCustomerId: stripeIdOf(obj.customer),
      stripeInvoiceId: stringValue(obj.id),
      stripeHostedInvoiceUrl: stringValue(obj.hosted_invoice_url),
      stripeInvoicePdfUrl: stringValue(obj.invoice_pdf),
      stripeReceiptNumber: stringValue(obj.number),
      stripePaymentIntentId:
        stripeIdOf(obj.payment_intent) ?? stripeIdOf(asRecord(obj.confirmation_secret)?.payment_intent),
    },
    paymentFacts
  )
}

function extractPaymentIntentFacts(paymentIntent: unknown): StripeReceiptFacts {
  const obj = asRecord(paymentIntent)
  if (!obj) return {}

  const charge = obj.latest_charge
  return mergeReceiptFacts(
    {
      stripeCustomerId: stripeIdOf(obj.customer),
      stripePaymentIntentId: stringValue(obj.id),
    },
    extractChargeFacts(charge)
  )
}

function extractChargeFacts(charge: unknown): StripeReceiptFacts {
  const obj = asRecord(charge)
  if (!obj) return {}

  const method = extractPaymentMethodFacts(obj.payment_method_details)
  return {
    stripeCustomerId: stripeIdOf(obj.customer),
    stripePaymentIntentId: stripeIdOf(obj.payment_intent),
    stripeChargeId: stringValue(obj.id),
    stripeReceiptUrl: stringValue(obj.receipt_url),
    stripeReceiptNumber: stringValue(obj.receipt_number),
    paymentMethodBrand: method.brand,
    paymentMethodLast4: method.last4,
  }
}

function extractInvoicePaymentFacts(invoice: Record<string, unknown>): StripeReceiptFacts {
  const payments = asRecord(invoice.payments)
  const data = payments?.data
  if (!Array.isArray(data)) return {}

  for (const entry of data) {
    const payment = asRecord(asRecord(entry)?.payment)
    if (!payment) continue
    const chargeFacts = extractChargeFacts(payment.charge)
    const intentFacts = extractPaymentIntentFacts(payment.payment_intent)
    const directIntentId = stripeIdOf(payment.payment_intent)
    const facts = mergeReceiptFacts(
      directIntentId ? { stripePaymentIntentId: directIntentId } : {},
      chargeFacts,
      intentFacts
    )
    if (Object.keys(facts).length > 0) return facts
  }
  return {}
}

function extractPaymentMethodFacts(value: unknown): { brand: string | null; last4: string | null } {
  const details = asRecord(value)
  if (!details) return { brand: null, last4: null }

  const card = asRecord(details.card) ?? asRecord(details.card_present)
  return {
    brand: stringValue(card?.brand),
    last4: stringValue(card?.last4),
  }
}

function stripeIdOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  return stringValue(asRecord(value)?.id)
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}
