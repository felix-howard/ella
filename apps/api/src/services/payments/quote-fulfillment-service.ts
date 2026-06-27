/**
 * Sent-quote webhook fulfillment side-effects. The shared Stripe webhook already
 * moves a PaymentQuote's `status` on checkout/invoice events; this layer adds the
 * *effects* on top of that status machinery (plan phase 4):
 *
 *  - First successful charge  → one Payment row (type OTHER) + Lead→Client
 *    auto-convert + client receipt SMS + admin paid alert.
 *  - Recurring cycle (invoice.paid, subscription_cycle) → silent Payment row
 *    (type RECURRING), no SMS.
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
import { notifyFirstQuotePayment, notifyQuotePaymentFailed } from './quote-fulfillment-notify'
import { formatUsdAmount } from './payment-sms-templates'
import {
  isUniqueViolation,
  sendableQuoteInclude,
  stripeIdOf,
  type InvoiceFacts,
  type QuoteSigner,
  type SendableQuote,
} from './quote-fulfillment-types'

function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}

function firstPaymentDescription(quote: SendableQuote): string {
  return quote.monthlyTotalCents > 0 ? 'Initial payment (setup + first month)' : 'Initial payment'
}

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

/**
 * Resolve the quote to a Client, auto-converting a Lead on first payment inside
 * the same transaction as the deterministic Payment insert. If that insert
 * loses a duplicate-webhook race, the conversion work rolls back with it.
 */
async function resolveRecipientClientInTransaction(
  tx: Prisma.TransactionClient,
  quote: SendableQuote,
  eventAt: Date,
): Promise<{ clientId: string | null; signer: QuoteSigner | null }> {
  if (quote.client) {
    return {
      clientId: quote.client.id,
      signer: { ...quote.client, kind: 'client' },
    }
  }
  if (!quote.lead || !quote.organizationId) {
    return { clientId: null, signer: quote.lead ? leadSigner(quote.lead) : null }
  }

  // Already converted (e.g. a self-healing webhook retry) — reuse that client.
  if (quote.lead.status === 'CONVERTED' && quote.lead.convertedToId) {
    await repointQuoteToClient(tx, quote.id, quote.lead.convertedToId)
    return clientSignerFor(quote.lead.convertedToId, quote.lead)
  }

  try {
    const result = await convertLeadToClientCore(tx, {
      lead: quote.lead!,
      organizationId: quote.organizationId!,
      firstName: quote.lead!.firstName,
      lastName: quote.lead!.lastName,
      email: quote.lead!.email,
      taxYear: eventAt.getFullYear(),
      createdByStaffId: quote.sentByStaffId ?? null,
      managedById: quote.sentByStaffId ?? null,
    })
    const clientId = result.duplicate ? result.existingClient.id : result.client.id
    await repointQuoteToClient(tx, quote.id, clientId)
    return clientSignerFor(clientId, quote.lead)
  } catch (err) {
    throw new LeadConversionFailedError(err)
  }
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
  clientId: string,
): Promise<void> {
  await tx.paymentQuote.updateMany({
    where: { id: quoteId, clientId: null },
    data: { clientId },
  })
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
}): Promise<void> {
  const { quoteId, session, eventAt } = params
  const quote = await prisma.paymentQuote.findUnique({
    where: { id: quoteId },
    include: sendableQuoteInclude,
  })
  if (!quote || !quote.payToken) return // sendable quotes only
  if (!quote.organizationId) {
    console.warn(`[QuoteFulfillment] quote=${quote.id} has no organization — skipping first payment`)
    return
  }

  const amount = centsToAmount(quote.monthlyTotalCents + quote.setupTotalCents)
  const receiptFacts = await getReceiptFactsFromCheckoutSession(session)

  const result = await recordFirstQuotePayment({
    quote,
    session,
    receiptFacts,
    eventAt,
    amount,
  })
  if (!result) {
    return // duplicate delivery — Payment + SMS already happened
  }

  await linkRecipientStripeCustomerIfMissing({
    clientId: result.recipient.clientId,
    organizationId: quote.organizationId,
    stripeCustomerId: receiptFacts.stripeCustomerId,
  })

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
  amount,
}: {
  quote: SendableQuote
  session: Stripe.Checkout.Session
  receiptFacts: StripeReceiptFacts
  eventAt: Date
  amount: string
}): Promise<{ recipient: { clientId: string | null; signer: QuoteSigner | null } } | null> {
  if (!quote.organizationId) return null

  const inputBase = {
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
      const recipient = await resolveRecipientClientInTransaction(tx, quote, eventAt)
      await insertQuotePayment(tx, {
        ...inputBase,
        clientId: recipient.clientId,
        leadId: recipient.clientId ? null : quote.leadId,
      })
      return { recipient }
    })
  } catch (err) {
    if (isUniqueViolation(err)) return null
    if (!(err instanceof LeadConversionFailedError)) throw err

    console.error(
      `[QuoteFulfillment] Lead→Client convert failed for quote=${quote.id}:`,
      err.originalError,
    )
    const recipient = {
      clientId: null,
      signer: quote.lead ? leadSigner(quote.lead) : null,
    }
    if (!(await createQuotePayment({
      ...inputBase,
      clientId: null,
      leadId: quote.leadId,
    }))) {
      return null
    }
    return { recipient }
  }
}

/**
 * A true monthly cycle invoice (`subscription_cycle`) was paid — record a silent
 * RECURRING Payment. The subscription's FIRST invoice (`subscription_create`) is
 * deliberately skipped by the caller (handled by the checkout session above).
 */
export async function recordRecurringQuotePayment(params: {
  quote: SendableQuote
  invoice: InvoiceFacts
  eventAt: Date
}): Promise<void> {
  const { quote, invoice, eventAt } = params
  if (!quote.organizationId) return
  // A paid cycle invoice is always > 0; guard against a degenerate/malformed
  // invoice writing a $0.00 RECURRING row into the client's Payments tab.
  if (invoice.amountPaidCents <= 0) return
  const dedupeKey = invoice.paymentIntentId ?? invoice.id
  if (!dedupeKey) return

  await createQuotePayment({
    payToken: `qf_${dedupeKey}`,
    organizationId: quote.organizationId,
    clientId: quote.client?.id ?? null,
    leadId: quote.client ? null : quote.leadId,
    type: 'RECURRING',
    amount: centsToAmount(invoice.amountPaidCents),
    stripeSessionId: null,
    stripePaymentIntentId: invoice.paymentIntentId,
    receiptFacts: invoice.receiptFacts,
    paidAt: eventAt,
    description: 'Monthly service',
  })
}

/** Failure alert — re-uses the loaded quote; de-dupe is the caller's (event id). */
export async function alertRecurringQuoteFailure(params: {
  quote: SendableQuote
  invoice: InvoiceFacts
}): Promise<void> {
  const { quote, invoice } = params
  const signer: QuoteSigner | null = quote.client
    ? { ...quote.client, kind: 'client' }
    : quote.lead
      ? leadSigner(quote.lead)
      : null
  await notifyQuotePaymentFailed({
    quote,
    signer,
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
      checkoutSessions: { some: { stripeSubscriptionId } },
    },
    include: sendableQuoteInclude,
  })
}

interface QuotePaymentInput {
  payToken: string
  organizationId: string
  clientId: string | null
  leadId: string | null
  type: 'OTHER' | 'RECURRING'
  amount: string
  stripeSessionId: string | null
  stripePaymentIntentId: string | null
  receiptFacts?: StripeReceiptFacts
  paidAt: Date
  description: string
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
 * Insert a PAID Payment row. Returns false (without throwing) when the
 * deterministic payToken already exists — i.e. a duplicate webhook delivery —
 * so callers can skip follow-up notifications.
 */
async function createQuotePayment(input: QuotePaymentInput): Promise<boolean> {
  try {
    await insertQuotePayment(prisma, input)
    return true
  } catch (err) {
    if (isUniqueViolation(err)) return false
    console.error(`[QuoteFulfillment] Payment insert failed (payToken=${input.payToken}):`, err)
    throw err
  }
}

async function insertQuotePayment(
  db: Pick<Prisma.TransactionClient, 'payment'>,
  input: QuotePaymentInput,
): Promise<void> {
  await db.payment.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      leadId: input.leadId,
      type: input.type,
      status: 'PAID',
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
}
