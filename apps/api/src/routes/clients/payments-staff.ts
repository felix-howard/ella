/**
 * Staff-facing payment endpoints for the Client entity — mounted on
 * `/clients`, so paths are relative to `/clients/:clientId/...`. Mirrors the
 * agreements-staff split: ADMIN/MANAGER guard, same response envelopes.
 *
 * Powers the phase-5 workspace UI: client profile Payments tab + the
 * "Resend payment link" button on a pending deposit.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { requireAdminOrManager } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import { checkRateLimit } from '../../middleware/rate-limiter'
import type { AuthUser } from '../../services/auth'
import { prisma } from '../../lib/db'
import {
  buildPaymentPayUrl,
  resendDepositPayLink,
} from '../../services/payments/deposit-payment-service'
import {
  clientIdParamSchema,
  clientAndAgreementIdParamSchema,
} from './agreements-staff-schemas'

const clientsPaymentsStaffRoute = new Hono<{ Variables: AuthVariables }>()

function getOrgId(user: AuthUser): string {
  if (!user.organizationId) {
    throw new HTTPException(403, { message: 'Organization required' })
  }
  return user.organizationId
}

// GET /:clientId/payments — payments list for the client profile tab
clientsPaymentsStaffRoute.get(
  '/:clientId/payments',
  requireAdminOrManager,
  zValidator('param', clientIdParamSchema),
  async (c) => {
    const orgId = getOrgId(c.get('user'))
    const { clientId } = c.req.valid('param')

    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: orgId },
      select: { id: true },
    })
    if (!client) throw new HTTPException(404, { message: 'Client not found' })

    const payments = await prisma.payment.findMany({
      where: { clientId, organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: { agreement: { select: { id: true, title: true } } },
    })

    // Past-due indicator: any sent quote for this client whose latest recurring
    // charge failed (webhook flips it to `payment_failed`). Drives the tab banner
    // so staff can chase the client to update their card.
    const pastDueCount = await prisma.paymentQuote.count({
      where: {
        clientId,
        organizationId: orgId,
        payToken: { not: null },
        status: 'payment_failed',
      },
    })

    return c.json({
      success: true,
      pastDue: pastDueCount > 0,
      data: payments.map((payment) => ({
        id: payment.id,
        type: payment.type,
        status: payment.status,
        amount: payment.amount.toString(),
        currency: payment.currency,
        description: payment.description,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        agreement: payment.agreement,
        payUrl: buildPaymentPayUrl(payment.payToken),
      })),
    })
  },
)

// POST /:clientId/agreements/:id/resend-payment-link — re-SMS the pay link
// for the agreement's PENDING deposit Payment.
clientsPaymentsStaffRoute.post(
  '/:clientId/agreements/:id/resend-payment-link',
  requireAdminOrManager,
  zValidator('param', clientAndAgreementIdParamSchema),
  async (c) => {
    const orgId = getOrgId(c.get('user'))
    const { clientId, id } = c.req.valid('param')

    // Server-side throttle: each call sends a real SMS. Makes the UI's 60s
    // cooldown authoritative (page refresh / direct API can't bypass it).
    if (!checkRateLimit(`resend-paylink:${clientId}:${id}`, 60_000, 1)) {
      throw new HTTPException(429, {
        message: 'Payment link was just sent — wait a minute before resending',
      })
    }

    const result = await resendDepositPayLink({ clientId, agreementId: id, orgId })
    return c.json({ success: true, data: result })
  },
)

export { clientsPaymentsStaffRoute }
