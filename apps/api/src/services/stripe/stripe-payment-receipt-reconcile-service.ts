import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { assertStripeConfigured } from './client'
import {
  getReceiptFactsFromInvoice,
  getReceiptFactsFromPaymentIntentId,
  mergeReceiptFacts,
  type StripeReceiptFacts,
} from './stripe-receipt-facts'

const paymentWithAgreementInclude = {
  agreement: { select: { id: true, title: true } },
} as const

type ReconciledPayment = Prisma.PaymentGetPayload<{
  include: typeof paymentWithAgreementInclude
}>

interface ReconcilePaymentReceiptFactsInput {
  paymentId: string
  clientId: string
  organizationId: string
}

interface ReconcilePaymentReceiptFactsResult {
  payment: ReconciledPayment
  refreshed: boolean
}

const RECEIPT_FACT_KEYS = [
  'stripeCustomerId',
  'stripeInvoiceId',
  'stripePaymentIntentId',
  'stripeChargeId',
  'stripeReceiptUrl',
  'stripeReceiptNumber',
  'stripeHostedInvoiceUrl',
  'stripeInvoicePdfUrl',
  'paymentMethodBrand',
  'paymentMethodLast4',
] as const
type ReceiptFactKey = (typeof RECEIPT_FACT_KEYS)[number]
type ReceiptUpdateData = Partial<Record<ReceiptFactKey, string>> & { receiptSyncedAt?: Date }

export async function reconcilePaymentReceiptFacts(
  input: ReconcilePaymentReceiptFactsInput
): Promise<ReconcilePaymentReceiptFactsResult | null> {
  assertStripeConfigured()

  const payment = await prisma.payment.findFirst({
    where: {
      id: input.paymentId,
      clientId: input.clientId,
      organizationId: input.organizationId,
    },
    include: paymentWithAgreementInclude,
  })
  if (!payment) return null

  const facts = await loadStripeReceiptFacts(payment)
  const updateData = buildReceiptUpdateData(payment, facts)
  if (Object.keys(updateData).length === 0) {
    return { payment, refreshed: false }
  }

  const updatedCount = await prisma.payment.updateMany({
    where: {
      id: input.paymentId,
      clientId: input.clientId,
      organizationId: input.organizationId,
    },
    data: updateData,
  })
  if (updatedCount.count === 0) return null

  const updated = await prisma.payment.findFirst({
    where: {
      id: input.paymentId,
      clientId: input.clientId,
      organizationId: input.organizationId,
    },
    include: paymentWithAgreementInclude,
  })
  if (!updated) return null

  return { payment: updated, refreshed: true }
}

async function loadStripeReceiptFacts(payment: ReconciledPayment): Promise<StripeReceiptFacts> {
  const invoiceFacts = payment.stripeInvoiceId
    ? await getReceiptFactsFromInvoice(payment.stripeInvoiceId)
    : {}
  const paymentIntentFacts = await getReceiptFactsFromPaymentIntentId(
    invoiceFacts.stripePaymentIntentId ?? payment.stripePaymentIntentId
  )

  return mergeReceiptFacts(invoiceFacts, paymentIntentFacts, existingPaymentFacts(payment))
}

function buildReceiptUpdateData(
  payment: ReconciledPayment,
  facts: StripeReceiptFacts
): Prisma.PaymentUpdateInput {
  const data: ReceiptUpdateData = {}

  for (const key of RECEIPT_FACT_KEYS) {
    const value = facts[key]
    if (value && payment[key] !== value) {
      data[key] = value
    }
  }

  if ((Object.keys(data).length > 0 || !payment.receiptSyncedAt) && hasUsefulReceiptFacts(facts)) {
    data.receiptSyncedAt = new Date()
  }

  return data satisfies Prisma.PaymentUpdateInput
}

function existingPaymentFacts(payment: ReconciledPayment): StripeReceiptFacts {
  return {
    stripeCustomerId: payment.stripeCustomerId,
    stripeInvoiceId: payment.stripeInvoiceId,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    stripeChargeId: payment.stripeChargeId,
    stripeReceiptUrl: payment.stripeReceiptUrl,
    stripeReceiptNumber: payment.stripeReceiptNumber,
    stripeHostedInvoiceUrl: payment.stripeHostedInvoiceUrl,
    stripeInvoicePdfUrl: payment.stripeInvoicePdfUrl,
    paymentMethodBrand: payment.paymentMethodBrand,
    paymentMethodLast4: payment.paymentMethodLast4,
  }
}

function hasUsefulReceiptFacts(facts: StripeReceiptFacts): boolean {
  return Boolean(
    facts.stripeChargeId ||
      facts.stripeReceiptUrl ||
      facts.stripeReceiptNumber ||
      facts.stripeHostedInvoiceUrl ||
      facts.stripeInvoicePdfUrl ||
      facts.paymentMethodBrand ||
      facts.paymentMethodLast4
  )
}
