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

/** templateUsed marker for the sent-quote portal pay-link SMS. */
export const QUOTE_PAY_LINK_TEMPLATE_NAME = 'quote_pay_link'
/** templateUsed marker for the first-payment receipt SMS on a sent quote. */
export const QUOTE_RECEIPT_TEMPLATE_NAME = 'quote_receipt'

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
  url: string
}): string {
  return (
    `Hi ${params.firstName}, thanks for signing! Please pay your ` +
    `${params.amountFormatted} initial payment here: ${params.url}`
  )
}

/** Client SMS: receipt confirmation after Stripe marks the payment paid. */
export function buildDepositReceiptMessage(params: {
  firstName: string
  amountFormatted: string
}): string {
  return `Hi ${params.firstName}, we received your ${params.amountFormatted} initial payment. Thank you!`
}

/** Admin SMS: a client signed an agreement (deposit line only when one applies). */
export function buildAdminAgreementSignedMessage(params: {
  signerName: string
  agreementTitle: string
  amountFormatted: string | null
}): string {
  const depositSuffix = params.amountFormatted
    ? ` (${params.amountFormatted} initial payment pending)`
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

/** Client SMS: portal pay link for a quote sent to a Client or Lead. */
export function buildQuotePayLinkMessage(params: {
  firstName: string
  orgName: string
  url: string
}): string {
  return (
    `Hi ${params.firstName}, here's your quote from ${params.orgName}. ` +
    `Review and pay here: ${params.url}`
  )
}

/** Client SMS: receipt confirmation after the first quote payment is collected. */
export function buildQuoteReceiptMessage(params: {
  firstName: string
  amountFormatted: string
}): string {
  return `Hi ${params.firstName}, we received your ${params.amountFormatted} payment. Thank you!`
}

/** Admin SMS: a client paid a sent quote (first payment). */
export function buildAdminQuotePaidMessage(params: {
  payerName: string
  amountFormatted: string
}): string {
  return `${params.payerName} paid ${params.amountFormatted} (quote)`
}

/** Admin SMS: a recurring quote charge failed — staff should chase the card. */
export function buildAdminPaymentFailedMessage(params: {
  payerName: string
  amountFormatted: string
}): string {
  return (
    `Payment failed: couldn't collect ${params.amountFormatted} from ` +
    `${params.payerName}. Follow up to update their card.`
  )
}
