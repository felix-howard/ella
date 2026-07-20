import type { PaidServiceCategory } from './paid-service-snapshot-parser'

export type PaidServiceStatus = 'PAID' | 'ACTIVE' | 'PAST_DUE' | 'ENDED' | 'REFUNDED'

export interface PaidServicePaymentEvidence {
  type: string
  status: string
  paidAt: Date
}

export interface PaidServiceSessionEvidence {
  status: string
  lastStripeEventAt: Date | null
  updatedAt: Date
  createdAt: Date
}

export function derivePaidServiceStatus(input: {
  category: PaidServiceCategory
  payments: PaidServicePaymentEvidence[]
  quoteStatus: string
  quoteLastStripeEventAt: Date | null
  sessions: PaidServiceSessionEvidence[]
}): PaidServiceStatus | null {
  const evidence =
    input.category === 'ONE_TIME'
      ? input.payments.filter((payment) => payment.type === 'OTHER')
      : input.payments
  if (evidence.length === 0) return null
  if (evidence.every((payment) => payment.status === 'REFUNDED')) return 'REFUNDED'
  if (input.category === 'ONE_TIME') return 'PAID'
  if (isSubscriptionEnded(input.quoteStatus, input.sessions)) return 'ENDED'
  return latestRecurringHealth(input) === 'failed' ? 'PAST_DUE' : 'ACTIVE'
}

function isSubscriptionEnded(
  quoteStatus: string,
  sessions: PaidServiceSessionEvidence[],
): boolean {
  return (
    quoteStatus === 'canceled' ||
    sessions.some((session) => session.status === 'subscription_canceled')
  )
}

function latestRecurringHealth(input: {
  quoteStatus: string
  quoteLastStripeEventAt: Date | null
  sessions: PaidServiceSessionEvidence[]
}): 'healthy' | 'failed' {
  const quoteFailed = input.quoteStatus === 'payment_failed'
  let latest = {
    health: quoteFailed ? ('failed' as const) : ('healthy' as const),
    // A failed quote without its event timestamp is inconsistent but must fail
    // closed; an older healthy session cannot safely prove recovery.
    timestamp: input.quoteLastStripeEventAt?.getTime() ?? (quoteFailed ? Infinity : 0),
  }

  for (const session of input.sessions) {
    const health = sessionHealth(session.status)
    if (!health) continue
    const timestamp = (session.lastStripeEventAt ?? session.updatedAt ?? session.createdAt).getTime()
    if (timestamp > latest.timestamp) latest = { health, timestamp }
  }
  return latest.health
}

function sessionHealth(status: string): 'healthy' | 'failed' | null {
  if (['payment_failed', 'invoice_payment_failed'].includes(status)) return 'failed'
  if (['complete', 'invoice_paid'].includes(status)) return 'healthy'
  return null
}
