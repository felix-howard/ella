/**
 * Sent-quote webhook fulfillment side-effects. The shared Stripe webhook already
 * moves a PaymentQuote's `status` on checkout/invoice events; this layer adds the
 * *effects* on top of that status machinery (plan phase 4):
 *
 *  - First successful charge  → one Payment row (type OTHER) + Lead→Client
 *    auto-convert + client receipt SMS + admin paid alert.
 *  - Recurring cycle (invoice.paid, subscription_cycle) → one Payment row
 *    (type RECURRING) + admin paid alert.
 *  - Recurring failure (invoice.payment_failed) → admin alert only.
 *
 * Effects run ONLY for *sendable* quotes (those with a `payToken`); anonymous
 * create-link quotes keep today's status-only behavior.
 *
 * Idempotency: each Payment row uses a DETERMINISTIC `payToken` (unique column),
 * so a duplicate webhook delivery hits a P2002 and is swallowed — no double row,
 * no double SMS. The failure alert is de-duped by the caller on Stripe event id.
 */
import type Stripe from 'stripe'
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { convertLeadToClientCore } from '../leads/lead-conversion-service'
import { linkClientToStripeCustomerIfMissing } from '../stripe/stripe-customer-link-service'
import {
  getReceiptFactsFromCheckoutSession,
  toPaymentReceiptData,
  type StripeReceiptFacts,
} from '../stripe/stripe-receipt-facts'
import {
  notifyDuplicateQuotePayment,
  notifyFirstQuotePayment,
  notifyRecurringQuotePayment,
  notifyQuotePaymentFailed,
} from './quote-fulfillment-notify'
import { formatUsdAmount } from './payment-sms-templates'
import {
  hasRecordedFullQuotePaymentRefund,
  lockQuotePaymentRefundReference,
} from './quote-payment-refund-service'
import {
  isUniqueViolation,
  resolveSettlementAmountCents,
  sendableQuoteInclude,
  stripeIdOf,
  type InvoiceFacts,
  type QuotePaymentInput,
  type QuoteSigner,
  type SendableQuote,
} from './quote-fulfillment-types'

function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}

function firstPaymentDescription(quote: SendableQuote): string {
  return quote.monthlyTotalCents > 0 ? 'Initial payment (setup + first month)' : 'Initial payment'
}

type FirstQuotePaymentRecordResult =
  | {
      kind: 'created'
      recipient: { clientId: string | null; signer: QuoteSigner | null }
      paymentStatus: 'PAID' | 'REFUNDED'
    }
  | { kind: 'duplicate_delivery' }
  | {
      kind: 'duplicate_quote_payment'
      stripeSessionId: string
      stripePaymentIntentId: string | null
    }

interface ExistingFirstQuotePayment {
  payToken: string
  stripeSessionId: string | null
}

type ScopedSendableQuote = SendableQuote & { organizationId: string }

class LeadConversionFailedError extends Error {
  constructor(readonly originalError: unknown) {
    super('Lead conversion failed during quote payment fulfillment')
    this.name = 'LeadConversionFailedError'
  }
}

/** Pick the SMS recipient + the Payment's clientId, auto-converting a lead. */
function leadSigner(lead: NonNullable<SendableQuote['lead']>): QuoteSigner {
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    kind: 'lead',
  }
}

function currentQuoteSigner(quote: SendableQuote): QuoteSigner | null {
  if (quote.client) return { ...quote.client, kind: 'client' }
  return quote.lead ? leadSigner(quote.lead) : null
}

function assertQuotePaymentScope(quote: SendableQuote): asserts quote is ScopedSendableQuote {
  if (!quote.organizationId) {
    throw new Error(`[QuoteFulfillment] quote=${quote.id} has no organization`)
  }
  if (quote.client && quote.client.organizationId !== quote.organizationId) {
    throw new Error(`[QuoteFulfillment] quote=${quote.id} client organization mismatch`)
  }
  if (quote.lead && quote.lead.organizationId !== quote.organizationId) {
    throw new Error(`[QuoteFulfillment] quote=${quote.id} lead organization mismatch`)
  }
}

/**
 * Resolve the quote to a Client, auto-converting a Lead on first payment inside
 * the same transaction as the deterministic Payment insert. If that insert
 * loses a duplicate-webhook race, the conversion work rolls back with it.
 */
async function resolveRecipientClientInTransaction(
  tx: Prisma.TransactionClient,
  quote: ScopedSendableQuote,
  eventAt: Date,
): Promise<{ clientId: string | null; signer: QuoteSigner | null }> {
  if (quote.client) {
    return {
      clientId: quote.client.id,
      signer: { ...quote.client, kind: 'client' },
    }
  }
  if (!quote.lead) return { clientId: null, signer: null }

  // Already converted (e.g. a self-healing webhook retry) — reuse that client.
  if (quote.lead.status === 'CONVERTED' && quote.lead.convertedToId) {
    const convertedClient = await tx.client.findFirst({
      where: { id: quote.lead.convertedToId, organizationId: quote.organizationId },
      select: { id: true },
    })
    if (!convertedClient) {
      throw new Error(`[QuoteFulfillment] quote=${quote.id} converted client scope mismatch`)
    }
    await linkSettledCalculatorAgreementToClient(
      tx,
      quote.id,
      quote.organizationId,
      quote.lead.id,
      quote.lead.convertedToId,
    )
    await repointQuoteToClient(tx, quote.id, quote.organizationId, quote.lead.convertedToId)
    return clientSignerFor(quote.lead.convertedToId, quote.lead)
  }

  let result: Awaited<ReturnType<typeof convertLeadToClientCore>>
  try {
    result = await convertLeadToClientCore(tx, {
      lead: quote.lead,
      organizationId: quote.organizationId,
      firstName: quote.lead.firstName,
      lastName: quote.lead.lastName,
      email: quote.lead.email,
      taxYear: eventAt.getFullYear(),
      createdByStaffId: quote.sentByStaffId ?? null,
      managedById: quote.sentByStaffId ?? null,
    })
  } catch (err) {
    throw new LeadConversionFailedError(err)
  }

  const clientId = result.duplicate ? result.existingClient.id : result.client.id
  if (result.duplicate) {
    await linkSettledCalculatorAgreementToClient(
      tx,
      quote.id,
      quote.organizationId,
      quote.lead.id,
      clientId,
    )
  }
  await repointQuoteToClient(tx, quote.id, quote.organizationId, clientId)
  return clientSignerFor(clientId, quote.lead)
}

/**
 * Duplicate-phone conversion deliberately leaves the Lead untouched. Move only
 * this quote's eligible signed Calculator agreement to the resolved Client;
 * paymentQuoteId is unique, and the remaining predicates enforce lead + tenant
 * scope while making retries a no-op after the first successful update.
 */
async function linkSettledCalculatorAgreementToClient(
  tx: Prisma.TransactionClient,
  quoteId: string,
  organizationId: string,
  leadId: string,
  clientId: string,
): Promise<void> {
  await tx.agreement.updateMany({
    where: {
      paymentQuoteId: quoteId,
      organizationId,
      leadId,
      clientId: null,
      status: 'SIGNED',
      source: 'CALCULATOR',
      type: 'ENGAGEMENT_LETTER',
    },
    data: { clientId },
  })
}

/** After conversion, address the receipt to the new client (lead messages were migrated). */
function clientSignerFor(
  clientId: string,
  lead: NonNullable<SendableQuote['lead']>,
): { clientId: string; signer: QuoteSigner } {
  return {
    clientId,
    signer: {
      id: clientId,
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      kind: 'client',
    },
  }
}

async function repointQuoteToClient(
  tx: Prisma.TransactionClient,
  quoteId: string,
  organizationId: string,
  clientId: string,
): Promise<void> {
  const updated = await tx.paymentQuote.updateMany({
    where: { id: quoteId, organizationId, clientId: null },
    data: { clientId },
  })
  if (updated.count === 1) return

  const currentQuote = await tx.paymentQuote.findFirst({
    where: { id: quoteId, organizationId, clientId },
    select: { id: true },
  })
  if (!currentQuote) {
    throw new Error(`[QuoteFulfillment] quote=${quoteId} client repoint scope mismatch`)
  }
}

/**
 * First payment on a sent quote — fired from `checkout.session.completed` (and
 * its async-success variant). Records the due-today charge, converts a lead, and
 * sends the receipt + admin alert. Idempotent on the session id.
 */
export async function fulfillFirstQuotePayment(params: {
  quoteId: string
  session: Stripe.Checkout.Session
  eventAt: Date
  stripeEventId?: string
}): Promise<void> {
  const { quoteId, session, eventAt, stripeEventId } = params
  const quote = await prisma.paymentQuote.findUnique({
    where: { id: quoteId },
    include: sendableQuoteInclude,
  })
  if (!quote || !quote.payToken) return // sendable quotes only
  assertQuotePaymentScope(quote)

  const amount = centsToAmount(
    resolveSettlementAmountCents(
      session.amount_total,
      quote.monthlyTotalCents + quote.setupTotalCents,
    ),
  )
  const receiptFacts = await getReceiptFactsFromCheckoutSession(session)

  const result = await recordFirstQuotePayment({
    quote,
    session,
    receiptFacts,
    eventAt,
    stripeEventId,
    amount,
  })
  if (result.kind === 'duplicate_delivery') {
    return // duplicate delivery — Payment + SMS already happened
  }
  if (result.kind === 'duplicate_quote_payment') {
    await notifyDuplicateQuotePayment({
      quote,
      signer: currentQuoteSigner(quote),
      amountFormatted: formatUsdAmount(amount),
      stripeSessionId: result.stripeSessionId,
      stripePaymentIntentId: result.stripePaymentIntentId,
    })
    return
  }

  await linkRecipientStripeCustomerIfMissing({
    clientId: result.recipient.clientId,
    organizationId: quote.organizationId,
    stripeCustomerId: receiptFacts.stripeCustomerId,
  })

  if (result.paymentStatus === 'REFUNDED') return

  await notifyFirstQuotePayment({
    quote,
    signer: result.recipient.signer,
    amountFormatted: formatUsdAmount(amount),
  })
}

async function recordFirstQuotePayment({
  quote,
  session,
  receiptFacts,
  eventAt,
  stripeEventId,
  amount,
}: {
  quote: ScopedSendableQuote
  session: Stripe.Checkout.Session
  receiptFacts: StripeReceiptFacts
  eventAt: Date
  stripeEventId?: string
  amount: string
}): Promise<FirstQuotePaymentRecordResult> {
  const inputBase = {
    paymentQuoteId: quote.id,
    payToken: `qf_${session.id}`,
    organizationId: quote.organizationId,
    type: 'OTHER',
    amount,
    stripeSessionId: session.id,
    stripePaymentIntentId: stripeIdOf(session.payment_intent) ?? receiptFacts.stripePaymentIntentId ?? null,
    receiptFacts,
    paidAt: eventAt,
    description: firstPaymentDescription(quote),
  } satisfies Omit<QuotePaymentInput, 'clientId' | 'leadId'>

  try {
    return await prisma.$transaction(async (tx) => {
      await lockQuoteFirstPaymentClaim(tx, quote.id)
      const existingFirstPayment = await findExistingFirstQuotePayment(tx, quote.id)
      if (existingFirstPayment) {
        if (quote.client && quote.lead) {
          await linkSettledCalculatorAgreementToClient(
            tx,
            quote.id,
            quote.organizationId,
            quote.lead.id,
            quote.client.id,
          )
        }
        return markDuplicateOrDelivery({
          tx,
          quoteId: quote.id,
          session,
          existingFirstPayment,
          eventAt,
          stripeEventId,
          stripePaymentIntentId: inputBase.stripePaymentIntentId,
        })
      }

      const recipient = await resolveRecipientClientInTransaction(tx, quote, eventAt)
      const paymentStatus = await insertQuotePayment(tx, {
        ...inputBase,
        clientId: recipient.clientId,
        leadId: recipient.clientId ? null : quote.leadId,
      })
      return { kind: 'created', recipient, paymentStatus }
    })
  } catch (err) {
    if (isUniqueViolation(err)) return { kind: 'duplicate_delivery' }
    if (!(err instanceof LeadConversionFailedError)) throw err

    console.error(
      `[QuoteFulfillment] Lead→Client convert failed for quote=${quote.id}:`,
      err.originalError,
    )
    const recipient = {
      clientId: null,
      signer: quote.lead ? leadSigner(quote.lead) : null,
    }
    return recordFirstQuotePaymentWithoutConversion({
      quote,
      session,
      input: {
        ...inputBase,
        clientId: null,
        leadId: quote.leadId,
      },
      recipient,
      eventAt,
      stripeEventId,
    })
  }
}

async function recordFirstQuotePaymentWithoutConversion(params: {
  quote: ScopedSendableQuote
  session: Stripe.Checkout.Session
  input: QuotePaymentInput
  recipient: { clientId: string | null; signer: QuoteSigner | null }
  eventAt: Date
  stripeEventId?: string
}): Promise<FirstQuotePaymentRecordResult> {
  const { quote, session, input, recipient, eventAt, stripeEventId } = params
  try {
    return await prisma.$transaction(async (tx) => {
      await lockQuoteFirstPaymentClaim(tx, quote.id)
      const existingFirstPayment = await findExistingFirstQuotePayment(tx, quote.id)
      if (existingFirstPayment) {
        return markDuplicateOrDelivery({
          tx,
          quoteId: quote.id,
          session,
          existingFirstPayment,
          eventAt,
          stripeEventId,
          stripePaymentIntentId: input.stripePaymentIntentId,
        })
      }
      const paymentStatus = await insertQuotePayment(tx, input)
      return { kind: 'created', recipient, paymentStatus }
    })
  } catch (err) {
    if (isUniqueViolation(err)) return { kind: 'duplicate_delivery' }
    console.error(`[QuoteFulfillment] Payment insert failed (payToken=${input.payToken}):`, err)
    throw err
  }
}

async function lockQuoteFirstPaymentClaim(
  tx: Prisma.TransactionClient,
  quoteId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "PaymentQuote" WHERE id = ${quoteId} FOR UPDATE`
}

async function findExistingFirstQuotePayment(
  tx: Prisma.TransactionClient,
  quoteId: string,
): Promise<ExistingFirstQuotePayment | null> {
  return tx.payment.findFirst({
    where: {
      paymentQuoteId: quoteId,
      status: { in: ['PAID', 'REFUNDED'] },
      type: 'OTHER',
      payToken: { startsWith: 'qf_' },
    },
    orderBy: { paidAt: 'asc' },
    select: {
      payToken: true,
      stripeSessionId: true,
    },
  })
}

async function markDuplicateOrDelivery(params: {
  tx: Prisma.TransactionClient
  quoteId: string
  session: Stripe.Checkout.Session
  existingFirstPayment: ExistingFirstQuotePayment
  eventAt: Date
  stripeEventId?: string
  stripePaymentIntentId: string | null
}): Promise<FirstQuotePaymentRecordResult> {
  const {
    tx,
    quoteId,
    session,
    existingFirstPayment,
    eventAt,
    stripeEventId,
    stripePaymentIntentId,
  } = params
  if (
    existingFirstPayment.payToken === `qf_${session.id}` ||
    existingFirstPayment.stripeSessionId === session.id
  ) {
    return { kind: 'duplicate_delivery' }
  }

  const marked = await tx.stripeCheckoutSession.updateMany({
    where: {
      paymentQuoteId: quoteId,
      stripeSessionId: session.id,
      status: { not: 'duplicate_paid_review' },
    },
    data: {
      status: 'duplicate_paid_review',
      lastStripeEventAt: eventAt,
      ...(stripeEventId ? { lastStripeEventId: stripeEventId } : {}),
    },
  })
  if (marked.count === 0) {
    const currentSession = await tx.stripeCheckoutSession.findFirst({
      where: { paymentQuoteId: quoteId, stripeSessionId: session.id },
      select: { status: true },
    })
    if (currentSession?.status === 'duplicate_paid_review') {
      return { kind: 'duplicate_delivery' }
    }
    throw new Error(
      `[QuoteFulfillment] Duplicate quote payment could not be marked for review quote=${quoteId} session=${session.id}`,
    )
  }
  return {
    kind: 'duplicate_quote_payment',
    stripeSessionId: session.id,
    stripePaymentIntentId,
  }
}

/**
 * A true monthly cycle invoice (`subscription_cycle`) was paid — record a
 * RECURRING Payment and notify payment-alert admins once the insert wins.
 * The subscription's FIRST invoice (`subscription_create`) is deliberately
 * skipped by the caller (handled by the checkout session above).
 */
export async function recordRecurringQuotePayment(params: {
  quote: SendableQuote
  invoice: InvoiceFacts
  eventAt: Date
}): Promise<void> {
  const { quote, invoice, eventAt } = params
  assertQuotePaymentScope(quote)
  const amountPaidCents = invoice.amountPaidCents ?? quote.monthlyTotalCents
  // A paid cycle invoice is always > 0; guard against a degenerate/malformed
  // invoice writing a $0.00 RECURRING row into the client's Payments tab.
  if (amountPaidCents <= 0) return
  const dedupeKey = invoice.paymentIntentId ?? invoice.id
  if (!dedupeKey) return

  const paymentStatus = await createQuotePayment({
    paymentQuoteId: quote.id,
    payToken: `qf_${dedupeKey}`,
    organizationId: quote.organizationId,
    clientId: quote.client?.id ?? null,
    leadId: quote.client ? null : quote.leadId,
    type: 'RECURRING',
    amount: centsToAmount(amountPaidCents),
    stripeSessionId: null,
    stripePaymentIntentId: invoice.paymentIntentId,
    receiptFacts: invoice.receiptFacts,
    paidAt: eventAt,
    description: 'Monthly service',
  })
  if (paymentStatus !== 'PAID' && paymentStatus !== 'EXISTING_PAID') return

  await notifyRecurringQuotePayment({
    quote,
    signer: currentQuoteSigner(quote),
    amountFormatted: formatUsdAmount(centsToAmount(amountPaidCents)),
  })
}

/** Failure alert — re-uses the loaded quote; de-dupe is the caller's (event id). */
export async function alertRecurringQuoteFailure(params: {
  quote: SendableQuote
  invoice: InvoiceFacts
}): Promise<void> {
  const { quote, invoice } = params
  await notifyQuotePaymentFailed({
    quote,
    signer: currentQuoteSigner(quote),
    amountFormatted: formatUsdAmount(centsToAmount(invoice.amountDueCents)),
  })
}

/** Load a sendable quote (payToken set) by its Stripe subscription. Null otherwise. */
export async function loadSendableQuoteBySubscription(
  stripeSubscriptionId: string,
): Promise<SendableQuote | null> {
  return prisma.paymentQuote.findFirst({
    where: {
      payToken: { not: null },
      checkoutSessions: {
        some: {
          stripeSubscriptionId,
          status: { not: 'duplicate_paid_review' },
        },
      },
    },
    include: sendableQuoteInclude,
  })
}

async function linkRecipientStripeCustomerIfMissing({
  clientId,
  organizationId,
  stripeCustomerId,
}: {
  clientId: string | null
  organizationId: string
  stripeCustomerId: string | null | undefined
}): Promise<void> {
  if (!clientId || !stripeCustomerId) return
  try {
    await linkClientToStripeCustomerIfMissing({ clientId, organizationId, stripeCustomerId })
  } catch (err) {
    console.error(`[QuoteFulfillment] Client Stripe Customer link failed client=${clientId}:`, err)
  }
}

/**
 * Insert a settled Payment row. If the deterministic payToken already exists,
 * return the existing terminal status so an interrupted webhook can retry
 * admin-only SMS without writing another Payment.
 */
async function createQuotePayment(
  input: QuotePaymentInput,
): Promise<'PAID' | 'REFUNDED' | 'EXISTING_PAID' | 'EXISTING_REFUNDED' | null> {
  try {
    return await prisma.$transaction((tx) => insertQuotePayment(tx, input))
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existing = await prisma.payment.findUnique({
        where: { payToken: input.payToken },
        select: { status: true },
      })
      if (existing?.status === 'PAID') return 'EXISTING_PAID'
      if (existing?.status === 'REFUNDED') return 'EXISTING_REFUNDED'
      return null
    }
    console.error(`[QuoteFulfillment] Payment insert failed (payToken=${input.payToken}):`, err)
    throw err
  }
}

async function insertQuotePayment(
  db: Pick<Prisma.TransactionClient, '$executeRaw' | 'payment' | 'stripeWebhookEventLog'>,
  input: QuotePaymentInput,
): Promise<'PAID' | 'REFUNDED'> {
  const refundFacts = {
    chargeId: input.receiptFacts?.stripeChargeId ?? null,
    paymentIntentId:
      input.stripePaymentIntentId ?? input.receiptFacts?.stripePaymentIntentId ?? null,
  }
  await lockQuotePaymentRefundReference(db, refundFacts)
  const status = (await hasRecordedFullQuotePaymentRefund(db, refundFacts))
    ? 'REFUNDED'
    : 'PAID'

  await db.payment.create({
    data: {
      paymentQuoteId: input.paymentQuoteId,
      organizationId: input.organizationId,
      clientId: input.clientId,
      leadId: input.leadId,
      type: input.type,
      status,
      amount: input.amount,
      currency: 'usd',
      payToken: input.payToken,
      stripeSessionId: input.stripeSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      ...toPaymentReceiptData(input.receiptFacts ?? {}, input.paidAt),
      paidAt: input.paidAt,
      description: input.description,
    } satisfies Prisma.PaymentUncheckedCreateInput,
  })
  return status
}
