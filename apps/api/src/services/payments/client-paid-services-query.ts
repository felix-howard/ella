import { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import type { PaidServiceSessionEvidence } from './paid-service-lifecycle'
export interface ClientPaidServicesQuoteRow {
  id: string
  organizationId: string | null
  clientId: string | null
  source: string
  billingInterval: string | null
  status: string
  lastStripeEventAt: Date | null
  createdAt: Date
  resultSnapshot: unknown
  payToken: string | null
  sentAt: Date | null
  agreement: {
    id: string
    title: string
    status: string
    source: string
    type: string
    clientId: string | null
    organizationId: string
    paymentQuoteId: string | null
    signedAt: Date | null
  } | null
  payments: Array<{
    paymentQuoteId: string | null
    organizationId: string
    clientId: string | null
    type: string
    status: string
    paidAt: Date | null
  }>
  checkoutSessions: PaidServiceSessionEvidence[]
}
interface PaymentEvidenceAggregate {
  paymentQuoteId: string | null
  type: string
  status: string
  _min: { paidAt: Date | null }
}
interface CheckoutEvidenceAggregate {
  paymentQuoteId: string
  canceledAt: Date | null
  latestHealthStatus: string | null
  latestHealthAt: Date | null
}

export interface ClientPaidServicesQuotePage {
  quotes: ClientPaidServicesQuoteRow[]
  nextCursor: ClientPaidServicesCursor | null
}

export interface ClientPaidServicesCursor {
  firstPaidAt: Date
  quoteId: string
}

export async function loadClientPaidServiceQuotes(input: {
  clientId: string
  organizationId: string
  cursor?: ClientPaidServicesCursor | null
  limit?: number
}): Promise<ClientPaidServicesQuotePage> {
  const { clientId, organizationId, cursor = null, limit = 100 } = input
  const evidenceFilter = {
    clientId,
    organizationId,
    type: { in: ['OTHER', 'RECURRING'] },
    status: { in: ['PAID', 'REFUNDED'] },
    paidAt: { not: null },
  } satisfies Prisma.PaymentWhereInput
  const eligibleQuoteFilter = {
    clientId,
    organizationId,
    OR: [
      { source: 'custom', payToken: { not: null }, sentAt: { not: null } },
      {
        source: 'calculator',
        agreement: {
          is: {
            status: 'SIGNED',
            source: 'CALCULATOR',
            type: 'ENGAGEMENT_LETTER',
            clientId,
            organizationId,
          },
        },
      },
    ],
  } satisfies Prisma.PaymentQuoteWhereInput
  const candidateAggregates = await prisma.payment.groupBy({
    by: ['paymentQuoteId'] as const,
    where: {
      ...evidenceFilter,
      paymentQuoteId: { not: null },
      paymentQuote: { is: eligibleQuoteFilter },
    },
    _min: { paidAt: true },
    having: cursor ? {
      OR: [
        { paidAt: { _min: { lt: cursor.firstPaidAt } } },
        {
          AND: [
            { paidAt: { _min: { equals: cursor.firstPaidAt } } },
            { paymentQuoteId: { gt: cursor.quoteId } },
          ],
        },
      ],
    } : undefined,
    orderBy: [{ _min: { paidAt: 'desc' } }, { paymentQuoteId: 'asc' }],
    take: limit + 1,
  })
  const visibleCandidates = candidateAggregates.slice(0, limit)
  const quoteIds = visibleCandidates.flatMap(({ paymentQuoteId }) =>
    paymentQuoteId ? [paymentQuoteId] : [])
  if (quoteIds.length === 0) return { quotes: [], nextCursor: null }

  const quotes = await prisma.paymentQuote.findMany({
    where: { id: { in: quoteIds }, ...eligibleQuoteFilter },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      source: true,
      billingInterval: true,
      status: true,
      lastStripeEventAt: true,
      createdAt: true,
      resultSnapshot: true,
      payToken: true,
      sentAt: true,
      agreement: {
        select: {
          id: true,
          title: true,
          status: true,
          source: true,
          type: true,
          clientId: true,
          organizationId: true,
          paymentQuoteId: true,
          signedAt: true,
        },
      },
    },
  })
  const [paymentAggregates, checkoutAggregates] = await Promise.all([
    prisma.payment.groupBy({
      by: ['paymentQuoteId', 'type', 'status'],
      where: { ...evidenceFilter, paymentQuoteId: { in: quoteIds } },
      _min: { paidAt: true },
    }),
    loadCheckoutEvidence(quoteIds),
  ])
  const paymentsByQuote = indexPaymentEvidence(paymentAggregates as PaymentEvidenceAggregate[], input)
  const sessionsByQuote = indexCheckoutEvidence(checkoutAggregates)
  const quotesById = new Map(quotes.map((quote) => [quote.id, quote]))
  const lastVisible = visibleCandidates.at(-1)
  const nextCursor = candidateAggregates.length > limit &&
    lastVisible?.paymentQuoteId && lastVisible._min.paidAt
    ? { firstPaidAt: lastVisible._min.paidAt, quoteId: lastVisible.paymentQuoteId }
    : null
  return {
    quotes: quoteIds.flatMap((quoteId) => {
      const quote = quotesById.get(quoteId)
      return quote ? [{
        ...quote,
        payments: paymentsByQuote.get(quote.id) ?? [],
        checkoutSessions: sessionsByQuote.get(quote.id) ?? [],
      }] : []
    }),
    nextCursor,
  }
}
function indexPaymentEvidence(
  aggregates: PaymentEvidenceAggregate[],
  scope: { clientId: string; organizationId: string },
): Map<string, ClientPaidServicesQuoteRow['payments']> {
  const result = new Map<string, ClientPaidServicesQuoteRow['payments']>()
  for (const row of aggregates) {
    if (!row.paymentQuoteId || !row._min.paidAt) continue
    const evidence = result.get(row.paymentQuoteId) ?? []
    evidence.push({
      paymentQuoteId: row.paymentQuoteId,
      organizationId: scope.organizationId,
      clientId: scope.clientId,
      type: row.type,
      status: row.status,
      paidAt: row._min.paidAt,
    })
    result.set(row.paymentQuoteId, evidence)
  }
  return result
}
function indexCheckoutEvidence(
  aggregates: CheckoutEvidenceAggregate[],
): Map<string, PaidServiceSessionEvidence[]> {
  return new Map(aggregates.map((row) => {
    const evidence: PaidServiceSessionEvidence[] = []
    if (row.latestHealthStatus && row.latestHealthAt) {
      evidence.push(sessionEvidence(row.latestHealthStatus, row.latestHealthAt))
    }
    if (row.canceledAt) evidence.push(sessionEvidence('subscription_canceled', row.canceledAt))
    return [row.paymentQuoteId, evidence]
  }))
}
function sessionEvidence(status: string, at: Date): PaidServiceSessionEvidence {
  return { status, lastStripeEventAt: at, updatedAt: at, createdAt: at }
}

/**
 * Prisma relation selects cannot rank by COALESCE(lastStripeEventAt, updatedAt,
 * createdAt). PostgreSQL reduces unbounded session history to one deterministic
 * health row plus cancellation evidence per quote without changing precedence.
 */
async function loadCheckoutEvidence(quoteIds: string[]): Promise<CheckoutEvidenceAggregate[]> {
  return prisma.$queryRaw<CheckoutEvidenceAggregate[]>(Prisma.sql`
    WITH "rankedHealth" AS (
      SELECT
        "paymentQuoteId",
        "status",
        COALESCE("lastStripeEventAt", "updatedAt", "createdAt") AS "evidenceAt",
        ROW_NUMBER() OVER (
          PARTITION BY "paymentQuoteId"
          ORDER BY
            COALESCE("lastStripeEventAt", "updatedAt", "createdAt") DESC,
            "updatedAt" DESC,
            "createdAt" DESC,
            "id" ASC
        ) AS "rank"
      FROM "StripeCheckoutSession"
      WHERE "paymentQuoteId" IN (${Prisma.join(quoteIds)})
        AND "status" IN ('payment_failed', 'invoice_payment_failed', 'complete', 'invoice_paid')
    ),
    "latestHealth" AS (
      SELECT "paymentQuoteId", "status", "evidenceAt"
      FROM "rankedHealth"
      WHERE "rank" = 1
    ),
    "cancellations" AS (
      SELECT
        "paymentQuoteId",
        MAX(COALESCE("lastStripeEventAt", "updatedAt", "createdAt")) AS "canceledAt"
      FROM "StripeCheckoutSession"
      WHERE "paymentQuoteId" IN (${Prisma.join(quoteIds)})
        AND "status" = 'subscription_canceled'
      GROUP BY "paymentQuoteId"
    )
    SELECT
      "paymentQuoteId",
      "cancellations"."canceledAt",
      "latestHealth"."status" AS "latestHealthStatus",
      "latestHealth"."evidenceAt" AS "latestHealthAt"
    FROM "latestHealth"
    FULL OUTER JOIN "cancellations" USING ("paymentQuoteId")
  `)
}
