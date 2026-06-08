/**
 * Sendable pricing quote: persist a PaymentQuote with a portal pay token +
 * recipient (Client or Lead) + sender attribution, then SMS the recipient the
 * portal pay link. No Stripe call here — checkout happens on the portal
 * (Phase 3); the webhook (Phase 4) layers side-effects onto the existing
 * PaymentQuote status machinery.
 *
 * The frozen `inputSnapshot` is the immutable source of truth: portal checkout
 * rebuilds the quote from it via `calculateCheckoutQuote()`, so the token
 * always charges the amounts frozen at send time (quote-drift safe).
 *
 * `sentByStaffId` is persisted now because the webhook has no request context
 * but still needs a staff sender for the receipt SMS (`sendSignerSmsAndPersist`
 * requires `sentById`).
 */
import { customAlphabet } from 'nanoid'
import { HTTPException } from 'hono/http-exception'
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { PORTAL_URL } from '../../lib/constants'
import type { SendQuoteInput } from '../../routes/billing/schemas'
import { calculateCheckoutQuote } from '../stripe/quote-calculator'
import {
  buildQuotePayLinkMessage,
  QUOTE_PAY_LINK_TEMPLATE_NAME,
} from './payment-sms-templates'
import { sendSignerSmsAndPersist } from './signer-sms-delivery'

const generatePayToken = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  32,
)

/** Public portal pay page URL for a sent quote. Phase 3 serves this route. */
export function buildQuotePayUrl(payToken: string): string {
  return `${PORTAL_URL}/quote/${payToken}`
}

export interface CreateSendableQuoteContext {
  staffId: string
  organizationId: string
}

export interface SendableQuoteResult {
  quoteId: string
  payToken: string
  payUrl: string
  smsSent: boolean
  /** Why the SMS didn't go out (only set when `smsSent` is false). */
  smsSkippedReason?: 'no_phone' | 'send_failed'
}

interface ResolvedRecipient {
  id: string
  firstName: string
}

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
 * Send the pay-link SMS; never fail the send. `smsSent` reflects ACTUAL Twilio
 * delivery (not just "no exception") so the UI can offer a copy-link fallback
 * when the recipient has no phone or Twilio rejects/isn't configured.
 */
async function sendQuotePayLinkSms(params: {
  recipient: ResolvedRecipient
  recipientType: 'client' | 'lead'
  orgName: string
  organizationId: string
  staffId: string
  payUrl: string
}): Promise<{ smsSent: boolean; smsSkippedReason?: SendableQuoteResult['smsSkippedReason'] }> {
  const message = buildQuotePayLinkMessage({
    firstName: params.recipient.firstName,
    orgName: params.orgName,
    url: params.payUrl,
  })

  try {
    const delivery = await sendSignerSmsAndPersist(
      {
        signerId: params.recipient.id,
        signerKind: params.recipientType,
        organizationId: params.organizationId,
        sentById: params.staffId,
      },
      message,
      QUOTE_PAY_LINK_TEMPLATE_NAME,
    )
    if (delivery.delivered) return { smsSent: true }
    return {
      smsSent: false,
      smsSkippedReason: delivery.reason === 'no_phone' ? 'no_phone' : 'send_failed',
    }
  } catch (error) {
    // Only a DB/persistence error reaches here — the quote already persisted.
    console.error(
      `[Quote] Failed to persist pay-link SMS to ${params.recipientType}=${params.recipient.id}:`,
      error,
    )
    return { smsSent: false, smsSkippedReason: 'send_failed' }
  }
}

/** Load the recipient's id/firstName/phone, scoped to the org. 404 if absent. */
async function resolveRecipient(
  recipient: SendQuoteInput['recipient'],
  organizationId: string,
): Promise<ResolvedRecipient> {
  if (recipient.type === 'client') {
    const client = await prisma.client.findFirst({
      where: { id: recipient.id, organizationId },
      select: { id: true, firstName: true },
    })
    if (!client) throw new HTTPException(404, { message: 'Client not found' })
    return client
  }

  const lead = await prisma.lead.findFirst({
    where: { id: recipient.id, organizationId },
    select: { id: true, firstName: true },
  })
  if (!lead) throw new HTTPException(404, { message: 'Lead not found' })
  return lead
}

async function resolveOrgName(organizationId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return org?.name ?? 'us'
}

/**
 * Freeze the same shape the anonymous checkout flow persists, so Phase 3 portal
 * checkout can rebuild the quote from `inputSnapshot.pricingInput` uniformly.
 */
function buildInputSnapshot(input: SendQuoteInput): Omit<SendQuoteInput, 'recipient'> {
  return {
    pricingInput: input.pricingInput,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    businessName: input.businessName,
  }
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
