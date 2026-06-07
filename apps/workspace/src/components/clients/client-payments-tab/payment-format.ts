/**
 * Shared formatting helpers for client payment amounts.
 * Payment.amount is a decimal serialized as string (e.g. "500.00"), USD-only
 * for now (Payment.currency defaults to "usd").
 */
export function formatUsdAmount(amount: string | number): string {
  const parsed = Number(amount)
  if (!Number.isFinite(parsed)) return `$${amount}`
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(parsed)
}

/** Sum of `amount` over PAID payments, formatted as USD. */
export function sumPaidAmount(payments: Array<{ status: string; amount: string }>): number {
  return payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
}
