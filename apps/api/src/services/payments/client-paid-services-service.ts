import {
  parsePaidServiceSnapshot,
  type NormalizedPaidServiceItem,
  type PaidServiceCadence,
  type PaidServiceCategory,
} from './paid-service-snapshot-parser'
import {
  derivePaidServiceStatus,
  type PaidServiceStatus,
} from './paid-service-lifecycle'
import {
  loadClientPaidServiceQuotes,
  type ClientPaidServicesQuoteRow,
  type ClientPaidServicesCursor,
} from './client-paid-services-query'

export type { ClientPaidServicesQuoteRow } from './client-paid-services-query'

export type ClientPaidServiceSource = 'CALCULATOR_AGREEMENT' | 'CUSTOM_LINK'

export interface ClientPaidServiceItem {
  id: string
  label: string
  description: string | null
  category: PaidServiceCategory
  cadence: PaidServiceCadence
  status: PaidServiceStatus
}

export interface ClientPaidServiceGroup {
  id: string
  source: ClientPaidServiceSource
  paidAt: string
  agreement: { id: string; title: string; signedAt: string | null } | null
  items: ClientPaidServiceItem[]
}

export interface ClientPaidServicesResult {
  data: ClientPaidServiceGroup[]
  meta: { isTruncated: boolean; limit: number }
}

const PAID_SERVICES_VIEW_LIMIT = 100

interface ProjectedPaidServiceGroup {
  group: ClientPaidServiceGroup
  quoteCreatedAt: Date
}

export async function listClientPaidServices(input: {
  clientId: string
  organizationId: string
}): Promise<ClientPaidServicesResult> {
  const data: ClientPaidServiceGroup[] = []
  let cursor: ClientPaidServicesCursor | null = null
  let hasMoreCandidates = true
  while (data.length <= PAID_SERVICES_VIEW_LIMIT && hasMoreCandidates) {
    const page = await loadClientPaidServiceQuotes({
      ...input,
      cursor,
      limit: PAID_SERVICES_VIEW_LIMIT,
    })
    data.push(...projectClientPaidServices(page.quotes, input))
    cursor = page.nextCursor
    hasMoreCandidates = cursor !== null
  }
  return {
    data: data.slice(0, PAID_SERVICES_VIEW_LIMIT),
    meta: {
      isTruncated: data.length > PAID_SERVICES_VIEW_LIMIT,
      limit: PAID_SERVICES_VIEW_LIMIT,
    },
  }
}

export function projectClientPaidServices(
  quotes: ClientPaidServicesQuoteRow[],
  scope: { clientId: string; organizationId: string },
): ClientPaidServiceGroup[] {
  return quotes
    .map((quote) => projectQuote(quote, scope))
    .filter((projected): projected is ProjectedPaidServiceGroup => Boolean(projected))
    .sort((a, b) =>
      b.group.paidAt.localeCompare(a.group.paidAt) ||
      b.quoteCreatedAt.getTime() - a.quoteCreatedAt.getTime() ||
      a.group.id.localeCompare(b.group.id),
    )
    .map(({ group }) => group)
}

function projectQuote(
  quote: ClientPaidServicesQuoteRow,
  scope: { clientId: string; organizationId: string },
): ProjectedPaidServiceGroup | null {
  if (quote.clientId !== scope.clientId || quote.organizationId !== scope.organizationId) return null
  const source = eligibleSource(quote, scope)
  if (!source) return null
  const payments = quote.payments
    .filter((payment) => isQualifyingPayment(payment, quote.id, scope))
    .flatMap((payment) => (payment.paidAt ? [{ ...payment, paidAt: payment.paidAt }] : []))
  if (payments.length === 0) return null

  let normalized: NormalizedPaidServiceItem[]
  try {
    normalized = parsePaidServiceSnapshot({
      quoteId: quote.id,
      source: quote.source,
      billingInterval: quote.billingInterval,
      snapshot: quote.resultSnapshot,
    })
  } catch (error) {
    const errorClass = error instanceof Error ? error.name : 'UnknownError'
    console.warn(`[PaidServices] Skipping malformed quote=${quote.id} error=${errorClass}`)
    return null
  }

  const items = serializeItems(normalized, quote, payments)
  if (items.length === 0) return null
  return {
    quoteCreatedAt: quote.createdAt,
    group: {
      id: quote.id,
      source,
      paidAt: earliestPaidAt(payments).toISOString(),
      agreement: source === 'CALCULATOR_AGREEMENT' ? safeAgreement(quote.agreement) : null,
      items,
    },
  }
}

function serializeItems(
  items: NormalizedPaidServiceItem[],
  quote: ClientPaidServicesQuoteRow,
  payments: Array<{ type: string; status: string; paidAt: Date }>,
): ClientPaidServiceItem[] {
  return items.flatMap((item) => {
    const status = derivePaidServiceStatus({
      category: item.category,
      payments,
      quoteStatus: quote.status,
      quoteLastStripeEventAt: quote.lastStripeEventAt,
      sessions: quote.checkoutSessions,
    })
    return status ? [{ ...item, status }] : []
  })
}

function eligibleSource(
  quote: ClientPaidServicesQuoteRow,
  scope: { clientId: string; organizationId: string },
): ClientPaidServiceSource | null {
  if (quote.source === 'custom') {
    return quote.payToken && quote.sentAt ? 'CUSTOM_LINK' : null
  }
  const agreement = quote.agreement
  // Agreement.status is the signing invariant; signedAt is nullable historical
  // metadata and remains optional in the staff-safe response.
  if (
    quote.source !== 'calculator' ||
    !agreement ||
    agreement.status !== 'SIGNED' ||
    agreement.source !== 'CALCULATOR' ||
    agreement.type !== 'ENGAGEMENT_LETTER' ||
    agreement.clientId !== scope.clientId ||
    agreement.organizationId !== scope.organizationId ||
    agreement.paymentQuoteId !== quote.id
  ) return null
  return 'CALCULATOR_AGREEMENT'
}

function isQualifyingPayment(
  payment: ClientPaidServicesQuoteRow['payments'][number],
  quoteId: string,
  scope: { clientId: string; organizationId: string },
): boolean {
  return (
    payment.paymentQuoteId === quoteId &&
    payment.clientId === scope.clientId &&
    payment.organizationId === scope.organizationId &&
    ['OTHER', 'RECURRING'].includes(payment.type) &&
    ['PAID', 'REFUNDED'].includes(payment.status)
  )
}

function earliestPaidAt(payments: Array<{ paidAt: Date }>): Date {
  return payments.reduce((earliest, payment) =>
    payment.paidAt < earliest ? payment.paidAt : earliest, payments[0].paidAt)
}

function safeAgreement(agreement: ClientPaidServicesQuoteRow['agreement']) {
  return agreement
    ? { id: agreement.id, title: agreement.title, signedAt: agreement.signedAt?.toISOString() ?? null }
    : null
}
