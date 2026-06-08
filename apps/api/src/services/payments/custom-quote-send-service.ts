/**
 * Sendable custom (free-form) quote: build a frozen CheckoutQuote from typed
 * line items, persist it with a portal pay token + recipient + sender, then SMS
 * the pay link. Mirrors `quote-send-service.ts`, but the frozen `lineItems` (not
 * a `pricingInput`) are the rebuild source on the portal at checkout time.
 */
import { prisma } from '../../lib/db'
import type { SendCustomQuoteInput } from '../../routes/billing/schemas'
import { buildCustomQuote } from '../stripe/custom-quote-builder'
import { CheckoutQuoteError } from '../stripe/quote-calculator'
import { buildCustomQuoteData } from '../stripe/persistence'
import { getActiveCouponById } from '../coupons/coupon-service'
import {
  buildQuotePayUrl,
  generatePayToken,
  resolveOrgName,
  resolveRecipient,
  sendQuotePayLinkSms,
  type CreateSendableQuoteContext,
  type SendableQuoteResult,
} from './quote-send-shared'

export async function createSendableCustomQuote(
  input: SendCustomQuoteInput,
  context: CreateSendableQuoteContext,
): Promise<SendableQuoteResult> {
  const { quote, lineItems, billingInterval } = buildCustomQuote({
    billingInterval: input.billingInterval,
    items: input.items,
    oneTimeItems: input.oneTimeItems,
  })

  // Validate the owner-selected coupon up front so a bad id is a clean 400, not
  // a silently-dropped discount at checkout (resolution re-fetches it then).
  if (input.couponId) {
    const coupon = await getActiveCouponById(input.couponId, context.organizationId)
    if (!coupon?.stripeCouponId) throw new CheckoutQuoteError('Selected coupon is not available')
  }

  const orgName = await resolveOrgName(context.organizationId)
  const recipient = await resolveRecipient(input.recipient, context.organizationId)

  const payToken = generatePayToken()
  await prisma.paymentQuote.create({
    data: {
      ...buildCustomQuoteData({
        quote,
        lineItems,
        billingInterval,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        businessName: input.businessName,
        appliedCouponId: input.couponId,
        allowPromotionCodes: input.allowPromotionCodes,
      }),
      organizationId: context.organizationId,
      clientId: input.recipient.type === 'client' ? recipient.id : null,
      leadId: input.recipient.type === 'lead' ? recipient.id : null,
      status: 'sent',
      payToken,
      sentAt: new Date(),
      sentByStaffId: context.staffId,
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
