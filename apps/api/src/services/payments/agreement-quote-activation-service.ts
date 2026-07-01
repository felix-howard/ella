import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'
import { agreementScopeWhere } from '../agreements/agreement-shared'
import type { EntityType } from '../agreements/entity-loader'
import {
  buildQuotePayUrl,
  generatePayToken,
  resolveOrgName,
  sendQuotePayLinkSms,
} from './quote-send-shared'
import {
  TERMINAL_QUOTE_STATUSES,
  assertCalculatorAgreementEligible,
  type AgreementQuoteActivationResult,
  type AgreementQuoteDb,
} from './agreement-quote-types'

const PAYMENT_LINK_SMS_TIMEOUT_MS = 2500

export async function markAgreementQuoteSignedForReview(
  input: {
    agreementId: string
    organizationId: string
  },
  db: AgreementQuoteDb = prisma,
): Promise<void> {
  const agreement = await db.agreement.findFirst({
    where: {
      id: input.agreementId,
      organizationId: input.organizationId,
      status: 'SIGNED',
    },
    select: {
      id: true,
      source: true,
      type: true,
      paymentQuoteId: true,
    },
  })
  if (!agreement?.paymentQuoteId) return
  assertCalculatorAgreementEligible(agreement)

  await db.paymentQuote.updateMany({
    where: {
      id: agreement.paymentQuoteId,
      organizationId: input.organizationId,
      status: { in: ['agreement_draft', 'agreement_pending_signature'] },
    },
    data: { status: 'agreement_signed_review' },
  })
}

export async function activateAgreementQuotePaymentPortal(input: {
  agreementId: string
  orgId: string
  staffId: string
  entityType?: EntityType
  entityId?: string
  requireStaffReviewMode?: boolean
}): Promise<AgreementQuoteActivationResult> {
  const agreement = await prisma.agreement.findFirst({
    where: {
      id: input.agreementId,
      organizationId: input.orgId,
      status: 'SIGNED',
      source: 'CALCULATOR',
      ...(input.entityType && input.entityId ? agreementScopeWhere(input.entityType, input.entityId) : {}),
    },
    select: {
      id: true,
      type: true,
      paymentPortalMode: true,
      paymentQuote: {
        select: {
          id: true,
          organizationId: true,
          clientId: true,
          leadId: true,
          status: true,
          payToken: true,
          sentAt: true,
          client: { select: { id: true, firstName: true } },
          lead: { select: { id: true, firstName: true } },
        },
      },
    },
  })
  if (!agreement) throw new HTTPException(404, { message: 'Agreement not found' })
  if (agreement.type !== 'ENGAGEMENT_LETTER') {
    throw new HTTPException(422, { message: 'Agreement does not support payment portal' })
  }
  if (input.requireStaffReviewMode && agreement.paymentPortalMode !== 'STAFF_REVIEW') {
    throw new HTTPException(409, { message: 'Agreement payment portal is not pending staff review' })
  }

  const quote = agreement.paymentQuote
  if (!quote) throw new HTTPException(404, { message: 'Agreement quote not found' })
  assertLinkedQuoteScope(quote, input)
  if ((TERMINAL_QUOTE_STATUSES as readonly string[]).includes(quote.status)) {
    throw new HTTPException(409, { message: 'Agreement quote is not payable' })
  }
  if (quote.payToken && quote.sentAt) return existingActivationResult(quote.id, quote.payToken)

  const payToken = generatePayToken()
  const updated = await prisma.paymentQuote.updateMany({
    where: {
      id: quote.id,
      organizationId: input.orgId,
      payToken: null,
      status: { notIn: [...TERMINAL_QUOTE_STATUSES] },
    },
    data: {
      status: 'sent',
      payToken,
      sentAt: new Date(),
      sentByStaffId: input.staffId,
    },
  })

  if (updated.count !== 1) {
    const latest = await prisma.paymentQuote.findFirst({
      where: { id: quote.id, organizationId: input.orgId },
      select: { payToken: true, sentAt: true },
    })
    if (latest?.payToken && latest.sentAt) {
      return existingActivationResult(quote.id, latest.payToken)
    }
    throw new HTTPException(409, { message: 'Agreement quote could not be activated' })
  }

  const payUrl = buildQuotePayUrl(payToken)
  const recipient = quote.lead
    ? { type: 'lead' as const, value: quote.lead }
    : quote.client
      ? { type: 'client' as const, value: quote.client }
      : null
  if (!recipient) {
    return { quoteId: quote.id, payToken, payUrl, smsSent: false, smsSkippedReason: 'send_failed' }
  }

  const orgName = await resolveOrgName(input.orgId)
  const { smsSent, smsSkippedReason } = await sendQuotePayLinkSmsWithTimeout({
    recipient: recipient.value,
    recipientType: recipient.type,
    orgName,
    organizationId: input.orgId,
    staffId: input.staffId,
    payUrl,
  })

  return { quoteId: quote.id, payToken, payUrl, smsSent, smsSkippedReason }
}

async function sendQuotePayLinkSmsWithTimeout(
  params: Parameters<typeof sendQuotePayLinkSms>[0],
): ReturnType<typeof sendQuotePayLinkSms> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const delivery = sendQuotePayLinkSms(params).catch((error) => {
    console.error(
      `[AgreementQuote] Failed sending quote SMS for ${params.recipientType}=${params.recipient.id}:`,
      error,
    )
    return { smsSent: false as const, smsSkippedReason: 'send_failed' as const }
  })
  const timeout = new Promise<Awaited<ReturnType<typeof sendQuotePayLinkSms>>>((resolve) => {
    timeoutId = setTimeout(() => {
      console.error(
        `[AgreementQuote] Timed out sending quote SMS for ${params.recipientType}=${params.recipient.id}`,
      )
      resolve({ smsSent: false, smsSkippedReason: 'send_failed' })
    }, PAYMENT_LINK_SMS_TIMEOUT_MS)
  })
  const result = await Promise.race([delivery, timeout])
  if (timeoutId) clearTimeout(timeoutId)
  return result
}

function existingActivationResult(
  quoteId: string,
  payToken: string,
): AgreementQuoteActivationResult {
  return {
    quoteId,
    payToken,
    payUrl: buildQuotePayUrl(payToken),
    smsSent: false,
    smsSkippedReason: 'already_sent',
  }
}

function assertLinkedQuoteScope(
  quote: {
    organizationId: string | null
    clientId: string | null
    leadId: string | null
  },
  input: {
    orgId: string
    entityType?: EntityType
    entityId?: string
  },
): void {
  if (quote.organizationId !== input.orgId) {
    throw new HTTPException(409, { message: 'Agreement quote does not match agreement scope' })
  }
  if (!input.entityType || !input.entityId) return

  const matchesEntity =
    input.entityType === 'client'
      ? quote.clientId === input.entityId
      : quote.leadId === input.entityId
  if (!matchesEntity) {
    throw new HTTPException(409, { message: 'Agreement quote does not match agreement scope' })
  }
}
