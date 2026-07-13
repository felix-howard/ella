import type Stripe from 'stripe'

const FAILED_PAYMENT_INTENT_STATUSES = new Set(['requires_payment_method', 'canceled'])

export interface ReconciledCheckoutSession {
  sessionStatus: string
  quoteStatus: 'paid' | 'active' | 'awaiting_payment' | 'payment_failed' | null
  eventAt: Date
  paidAt: Date | null
}

export function classifyStripeCheckoutSession(
  session: Stripe.Checkout.Session,
  observedAt = new Date()
): ReconciledCheckoutSession {
  const paymentIntent = getExpandedPaymentIntent(session)
  const invoice = getExpandedInvoice(session)
  const eventAt = getEventTime(session, paymentIntent, invoice)

  if (
    session.payment_status === 'paid' ||
    getStripeObjectString(invoice, 'status') === 'paid' ||
    getStripeObjectString(paymentIntent, 'status') === 'succeeded'
  ) {
    return {
      sessionStatus: session.status ?? 'complete',
      quoteStatus: isSubscriptionSession(session) ? 'active' : 'paid',
      eventAt: latestDate(eventAt, observedAt),
      paidAt: getPaidAt(session, paymentIntent, invoice, eventAt),
    }
  }

  if (FAILED_PAYMENT_INTENT_STATUSES.has(getStripeObjectString(paymentIntent, 'status') ?? '')) {
    return {
      sessionStatus: 'payment_failed',
      quoteStatus: 'payment_failed',
      eventAt: latestDate(eventAt, observedAt),
      paidAt: null,
    }
  }

  if (session.status === 'complete') {
    return {
      sessionStatus: 'complete',
      quoteStatus: 'awaiting_payment',
      eventAt,
      paidAt: null,
    }
  }

  return {
    sessionStatus: session.status ?? 'open',
    quoteStatus: null,
    eventAt,
    paidAt: null,
  }
}

export function getExpandedPaymentIntent(
  session: Stripe.Checkout.Session
): Record<string, unknown> | null {
  if (session.payment_intent && typeof session.payment_intent === 'object') {
    return session.payment_intent as unknown as Record<string, unknown>
  }

  const invoice = getExpandedInvoice(session)
  const invoicePaymentIntent = invoice?.payment_intent
  if (invoicePaymentIntent && typeof invoicePaymentIntent === 'object') {
    return invoicePaymentIntent as Record<string, unknown>
  }

  const subscription = getExpandedSubscription(session)
  const latestInvoice =
    subscription?.latest_invoice && typeof subscription.latest_invoice === 'object'
      ? (subscription.latest_invoice as Record<string, unknown>)
      : null
  const latestInvoicePaymentIntent = latestInvoice?.payment_intent
  return latestInvoicePaymentIntent && typeof latestInvoicePaymentIntent === 'object'
    ? (latestInvoicePaymentIntent as Record<string, unknown>)
    : null
}

export function getStripeObjectId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null
  const id = (value as { id?: unknown }).id
  return typeof id === 'string' ? id : null
}

export function isStripeResourceMissingError(error: unknown): boolean {
  const err = error as {
    code?: unknown
    statusCode?: unknown
    raw?: { code?: unknown; statusCode?: unknown }
  }
  return (
    err?.code === 'resource_missing' ||
    err?.raw?.code === 'resource_missing' ||
    err?.statusCode === 404 ||
    err?.raw?.statusCode === 404
  )
}

function getExpandedInvoice(session: Stripe.Checkout.Session): Record<string, unknown> | null {
  return session.invoice && typeof session.invoice === 'object'
    ? (session.invoice as unknown as Record<string, unknown>)
    : null
}

function getExpandedSubscription(session: Stripe.Checkout.Session): Record<string, unknown> | null {
  return session.subscription && typeof session.subscription === 'object'
    ? (session.subscription as unknown as Record<string, unknown>)
    : null
}

function isSubscriptionSession(session: Stripe.Checkout.Session): boolean {
  return session.mode === 'subscription' || Boolean(getStripeObjectId(session.subscription))
}

function getEventTime(
  session: Stripe.Checkout.Session,
  paymentIntent: Record<string, unknown> | null,
  invoice: Record<string, unknown> | null
): Date {
  const created =
    getStripeObjectNumber(paymentIntent, 'created') ??
    getNestedNumber(invoice, ['status_transitions', 'paid_at']) ??
    getStripeObjectNumber(invoice, 'created') ??
    session.created
  return new Date(created * 1000)
}

function getPaidAt(
  session: Stripe.Checkout.Session,
  paymentIntent: Record<string, unknown> | null,
  invoice: Record<string, unknown> | null,
  fallback: Date
): Date {
  const paidAt =
    getNestedNumber(invoice, ['status_transitions', 'paid_at']) ??
    getStripeObjectNumber(paymentIntent, 'created') ??
    session.created
  return paidAt ? new Date(paidAt * 1000) : fallback
}

function getStripeObjectString(
  value: Record<string, unknown> | null,
  key: string
): string | null {
  const field = value?.[key]
  return typeof field === 'string' ? field : null
}

function getStripeObjectNumber(value: Record<string, unknown> | null, key: string): number | null {
  const field = value?.[key]
  return typeof field === 'number' ? field : null
}

function getNestedNumber(value: Record<string, unknown> | null, path: string[]): number | null {
  let cursor: unknown = value
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') return null
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return typeof cursor === 'number' ? cursor : null
}

function latestDate(a: Date, b: Date): Date {
  return a > b ? a : b
}
