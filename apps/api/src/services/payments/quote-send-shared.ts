/**
 * Shared building blocks for sending a PaymentQuote pay-link to a Client/Lead.
 * Used by both the calculator send flow (`quote-send-service.ts`) and the custom
 * free-form send flow (`custom-quote-send-service.ts`): pay-token generation,
 * recipient/org resolution, and the SMS delivery wrapper. No Stripe call here —
 * checkout happens later on the portal; this only persists + notifies.
 */
import { customAlphabet } from 'nanoid'
import { HTTPException } from 'hono/http-exception'
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { PORTAL_URL } from '../../lib/constants'
import type { SendQuoteInput } from '../../routes/billing/schemas'
import {
  buildQuotePayLinkMessage,
  QUOTE_PAY_LINK_TEMPLATE_NAME,
} from './payment-sms-templates'
import { sendSignerSmsAndPersist } from './signer-sms-delivery'

export const generatePayToken = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  32,
)

/** Public portal pay page URL for a sent quote. */
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

export interface ResolvedRecipient {
  id: string
  firstName: string
}

export type RecipientType = 'client' | 'lead'

/**
 * Send the pay-link SMS; never fail the send. `smsSent` reflects ACTUAL Twilio
 * delivery (not just "no exception") so the UI can offer a copy-link fallback
 * when the recipient has no phone or Twilio rejects/isn't configured.
 */
export async function sendQuotePayLinkSms(params: {
  recipient: ResolvedRecipient
  recipientType: RecipientType
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

/** Load the recipient's id/firstName, scoped to the org. 404 if absent. */
export async function resolveRecipient(
  recipient: SendQuoteInput['recipient'],
  organizationId: string,
): Promise<ResolvedRecipient> {
  if (recipient.type === 'client') {
    const client = await prisma.client.findFirst({
      where: { id: recipient.id, organizationId, clientType: 'INDIVIDUAL' },
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

export async function resolveOrgName(organizationId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return org?.name ?? 'us'
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
