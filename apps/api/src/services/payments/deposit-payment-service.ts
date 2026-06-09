/**
 * Deposit Payment creation + client pay-link SMS, fired after an agreement
 * with "Collect a deposit" is signed.
 *
 * Idempotency: at most one PENDING/PAID Payment per agreement — re-triggers
 * (sign endpoint retry, double hook fire) are no-ops. SMS failure leaves the
 * Payment row in place; staff can use the "Resend payment link" button.
 *
 * Delivery/persistence is shared with the receipt SMS via
 * `signer-sms-delivery.ts`.
 */
import { customAlphabet } from 'nanoid'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'
import { PORTAL_URL } from '../../lib/constants'
import type { PostSignAgreementContext } from '../agreements/agreement-post-sign-notifications'
import {
  buildDepositPayLinkMessage,
  formatUsdAmount,
  DEPOSIT_PAY_LINK_TEMPLATE_NAME,
} from './payment-sms-templates'
import { sendSignerSmsAndPersist } from './signer-sms-delivery'

const generatePayToken = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  32,
)

/** Public portal pay page URL for a Payment. Phase 4 serves this route. */
export function buildPaymentPayUrl(payToken: string): string {
  return `${PORTAL_URL}/pay/${payToken}`
}

/**
 * Create the PENDING deposit Payment for a just-signed agreement and SMS the
 * client the portal pay link. No-op when the agreement has no pending deposit
 * or a Payment already exists (idempotent).
 */
export async function createDepositPaymentForAgreement(
  ctx: PostSignAgreementContext,
): Promise<void> {
  const depositAmount = ctx.depositAmount
  if (!depositAmount || Number(depositAmount.toString()) <= 0) return
  if (ctx.depositStatus !== 'PENDING') return

  // Idempotency: the post-sign hook fires at most once per agreement — it
  // runs only when the signing updateMany (WHERE status='SENT') reports
  // count===1, and that SENT→SIGNED transition is one-shot (retries get 409
  // before the hook). This findFirst is defense-in-depth for future callers;
  // it is NOT race-safe on its own (no DB unique on agreementId by design —
  // BALANCE/refund payments may share an agreement later).
  const existing = await prisma.payment.findFirst({
    where: { agreementId: ctx.id, status: { in: ['PENDING', 'PAID'] } },
    select: { id: true },
  })
  if (existing) {
    console.warn(
      `[Payment] Deposit payment already exists for agreement=${ctx.id} — skipping create`,
    )
    return
  }

  const payment = await prisma.payment.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: ctx.clientId,
      leadId: ctx.leadId,
      agreementId: ctx.id,
      type: 'DEPOSIT',
      status: 'PENDING',
      amount: depositAmount.toString(),
      payToken: generatePayToken(),
      description: `Retainer – ${ctx.title}`,
    },
  })

  await sendDepositPayLinkSms(ctx, payment.payToken)
}

/**
 * SMS the signer their pay link and persist to chat history. Reused by the
 * staff "Resend payment link" endpoint via `resendDepositPayLink`.
 */
export async function sendDepositPayLinkSms(
  ctx: PostSignAgreementContext,
  payToken: string,
): Promise<void> {
  const message = buildDepositPayLinkMessage({
    firstName: ctx.signer.firstName,
    amountFormatted: formatUsdAmount(ctx.depositAmount ?? '0'),
    url: buildPaymentPayUrl(payToken),
  })
  await sendSignerSmsAndPersist(
    {
      signerId: ctx.signer.id,
      signerKind: ctx.signer.kind,
      organizationId: ctx.organizationId,
      sentById: ctx.createdByUserId,
    },
    message,
    DEPOSIT_PAY_LINK_TEMPLATE_NAME,
  )
}

/**
 * Staff "Resend payment link": re-send the pay-link SMS for a client's
 * PENDING deposit Payment. Throws HTTPException for route-friendly errors.
 */
export async function resendDepositPayLink(params: {
  clientId: string
  agreementId: string
  orgId: string
}): Promise<{ payUrl: string }> {
  const payment = await prisma.payment.findFirst({
    where: {
      agreementId: params.agreementId,
      clientId: params.clientId,
      organizationId: params.orgId,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      agreement: {
        select: {
          id: true,
          title: true,
          createdByUserId: true,
          leadId: true,
          clientId: true,
          depositAmount: true,
          depositStatus: true,
          lead: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { id: true, firstName: true, lastName: true } },
          organization: { select: { name: true } },
        },
      },
    },
  })
  if (!payment || !payment.agreement) {
    throw new HTTPException(404, { message: 'No deposit payment found for this agreement' })
  }
  if (payment.status !== 'PENDING') {
    throw new HTTPException(409, { message: 'Payment is not pending — link cannot be resent' })
  }

  // Signer resolution mirrors the signing service: prefer lead when present.
  const agreement = payment.agreement
  const signer = agreement.lead
    ? { id: agreement.lead.id, firstName: agreement.lead.firstName, lastName: agreement.lead.lastName, kind: 'lead' as const }
    : agreement.client
      ? { id: agreement.client.id, firstName: agreement.client.firstName, lastName: agreement.client.lastName, kind: 'client' as const }
      : null
  if (!signer) {
    throw new HTTPException(409, { message: 'Agreement has no linked lead or client' })
  }

  await sendDepositPayLinkSms(
    {
      id: agreement.id,
      organizationId: params.orgId,
      orgName: agreement.organization.name,
      title: agreement.title,
      createdByUserId: agreement.createdByUserId,
      leadId: agreement.leadId,
      clientId: agreement.clientId,
      // Payment.amount (not agreement.depositAmount) is the immutable source
      // of truth — a later agreement deposit edit must NOT change what an
      // already-issued pay link charges.
      depositAmount: payment.amount,
      depositStatus: agreement.depositStatus,
      signer,
    },
    payment.payToken,
  )

  return { payUrl: buildPaymentPayUrl(payment.payToken) }
}
