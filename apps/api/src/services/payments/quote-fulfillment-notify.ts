/**
 * SMS side-effects for sent-quote fulfillment, mirroring
 * `notifyDepositPaymentPaid`: an ADMIN fan-out gated on a per-staff toggle plus
 * a client receipt.
 *
 * Kept separate from quote-fulfillment-service so the Payment-row plumbing and
 * the notification copy can evolve independently.
 */
import { smsOptedInAdmins } from '../agreements/agreement-post-sign-notifications'
import { sendSignerSmsAndPersist } from './signer-sms-delivery'
import {
  buildAdminDuplicateQuotePaymentMessage,
  buildAdminPaymentFailedMessage,
  buildAdminQuotePaidMessage,
  buildQuoteReceiptMessage,
  formatUsdAmount,
  QUOTE_RECEIPT_TEMPLATE_NAME,
} from './payment-sms-templates'
import type { QuoteSigner, SendableQuote } from './quote-fulfillment-types'

function payerNameOf(signer: QuoteSigner | null): string {
  if (!signer) return 'A client'
  return [signer.firstName, signer.lastName].filter(Boolean).join(' ') || 'A client'
}

/**
 * First sent-quote payment: notify opted-in admins (notifyOnClientPayment) and
 * text the payer a receipt. Each step is isolated so one failure never blocks
 * the other. `sentById` is the quote's sender (required for Message/SmsSendLog).
 */
export async function notifyFirstQuotePayment(params: {
  quote: SendableQuote
  signer: QuoteSigner | null
  amountFormatted: string
}): Promise<void> {
  const { quote, signer, amountFormatted } = params
  if (!quote.organizationId) return
  const payerName = payerNameOf(signer)

  try {
    await smsOptedInAdmins({
      organizationId: quote.organizationId,
      toggle: 'notifyOnClientPayment',
      message: buildAdminQuotePaidMessage({ payerName, amountFormatted }),
      logContext: `quote=${quote.id} paid`,
    })
  } catch (err) {
    console.error(`[QuoteFulfillment] Admin paid-notification failed for quote=${quote.id}:`, err)
  }

  if (!signer || !quote.sentByStaffId) {
    console.warn(
      `[QuoteFulfillment] Receipt SMS skipped for quote=${quote.id} — missing ${signer ? 'sender' : 'signer'}`,
    )
    return
  }

  const receiptTarget = {
    signerId: signer.id,
    signerKind: signer.kind,
    organizationId: quote.organizationId,
    sentById: quote.sentByStaffId,
  } as const
  const receiptMessage = buildQuoteReceiptMessage({ firstName: signer.firstName, amountFormatted })

  try {
    await sendSignerSmsAndPersist(
      receiptTarget,
      receiptMessage,
      QUOTE_RECEIPT_TEMPLATE_NAME,
    )
  } catch (err) {
    console.error(`[QuoteFulfillment] Receipt SMS failed for quote=${quote.id}:`, err)
  }
}

/**
 * Duplicate first-payment settlement: alert admins only. Client receipt was
 * already sent for the first successful quote payment.
 */
export async function notifyDuplicateQuotePayment(params: {
  quote: SendableQuote
  signer: QuoteSigner | null
  amountFormatted: string
  stripeSessionId: string
  stripePaymentIntentId: string | null
}): Promise<void> {
  const { quote, signer, amountFormatted, stripeSessionId, stripePaymentIntentId } = params
  if (!quote.organizationId) return

  try {
    await smsOptedInAdmins({
      organizationId: quote.organizationId,
      toggle: 'notifyOnClientPayment',
      message: buildAdminDuplicateQuotePaymentMessage({
        payerName: payerNameOf(signer),
        amountFormatted,
        stripeSessionId,
        stripePaymentIntentId,
      }),
      logContext: `quote=${quote.id} duplicate_payment_review`,
    })
  } catch (err) {
    console.error(`[QuoteFulfillment] Duplicate-payment admin alert failed for quote=${quote.id}:`, err)
  }
}

/**
 * Recurring charge failed: alert opted-in admins (notifyOnPaymentFailed) so they
 * can chase the client to update their card. No client SMS — Stripe dunning
 * handles card-update emails.
 */
export async function notifyQuotePaymentFailed(params: {
  quote: SendableQuote
  signer: QuoteSigner | null
  amountFormatted: string
}): Promise<void> {
  const { quote, signer, amountFormatted } = params
  if (!quote.organizationId) return

  try {
    await smsOptedInAdmins({
      organizationId: quote.organizationId,
      toggle: 'notifyOnPaymentFailed',
      message: buildAdminPaymentFailedMessage({
        payerName: payerNameOf(signer),
        amountFormatted,
      }),
      logContext: `quote=${quote.id} payment_failed`,
    })
  } catch (err) {
    console.error(`[QuoteFulfillment] Failed-charge admin alert failed for quote=${quote.id}:`, err)
  }
}

export { formatUsdAmount }
