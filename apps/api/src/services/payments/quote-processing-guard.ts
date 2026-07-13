import type { Prisma } from '@ella/db'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'

export const CLIENT_PAYMENT_PROCESSING_MESSAGE =
  'A bank payment for this client is still processing. Do not send another payment link until Stripe reports success or failure.'

export async function assertNoClientPaymentQuoteProcessing(
  input: {
    organizationId: string
    clientId: string | null | undefined
    excludeQuoteId?: string
  },
  db: Pick<typeof prisma, 'paymentQuote'> = prisma,
): Promise<void> {
  if (!input.clientId) return

  const where: Prisma.PaymentQuoteWhereInput = {
    organizationId: input.organizationId,
    clientId: input.clientId,
    payToken: { not: null },
    ...(input.excludeQuoteId ? { id: { not: input.excludeQuoteId } } : {}),
    OR: [
      { status: { in: ['awaiting_payment', 'duplicate_paid_review'] } },
      { checkoutSessions: { some: { status: 'duplicate_paid_review' } } },
      { checkoutSessions: { some: { status: 'complete', paidAt: null } } },
    ],
  }

  const blockingCount = await db.paymentQuote.count({ where })
  if (blockingCount > 0) {
    throw new HTTPException(409, { message: CLIENT_PAYMENT_PROCESSING_MESSAGE })
  }
}
