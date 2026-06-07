import Stripe from 'stripe'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'
import { markDepositPaymentPaid } from '../payments/deposit-checkout-service'

type StripeEventType =
  | 'checkout.session.completed'
  | 'checkout.session.async_payment_succeeded'
  | 'checkout.session.async_payment_failed'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'customer.subscription.deleted'

type CheckoutFulfillment = 'completed' | 'settled' | 'failed'

interface StripeEventCursor {
  id: string
  at: Date
}

interface StripeWebhookResult {
  processed: boolean
  type: string
}

let stripeClient: Stripe | null = null

export function constructStripeWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  if (!config.stripe.webhookSecret) {
    throw new Error('Stripe webhook secret is not configured')
  }

  return getStripeClient().webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret)
}

/**
 * Deposit-payment checkout sessions (portal pay page) carry `metadata.payToken`
 * — the discriminator that keeps them out of the PaymentQuote flow below.
 */
function isDepositPaymentSession(session: Stripe.Checkout.Session): boolean {
  return Boolean(session.metadata?.payToken)
}

async function handleDepositCheckoutSession(
  session: Stripe.Checkout.Session,
  fulfillment: CheckoutFulfillment,
  event: StripeEventCursor
): Promise<void> {
  if (fulfillment === 'failed') {
    // Payment stays PENDING — the client can retry with the same pay link.
    console.warn(`[StripeWebhook] Deposit async payment failed for session=${session.id}`)
    return
  }
  // 'completed' with a non-paid status means an async method is still
  // processing — fulfillment arrives later via async_payment_succeeded.
  if (fulfillment === 'completed' && session.payment_status !== 'paid') return

  await markDepositPaymentPaid(session, event.at)
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<StripeWebhookResult> {
  switch (event.type as StripeEventType) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session
      const fulfillment: CheckoutFulfillment =
        event.type === 'checkout.session.completed'
          ? 'completed'
          : event.type === 'checkout.session.async_payment_succeeded'
            ? 'settled'
            : 'failed'

      if (isDepositPaymentSession(session)) {
        await handleDepositCheckoutSession(session, fulfillment, getEventCursor(event))
      } else {
        await handleCheckoutSession(session, fulfillment, getEventCursor(event))
      }
      break
    }
    case 'invoice.paid':
      await updateQuoteBySubscription(
        event.data.object,
        'active',
        'invoice_paid',
        getEventCursor(event)
      )
      break
    case 'invoice.payment_failed':
      await updateQuoteBySubscription(
        event.data.object,
        'payment_failed',
        'invoice_payment_failed',
        getEventCursor(event)
      )
      break
    case 'customer.subscription.deleted':
      await updateQuoteBySubscription(
        event.data.object,
        'canceled',
        'subscription_canceled',
        getEventCursor(event)
      )
      break
    default:
      return { processed: false, type: event.type }
  }

  return { processed: true, type: event.type }
}

function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(config.stripe.secretKey)
  return stripeClient
}

async function handleCheckoutSession(
  session: Stripe.Checkout.Session,
  fulfillment: CheckoutFulfillment,
  event: StripeEventCursor
): Promise<void> {
  const targetQuoteStatus = getCheckoutQuoteStatus(session, fulfillment)
  const targetSessionStatus =
    fulfillment === 'failed' ? 'payment_failed' : (session.status ?? 'complete')
  const metadataQuoteId = getPaymentQuoteId(session)

  const existingSession = await prisma.stripeCheckoutSession.findUnique({
    where: { stripeSessionId: session.id },
    select: {
      paymentQuoteId: true,
      status: true,
      paidAt: true,
      lastStripeEventAt: true,
      paymentQuote: { select: { status: true } },
    },
  })

  if (
    existingSession?.status === targetSessionStatus &&
    existingSession.paymentQuote.status === targetQuoteStatus &&
    (!isPaidQuoteStatus(targetQuoteStatus) || existingSession.paidAt)
  ) {
    return
  }

  if (
    existingSession?.paymentQuoteId &&
    metadataQuoteId &&
    existingSession.paymentQuoteId !== metadataQuoteId
  ) {
    console.warn('[StripeWebhook] Ignoring mismatched checkout metadata quote id', {
      stripeSessionId: session.id,
      paymentQuoteId: existingSession.paymentQuoteId,
    })
  }

  const quoteId = existingSession?.paymentQuoteId ?? metadataQuoteId
  const paidAt = isPaidQuoteStatus(targetQuoteStatus) ? event.at : undefined
  const operations = []
  const shouldUpdateSession = shouldApplyCheckoutSessionStatus(
    existingSession?.status,
    targetSessionStatus,
    existingSession?.paymentQuote.status,
    existingSession?.lastStripeEventAt,
    event.at
  )
  const shouldUpdateQuote = shouldApplyCheckoutQuoteStatus(
    existingSession?.paymentQuote.status,
    targetQuoteStatus,
    existingSession?.lastStripeEventAt,
    event.at
  )

  if (shouldUpdateSession) {
    operations.push(
      prisma.stripeCheckoutSession.updateMany({
        where: {
          stripeSessionId: session.id,
          OR: buildSessionEventFreshnessWhere(targetSessionStatus, event.at),
        },
        data: {
          stripeCustomerId: getStripeObjectId(session.customer),
          stripeSubscriptionId: getStripeObjectId(session.subscription),
          stripePaymentIntentId: getStripeObjectId(session.payment_intent),
          status: targetSessionStatus,
          lastStripeEventId: event.id,
          lastStripeEventAt: event.at,
          ...(paidAt ? { paidAt } : {}),
        },
      })
    )
  }

  if (quoteId && shouldUpdateQuote) {
    operations.push(
      prisma.paymentQuote.updateMany({
        where: {
          id: quoteId,
          status: { not: 'canceled' },
          OR: buildQuoteEventFreshnessWhere(targetQuoteStatus, event.at),
        },
        data: {
          status: targetQuoteStatus,
          lastStripeEventId: event.id,
          lastStripeEventAt: event.at,
        },
      })
    )
  }

  if (operations.length > 0) await prisma.$transaction(operations)
}

async function updateQuoteBySubscription(
  stripeObject: unknown,
  quoteStatus: string,
  sessionStatus: string,
  event: StripeEventCursor
): Promise<void> {
  const stripeSubscriptionId = getSubscriptionId(stripeObject)
  if (!stripeSubscriptionId) return

  await prisma.$transaction([
    prisma.stripeCheckoutSession.updateMany({
      where: {
        stripeSubscriptionId,
        ...(sessionStatus === 'subscription_canceled'
          ? {}
          : { status: { not: 'subscription_canceled' } }),
        OR: buildSessionEventFreshnessWhere(sessionStatus, event.at),
      },
      data: {
        status: sessionStatus,
        lastStripeEventId: event.id,
        lastStripeEventAt: event.at,
      },
    }),
    prisma.paymentQuote.updateMany({
      where: {
        status: { not: 'canceled' },
        checkoutSessions: { some: { stripeSubscriptionId } },
        OR: buildQuoteEventFreshnessWhere(quoteStatus, event.at),
      },
      data: {
        status: quoteStatus,
        lastStripeEventId: event.id,
        lastStripeEventAt: event.at,
      },
    }),
  ])
}

function getCheckoutQuoteStatus(
  session: Stripe.Checkout.Session,
  fulfillment: CheckoutFulfillment
): string {
  if (fulfillment === 'failed') return 'payment_failed'
  if (fulfillment === 'completed' && session.payment_status !== 'paid') return 'awaiting_payment'

  return session.mode === 'subscription' || getStripeObjectId(session.subscription)
    ? 'active'
    : 'paid'
}

function isPaidQuoteStatus(status: string): boolean {
  return status === 'paid' || status === 'active'
}

function getEventCursor(event: Stripe.Event): StripeEventCursor {
  return { id: event.id, at: new Date(event.created * 1000) }
}

function shouldApplyCheckoutSessionStatus(
  currentStatus: string | undefined,
  targetStatus: string,
  currentQuoteStatus: string | undefined,
  lastEventAt: Date | null | undefined,
  eventAt: Date
): boolean {
  if (isOlderStripeEvent(lastEventAt, eventAt)) return false
  if (
    currentQuoteStatus &&
    isPaidQuoteStatus(currentQuoteStatus) &&
    targetStatus === 'payment_failed'
  ) {
    return false
  }
  if (currentStatus === 'payment_failed' && targetStatus !== 'payment_failed') return false
  if (isSubscriptionDerivedStatus(currentStatus) && !isSubscriptionDerivedStatus(targetStatus)) {
    return false
  }
  return true
}

function shouldApplyCheckoutQuoteStatus(
  currentStatus: string | undefined,
  targetStatus: string,
  lastEventAt: Date | null | undefined,
  eventAt: Date
): boolean {
  if (isOlderStripeEvent(lastEventAt, eventAt)) return false
  if (!currentStatus || currentStatus === targetStatus) return true
  if (currentStatus === 'canceled') return false
  if (currentStatus === 'payment_failed' && targetStatus !== 'payment_failed') return false
  if (isPaidQuoteStatus(currentStatus) && !isPaidQuoteStatus(targetStatus)) return false
  return true
}

function isOlderStripeEvent(lastEventAt: Date | null | undefined, eventAt: Date): boolean {
  return Boolean(lastEventAt && eventAt < lastEventAt)
}

function isSubscriptionDerivedStatus(status: string | undefined): boolean {
  return (
    status === 'invoice_paid' ||
    status === 'invoice_payment_failed' ||
    status === 'subscription_canceled'
  )
}

function buildQuoteEventFreshnessWhere(targetStatus: string, eventAt: Date) {
  return [
    { lastStripeEventAt: null },
    { lastStripeEventAt: { lt: eventAt } },
    {
      AND: [
        { lastStripeEventAt: eventAt },
        { status: { in: getSameSecondAllowedQuoteStatuses(targetStatus) } },
      ],
    },
  ]
}

function buildSessionEventFreshnessWhere(targetStatus: string, eventAt: Date) {
  return [
    { lastStripeEventAt: null },
    { lastStripeEventAt: { lt: eventAt } },
    {
      AND: [
        { lastStripeEventAt: eventAt },
        { status: { in: getSameSecondAllowedSessionStatuses(targetStatus) } },
      ],
    },
  ]
}

function getSameSecondAllowedQuoteStatuses(targetStatus: string): string[] {
  const statuses = [
    'pending_checkout',
    'checkout_created',
    'stripe_create_failed',
    'checkout_persist_failed',
    'stripe_missing_url',
    'awaiting_payment',
    'paid',
    'active',
    'payment_failed',
    'canceled',
  ]

  return statuses.filter(
    (status) => getQuoteStatusPriority(status) <= getQuoteStatusPriority(targetStatus)
  )
}

function getSameSecondAllowedSessionStatuses(targetStatus: string): string[] {
  const statuses = [
    'created',
    'open',
    'complete',
    'expired',
    'invoice_paid',
    'payment_failed',
    'invoice_payment_failed',
    'subscription_canceled',
  ]

  return statuses.filter(
    (status) => getSessionStatusPriority(status) <= getSessionStatusPriority(targetStatus)
  )
}

function getQuoteStatusPriority(status: string): number {
  if (status === 'canceled') return 50
  if (status === 'payment_failed') return 40
  if (status === 'paid' || status === 'active') return 30
  if (status === 'awaiting_payment') return 20
  return 10
}

function getSessionStatusPriority(status: string): number {
  if (status === 'subscription_canceled') return 50
  if (status === 'payment_failed' || status === 'invoice_payment_failed') return 40
  if (status === 'invoice_paid') return 30
  if (status === 'complete') return 20
  return 10
}

function getPaymentQuoteId(session: Stripe.Checkout.Session): string | null {
  const metadata = session.metadata ?? {}
  return metadata.paymentQuoteId || metadata.quoteId || null
}

function getSubscriptionId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null

  const object = value as {
    id?: unknown
    object?: unknown
    subscription?: unknown
    parent?: {
      subscription_details?: {
        subscription?: unknown
      }
    }
  }

  if (object.object === 'subscription') {
    return typeof object.id === 'string' ? object.id : null
  }

  return (
    getStripeObjectId(object.subscription) ??
    getStripeObjectId(object.parent?.subscription_details?.subscription)
  )
}

function getStripeObjectId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null

  const id = (value as { id?: unknown }).id
  return typeof id === 'string' ? id : null
}
