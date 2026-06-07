/**
 * SMS copy for the deposit payment flow. Kept separate from send/persist
 * logic so the templates can evolve (EN/VI, copy tweaks) without touching
 * payment plumbing. Phase 3 (webhook) reuses the receipt + admin-paid
 * templates; Phase 2 uses pay-link + admin-signed.
 *
 * v1: language hardcoded to EN, mirroring agreement-invite templates.
 */

/** templateUsed marker persisted on Message rows for the client pay-link SMS. */
export const DEPOSIT_PAY_LINK_TEMPLATE_NAME = 'deposit_pay_link'
/** templateUsed marker for the client payment receipt SMS (phase 3). */
export const DEPOSIT_RECEIPT_TEMPLATE_NAME = 'deposit_receipt'

/**
 * Format a Prisma Decimal (or anything stringable) as `$300.00`.
 * USD-only by design — Payment.currency is always 'usd' in v1; revisit all
 * call sites (admin + receipt SMS, pay page) if multi-currency ever lands.
 */
export function formatUsdAmount(amount: { toString(): string }): string {
  const numeric = Number(amount.toString())
  if (Number.isNaN(numeric)) return `$${amount.toString()}`
  return `$${numeric.toFixed(2)}`
}

/** Client SMS: portal pay link sent right after signing. */
export function buildDepositPayLinkMessage(params: {
  firstName: string
  amountFormatted: string
  orgName: string
  url: string
}): string {
  return (
    `Hi ${params.firstName}, thanks for signing! Please pay your ` +
    `${params.amountFormatted} retainer here: ${params.url}\n\n- ${params.orgName}`
  )
}

/** Client SMS: receipt confirmation after Stripe marks the payment paid. */
export function buildDepositReceiptMessage(params: {
  firstName: string
  amountFormatted: string
  orgName: string
}): string {
  return (
    `Hi ${params.firstName}, we received your ${params.amountFormatted} ` +
    `retainer payment. Thank you!\n\n- ${params.orgName}`
  )
}

/** Admin SMS: a client signed an agreement (deposit line only when one applies). */
export function buildAdminAgreementSignedMessage(params: {
  signerName: string
  agreementTitle: string
  amountFormatted: string | null
}): string {
  const depositSuffix = params.amountFormatted
    ? ` (${params.amountFormatted} deposit pending)`
    : ''
  return `${params.signerName} signed ${params.agreementTitle}${depositSuffix}`
}

/** Admin SMS: a client completed a payment (phase 3). */
export function buildAdminPaymentReceivedMessage(params: {
  payerName: string
  amountFormatted: string
  agreementTitle: string | null
}): string {
  const forSuffix = params.agreementTitle ? ` for ${params.agreementTitle}` : ''
  return `${params.payerName} paid ${params.amountFormatted}${forSuffix}`
}
