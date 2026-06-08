/**
 * Portal deposit checkout: token-based public payment lookup, on-demand
 * Stripe Checkout Session creation, and webhook fulfillment.
 *
 * Distinct from the PaymentQuote checkout (services/stripe/checkout.ts) —
 * deposit sessions are always `mode: 'payment'`, single line item, and carry
 * `metadata.payToken` which the shared Stripe webhook uses as discriminator.
 *
 * Security: amount/currency are always read server-side from the Payment row,
 * never from the client request.
 */
import Stripe from 'stripe'
import type { Prisma } from '@ella/db'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'
import { isUnsafeProductionReturnUrl } from '../stripe/checkout'
import { smsOptedInAdmins } from '../agreements/agreement-post-sign-notifications'
import { buildPaymentPayUrl } from './deposit-payment-service'
import { sendSignerSmsAndPersist } from './signer-sms-delivery'
import {
  buildAdminPaymentReceivedMessage,
  buildDepositReceiptMessage,
  formatUsdAmount,
  DEPOSIT_RECEIPT_TEMPLATE_NAME,
} from './payment-sms-templates'

/** Route-friendly error with a stable code; handlers map codes to statuses. */
export class DepositCheckoutError extends Error {
  constructor(
    readonly code: 'ALREADY_PAID' | 'NOT_PAYABLE' | 'STRIPE_MISSING_URL',
    message: string,
  ) {
    super(message)
    this.name = 'DepositCheckoutError'
  }
}

let stripeClient: Stripe | null = null

function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(config.stripe.secretKey)
  return stripeClient
}

/**
 * Deposit-specific config assertion. Intentionally does NOT reuse
 * `assertStripeCheckoutConfig` — that validates the quote flow's
 * STRIPE_SUCCESS_URL/CANCEL_URL, which the deposit flow never uses. The
 * deposit return URL is derived from PORTAL_URL and validated here instead.
 */
function assertDepositCheckoutConfig(payUrl: string): void {
  if (!config.stripe.isConfigured) {
    throw new Error('Stripe is not configured')
  }
  if (config.nodeEnv === 'production' && isUnsafeProductionReturnUrl(payUrl)) {
    throw new Error('PORTAL_URL must be a valid public HTTPS URL for deposit payments in production')
  }
}

const paymentWithSignerInclude = {
  organization: { select: { name: true } },
  client: { select: { id: true, firstName: true, lastName: true, email: true } },
  lead: { select: { id: true, firstName: true, lastName: true, email: true } },
  agreement: { select: { id: true, title: true, createdByUserId: true } },
} as const

/** Minimal public payload for the portal pay page — no PII beyond first name. */
export interface PublicPaymentView {
  amount: string
  currency: string
  description: string | null
  status: string
  clientFirstName: string | null
  organizationName: string
  paidAt: string | null
}

/** Load the public pay-page view for a payToken. Null when token unknown. */
export async function getPublicPaymentView(payToken: string): Promise<PublicPaymentView | null> {
  const payment = await prisma.payment.findUnique({
    where: { payToken },
    include: paymentWithSignerInclude,
  })
  if (!payment) return null

  return {
    amount: payment.amount.toString(),
    currency: payment.currency,
    description: payment.description,
    status: payment.status,
    // Signer resolution mirrors the signing service: prefer lead when present.
    clientFirstName: payment.lead?.firstName ?? payment.client?.firstName ?? null,
    organizationName: payment.organization.name,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
  }
}

/**
 * Best-effort self-heal: if a payment is still PENDING/FAILED but its Stripe
 * Checkout Session already reports `paid`, mark it PAID synchronously instead
 * of waiting on the webhook. Covers webhook delay/failure in production and
 * local dev without `stripe listen`.
 *
 * Never throws — Stripe/network errors leave the DB untouched so the webhook
 * can still fulfill later. Skips the Stripe round-trip unless a checkout
 * session actually exists, so fresh page loads stay free of API calls.
 */
export async function reconcileDepositPaymentFromStripe(payToken: string): Promise<void> {
  if (!config.stripe.isConfigured) return

  const payment = await prisma.payment.findUnique({
    where: { payToken },
    select: { status: true, stripeSessionId: true },
  })
  if (!payment?.stripeSessionId) return
  if (payment.status !== 'PENDING' && payment.status !== 'FAILED') return

  try {
    const session = await getStripeClient().checkout.sessions.retrieve(payment.stripeSessionId, {
      expand: ['payment_intent'],
    })
    if (session.payment_status !== 'paid') return
    // Prefer the PaymentIntent's creation time; fall back to now.
    const intent =
      typeof session.payment_intent === 'object' ? session.payment_intent : null
    const eventAt = intent?.created ? new Date(intent.created * 1000) : new Date()
    await markDepositPaymentPaid(session, eventAt)
  } catch (err) {
    console.error(`[Payment] Stripe reconcile failed for payToken=${payToken}:`, err)
  }
}

/**
 * Create a fresh Stripe Checkout Session for a PENDING/FAILED payment and
 * return its redirect URL. Stale `stripeSessionId` is simply overwritten —
 * abandoned Stripe sessions self-expire (≤24h).
 */
export async function createDepositCheckoutSession(
  payToken: string,
): Promise<{ checkoutUrl: string } | null> {
  const payUrl = buildPaymentPayUrl(payToken)
  assertDepositCheckoutConfig(payUrl)

  const payment = await prisma.payment.findUnique({
    where: { payToken },
    include: paymentWithSignerInclude,
  })
  if (!payment) return null

  if (payment.status === 'PAID' || payment.status === 'REFUNDED') {
    throw new DepositCheckoutError('ALREADY_PAID', 'This payment has already been completed')
  }
  if (payment.status === 'CANCELED') {
    throw new DepositCheckoutError('NOT_PAYABLE', 'This payment has been canceled')
  }

  const customerEmail = payment.lead?.email ?? payment.client?.email ?? undefined
  const session = await getStripeClient().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payment.currency,
          unit_amount: Math.round(Number(payment.amount.toString()) * 100),
          product_data: { name: payment.description ?? 'Deposit payment' },
        },
      },
    ],
    success_url: `${payUrl}?status=success`,
    cancel_url: `${payUrl}?status=canceled`,
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    client_reference_id: payment.id,
    metadata: {
      payToken,
      paymentId: payment.id,
      ...(payment.agreementId ? { agreementId: payment.agreementId } : {}),
    },
  })

  if (!session.url) {
    throw new DepositCheckoutError('STRIPE_MISSING_URL', 'Stripe did not return a Checkout URL')
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { stripeSessionId: session.id },
  })

  return { checkoutUrl: session.url }
}

/**
 * Webhook fulfillment: mark the Payment PAID, sync the agreement's deposit
 * fields, then notify (admin fan-out + client receipt SMS).
 *
 * Idempotent: the PAID claim is a guarded updateMany — duplicate webhook
 * deliveries find count===0 and exit before any notification fires.
 */
export async function markDepositPaymentPaid(
  session: Stripe.Checkout.Session,
  eventAt: Date,
): Promise<void> {
  const payToken = session.metadata?.payToken
  if (!payToken) return

  const payment = await prisma.payment.findUnique({
    where: { payToken },
    include: paymentWithSignerInclude,
  })
  if (!payment) {
    console.warn(`[Payment] Webhook payToken has no Payment row — session=${session.id}`)
    return
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null)

  // Claim guard: never re-mark PAID (duplicate webhook) and never flip a
  // REFUNDED payment back (late duplicate after refund). CANCELED → PAID is
  // allowed — money actually moved through a session created pre-cancel.
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { notIn: ['PAID', 'REFUNDED'] } },
    data: {
      status: 'PAID',
      paidAt: eventAt,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    },
  })
  if (claimed.count === 0) return

  // Sync agreement deposit fields (tolerates agreementId=null per SetNull FKs).
  if (payment.agreementId) {
    try {
      await prisma.agreement.updateMany({
        where: { id: payment.agreementId, depositStatus: { not: 'PAID' } },
        data: { depositStatus: 'PAID', depositPaidAt: eventAt },
      })
    } catch (err) {
      console.error(
        `[Payment] Failed to sync agreement deposit fields for payment=${payment.id}:`,
        err,
      )
    }
  }

  await notifyDepositPaymentPaid(payment)
}

type PaymentWithSigner = Prisma.PaymentGetPayload<{
  include: typeof paymentWithSignerInclude
}>

/** Post-fulfillment notifications — each step isolated so one failure never blocks the other. */
async function notifyDepositPaymentPaid(payment: PaymentWithSigner): Promise<void> {
  // Signer resolution mirrors the signing service: prefer lead when present.
  const signer = payment.lead
    ? { ...payment.lead, kind: 'lead' as const }
    : payment.client
      ? { ...payment.client, kind: 'client' as const }
      : null
  const amountFormatted = formatUsdAmount(payment.amount)
  const payerName = signer
    ? [signer.firstName, signer.lastName].filter(Boolean).join(' ')
    : 'A client'

  try {
    await smsOptedInAdmins({
      organizationId: payment.organizationId,
      toggle: 'notifyOnClientPayment',
      message: buildAdminPaymentReceivedMessage({
        payerName,
        amountFormatted,
        agreementTitle: payment.agreement?.title ?? null,
      }),
      logContext: `payment=${payment.id} paid`,
    })
  } catch (err) {
    console.error(`[Payment] Admin paid-notification failed for payment=${payment.id}:`, err)
  }

  // Receipt SMS needs both a signer and an attributable staff sender
  // (Message/SmsSendLog rows require sentById). Skip gracefully when the
  // agreement was deleted (SetNull) — admins were still notified above.
  if (!signer || !payment.agreement?.createdByUserId) {
    console.warn(
      `[Payment] Receipt SMS skipped for payment=${payment.id} — missing ${signer ? 'agreement sender' : 'signer'}`,
    )
    return
  }

  try {
    await sendSignerSmsAndPersist(
      {
        signerId: signer.id,
        signerKind: signer.kind,
        organizationId: payment.organizationId,
        sentById: payment.agreement.createdByUserId,
      },
      buildDepositReceiptMessage({
        firstName: signer.firstName,
        amountFormatted,
      }),
      DEPOSIT_RECEIPT_TEMPLATE_NAME,
    )
  } catch (err) {
    console.error(`[Payment] Receipt SMS failed for payment=${payment.id}:`, err)
  }
}
