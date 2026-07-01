import type { AgreementPaymentPortalMode, AgreementSource, AgreementType } from '@ella/db'
import { HTTPException } from 'hono/http-exception'
import type { prisma } from '../../lib/db'
import type { CheckoutPricingInput } from '../../routes/billing/schemas'
import type { RecipientType, SendableQuoteResult } from './quote-send-shared'

export const AGREEMENT_PAYMENT_MODES = new Set<AgreementPaymentPortalMode>([
  'AUTO_SEND',
  'STAFF_REVIEW',
])

export const TERMINAL_QUOTE_STATUSES = ['paid', 'active', 'canceled'] as const

export type AgreementQuoteDb = Pick<
  typeof prisma,
  'agreement' | 'organization' | 'paymentQuote'
>

export type RecipientScopedAgreementQuoteDb = AgreementQuoteDb &
  Pick<typeof prisma, 'client' | 'lead'>

export interface CalculatorAgreementQuoteInput {
  pricingInput: CheckoutPricingInput
  paymentPortalMode?: AgreementPaymentPortalMode
  customerEmail?: string
  customerName?: string
  businessName?: string
}

export interface CalculatorAgreementQuoteRecipientDefaults {
  email?: string | null
  firstName: string | null
  lastName: string | null
  leadBusinessName?: string | null
  client?: { clientType: 'INDIVIDUAL' | 'BUSINESS' } | null
}

export interface CreateFrozenCalculatorAgreementQuoteInput
  extends CalculatorAgreementQuoteInput {
  recipient: {
    type: RecipientType
    id: string
  }
}

export interface CreateFrozenCalculatorAgreementQuoteContext {
  organizationId: string
  staffId: string
}

export interface AgreementQuoteActivationResult {
  quoteId: string
  payToken: string
  payUrl: string
  smsSent: boolean
  smsSkippedReason?: SendableQuoteResult['smsSkippedReason'] | 'already_sent'
}

export function assertCalculatorQuoteInputAllowed(input: {
  type: AgreementType
  source: AgreementSource
  calculatorQuote?: CalculatorAgreementQuoteInput
}): void {
  if (!input.calculatorQuote) return
  if (input.source !== 'CALCULATOR' || input.type !== 'ENGAGEMENT_LETTER') {
    throw new HTTPException(422, {
      message: 'calculatorQuote is only supported for calculator Engagement Letters',
    })
  }
}

export function hydrateCalculatorAgreementQuote(
  quote: CalculatorAgreementQuoteInput,
  recipient: CalculatorAgreementQuoteRecipientDefaults,
): CalculatorAgreementQuoteInput {
  return {
    ...quote,
    customerEmail: quote.customerEmail ?? recipient.email ?? undefined,
    customerName: quote.customerName ?? resolveCalculatorQuoteCustomerName(recipient),
    businessName: quote.businessName ?? recipient.leadBusinessName ?? undefined,
  }
}

export function assertCalculatorAgreementEligible(agreement: {
  type: string
  source: string
}): void {
  if (agreement.source !== 'CALCULATOR' || agreement.type !== 'ENGAGEMENT_LETTER') {
    throw new HTTPException(422, {
      message: 'Calculator quotes can only be linked to calculator Engagement Letters',
    })
  }
}

export async function assertRecipientInOrganization(
  recipient: CreateFrozenCalculatorAgreementQuoteInput['recipient'],
  organizationId: string,
  db: RecipientScopedAgreementQuoteDb,
): Promise<void> {
  const found =
    recipient.type === 'client'
      ? await db.client.findFirst({
          where: { id: recipient.id, organizationId },
          select: { id: true },
        })
      : await db.lead.findFirst({
          where: { id: recipient.id, organizationId },
          select: { id: true },
        })
  if (!found) {
    throw new HTTPException(404, {
      message: `${recipient.type === 'client' ? 'Client' : 'Lead'} not found`,
    })
  }
}

function resolveCalculatorQuoteCustomerName(
  input: CalculatorAgreementQuoteRecipientDefaults,
): string {
  const fullName =
    [input.firstName, input.lastName]
      .filter((part): part is string => Boolean(part?.trim()))
      .map((part) => part.trim())
      .join(' ') || 'Unnamed Recipient'
  if (input.client?.clientType === 'BUSINESS') return input.firstName?.trim() || fullName
  if (input.leadBusinessName?.trim()) return input.leadBusinessName.trim()
  return fullName
}
