/**
 * Sendable pricing quote (calculator source): persist a PaymentQuote with a
 * portal pay token + recipient (Client or Lead) + sender attribution, then SMS
 * the recipient the portal pay link. No Stripe call here — checkout happens on
 * the portal; the webhook layers side-effects onto the PaymentQuote status.
 *
 * The frozen `inputSnapshot` is the immutable source of truth: portal checkout
 * rebuilds the quote from it via `calculateCheckoutQuote()`, so the token always
 * charges the amounts frozen at send time (quote-drift safe). Custom free-form
 * quotes use `custom-quote-send-service.ts` (no `pricingInput` to rebuild from).
 *
 * `sentByStaffId` is persisted now because the webhook has no request context
 * but still needs a staff sender for the receipt SMS (`sendSignerSmsAndPersist`
 * requires `sentById`).
 */
import { prisma } from '../../lib/db'
import type { SendQuoteInput } from '../../routes/billing/schemas'
import { calculateCheckoutQuote } from '../stripe/quote-calculator'
import {
  buildQuotePayUrl,
  generatePayToken,
  resolveOrgName,
  resolveRecipient,
  sendQuotePayLinkSms,
  toPrismaJson,
  type CreateSendableQuoteContext,
  type SendableQuoteResult,
} from './quote-send-shared'

export { buildQuotePayUrl } from './quote-send-shared'
export type { CreateSendableQuoteContext, SendableQuoteResult } from './quote-send-shared'

/**
 * Validate the pricing input, persist a sendable PaymentQuote, and SMS the
 * recipient their portal pay link. SMS failures never fail the send: the quote
 * persists and `smsSent: false` (+ reason) is returned so the UI can offer a
 * copy-link fallback.
 *
 * Throws `CheckoutQuoteError` for an invalid/tampered quote (→ 400 at the route)
 * and `HTTPException(404)` when the recipient isn't found in this org.
 */
export async function createSendableQuote(
  input: SendQuoteInput,
  context: CreateSendableQuoteContext,
): Promise<SendableQuoteResult> {
  // Rebuild + validate from the input the same way portal checkout will, so a
  // tampered/stale rate (below default) is rejected at send time.
  const quote = calculateCheckoutQuote(input.pricingInput)

  const orgName = await resolveOrgName(context.organizationId)
  const recipient = await resolveRecipient(input.recipient, context.organizationId)

  const payToken = generatePayToken()
  await prisma.paymentQuote.create({
    data: {
      id: quote.quoteId,
      organizationId: context.organizationId,
      clientId: input.recipient.type === 'client' ? recipient.id : null,
      leadId: input.recipient.type === 'lead' ? recipient.id : null,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      businessName: input.businessName,
      inputSnapshot: toPrismaJson(buildInputSnapshot(input)),
      resultSnapshot: toPrismaJson(quote),
      monthlyTotalCents: quote.monthlyTotal * 100,
      setupTotalCents: quote.setupTotal * 100,
      status: 'sent',
      payToken,
      sentAt: new Date(),
      sentByStaffId: context.staffId,
      // Same staff created and sent it — keep the indexed createdByStaffId
      // reporting path populated, mirroring the anonymous checkout flow.
      createdByStaffId: context.staffId,
    },
  })

  const payUrl = buildQuotePayUrl(payToken)
  const { smsSent, smsSkippedReason } = await sendQuotePayLinkSms({
    recipient,
    recipientType: input.recipient.type,
    orgName,
    organizationId: context.organizationId,
    staffId: context.staffId,
    payUrl,
  })

  return { quoteId: quote.quoteId, payToken, payUrl, smsSent, smsSkippedReason }
}

/**
 * Freeze the same shape the anonymous checkout flow persists, so portal checkout
 * can rebuild the quote from `inputSnapshot.pricingInput` uniformly.
 */
function buildInputSnapshot(input: SendQuoteInput): Omit<SendQuoteInput, 'recipient'> {
  return {
    pricingInput: input.pricingInput,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    businessName: input.businessName,
  }
}
