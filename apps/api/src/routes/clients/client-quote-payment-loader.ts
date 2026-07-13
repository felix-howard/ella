import { prisma } from '../../lib/db'
import {
  firstPaymentEvidenceBySessionId,
  serializeClientQuotePayment,
  type SerializedClientQuotePayment,
} from './client-quote-payment-response'

export async function loadClientQuotePayments(params: {
  clientId: string
  organizationId: string
}): Promise<SerializedClientQuotePayment[]> {
  const { clientId, organizationId } = params
  const quoteRows = await prisma.paymentQuote.findMany({
    where: {
      clientId,
      organizationId,
      payToken: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      source: true,
      status: true,
      payToken: true,
      sentAt: true,
      createdAt: true,
      updatedAt: true,
      lastStripeEventAt: true,
      monthlyTotalCents: true,
      setupTotalCents: true,
      billingInterval: true,
      agreement: { select: { id: true, title: true } },
      checkoutSessions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          stripeSessionId: true,
          stripePaymentIntentId: true,
          stripeInvoiceId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true,
          paidAt: true,
          lastStripeEventAt: true,
        },
      },
    },
  })
  const quoteSessionIds = quoteRows.flatMap((quote) =>
    quote.checkoutSessions.map((session) => session.stripeSessionId)
  )
  const quotePaymentEvidence = quoteSessionIds.length
    ? await prisma.payment.findMany({
        where: {
          clientId,
          organizationId,
          payToken: { in: quoteSessionIds.map((sessionId) => `qf_${sessionId}`) },
          status: 'PAID',
        },
        orderBy: { paidAt: 'asc' },
        select: {
          payToken: true,
          stripeSessionId: true,
          status: true,
          paidAt: true,
          paymentMethodBrand: true,
        },
      })
    : []
  const evidenceBySessionId = firstPaymentEvidenceBySessionId(quotePaymentEvidence)

  return quoteRows.map((quote) => {
    const firstEvidenceSessionId = quote.checkoutSessions.find((session) =>
      evidenceBySessionId.has(session.stripeSessionId)
    )?.stripeSessionId
    return serializeClientQuotePayment(
      quote,
      firstEvidenceSessionId ? evidenceBySessionId.get(firstEvidenceSessionId) ?? null : null,
    )
  })
}
