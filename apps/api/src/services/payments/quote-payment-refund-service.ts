import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { stripeIdOf } from './quote-fulfillment-types'

export interface QuotePaymentRefundFacts {
  chargeId: string | null
  paymentIntentId: string | null
  isFullyRefunded: boolean
}

interface RefundCandidate {
  id: string
  paymentQuoteId: string | null
  status: string
  stripeChargeId: string | null
}

type MatchedRefundCandidate = RefundCandidate & {
  matchedBy: 'charge' | 'payment_intent'
}

type RefundEvidenceDb = Pick<
  Prisma.TransactionClient,
  '$executeRaw' | 'payment' | 'stripeWebhookEventLog'
>

const refundCandidateSelect = {
  id: true,
  paymentQuoteId: true,
  status: true,
  stripeChargeId: true,
} as const

/** Extract only the non-sensitive Charge facts required for refund synchronization. */
export function extractQuotePaymentRefundFacts(value: unknown): QuotePaymentRefundFacts {
  const charge = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const amount = nonNegativeInteger(charge.amount)
  const amountRefunded = nonNegativeInteger(charge.amount_refunded)

  return {
    chargeId: typeof charge.id === 'string' ? charge.id : null,
    paymentIntentId: stripeIdOf(charge.payment_intent),
    isFullyRefunded:
      charge.refunded === true ||
      (amount !== null && amount > 0 && amountRefunded !== null && amountRefunded >= amount),
  }
}

/** Persist refund evidence, then update an existing quote-generated Payment when present. */
export async function synchronizeQuotePaymentRefund(params: {
  stripeEventId: string
  charge: unknown
}): Promise<boolean> {
  const facts = extractQuotePaymentRefundFacts(params.charge)
  if (!facts.chargeId && !facts.paymentIntentId) return false

  return prisma.$transaction(async (tx) => {
    await lockQuotePaymentRefundReference(tx, facts)
    const recorded = await tx.stripeWebhookEventLog.updateMany({
      where: { stripeEventId: params.stripeEventId, eventType: 'charge.refunded' },
      data: {
        stripePaymentIntentId: facts.paymentIntentId,
        chargeFullyRefunded: facts.isFullyRefunded,
      },
    })
    if (recorded.count !== 1) {
      throw new Error('Stripe refund event evidence could not be persisted')
    }
    if (!facts.isFullyRefunded) return false

    const payment = await findRefundCandidate(tx, facts)
    if (!payment || payment.status !== 'PAID' || !payment.paymentQuoteId) return false

    const where =
      payment.matchedBy === 'charge'
        ? {
            id: payment.id,
            paymentQuoteId: payment.paymentQuoteId,
            status: 'PAID' as const,
            stripeChargeId: facts.chargeId,
          }
        : {
            id: payment.id,
            paymentQuoteId: payment.paymentQuoteId,
            status: 'PAID' as const,
            stripePaymentIntentId: facts.paymentIntentId,
            stripeChargeId: null,
          }

    const updated = await tx.payment.updateMany({
      where,
      data: {
        status: 'REFUNDED',
        ...(payment.stripeChargeId === null && facts.chargeId
          ? { stripeChargeId: facts.chargeId }
          : {}),
      },
    })
    return updated.count === 1
  })
}

/** Serialize Payment creation against refund handling for the same Stripe payment. */
export async function lockQuotePaymentRefundReference(
  db: Pick<Prisma.TransactionClient, '$executeRaw'>,
  facts: Pick<QuotePaymentRefundFacts, 'chargeId' | 'paymentIntentId'>,
): Promise<void> {
  const lockKeys = [facts.chargeId, facts.paymentIntentId]
    .filter((reference): reference is string => reference !== null)
    .map((reference) => `quote-payment-refund:${reference}`)
    .sort()

  for (const lockKey of new Set(lockKeys)) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
  }
}

/** Check durable full-refund evidence before inserting a late Payment row. */
export async function hasRecordedFullQuotePaymentRefund(
  db: Pick<Prisma.TransactionClient, 'stripeWebhookEventLog'>,
  facts: Pick<QuotePaymentRefundFacts, 'chargeId' | 'paymentIntentId'>,
): Promise<boolean> {
  const reference = facts.chargeId
    ? { stripeObjectId: facts.chargeId }
    : facts.paymentIntentId
      ? { stripePaymentIntentId: facts.paymentIntentId }
      : null
  if (!reference) return false

  const event = await db.stripeWebhookEventLog.findFirst({
    where: {
      eventType: 'charge.refunded',
      chargeFullyRefunded: true,
      ...reference,
    },
    select: { id: true },
  })
  return Boolean(event)
}

async function findRefundCandidate(
  db: RefundEvidenceDb,
  facts: QuotePaymentRefundFacts,
): Promise<MatchedRefundCandidate | null> {
  if (facts.chargeId) {
    const byCharge = await db.payment.findMany({
      where: {
        paymentQuoteId: { not: null },
        stripeChargeId: facts.chargeId,
        status: { in: ['PAID', 'REFUNDED'] },
      },
      select: refundCandidateSelect,
      take: 2,
    })
    if (byCharge.length > 0) {
      return byCharge.length === 1 ? { ...byCharge[0]!, matchedBy: 'charge' } : null
    }
  }

  if (!facts.paymentIntentId) return null
  const byPaymentIntent = await db.payment.findMany({
    where: {
      paymentQuoteId: { not: null },
      stripePaymentIntentId: facts.paymentIntentId,
      stripeChargeId: null,
      status: { in: ['PAID', 'REFUNDED'] },
    },
    select: refundCandidateSelect,
    take: 2,
  })
  return byPaymentIntent.length === 1
    ? { ...byPaymentIntent[0]!, matchedBy: 'payment_intent' }
    : null
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}
