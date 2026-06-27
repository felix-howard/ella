import {
  buildPaymentPayUrl,
  normalizeDepositPaymentDescription,
} from '../../services/payments/deposit-payment-service'

type ReceiptStatus = 'available' | 'pending' | 'not_applicable'

const allowedStripeReceiptHosts = new Set(['invoice.stripe.com', 'pay.stripe.com'])

interface StaffPaymentSource {
  id: string
  type: string
  status: string
  amount: { toString(): string }
  currency: string
  description: string | null
  paidAt: Date | null
  createdAt: Date
  payToken: string
  agreement: { id: string; title: string } | null
  stripeCustomerId?: string | null
  stripeInvoiceId?: string | null
  stripeChargeId?: string | null
  stripeReceiptUrl?: string | null
  stripeReceiptNumber?: string | null
  stripeHostedInvoiceUrl?: string | null
  stripeInvoicePdfUrl?: string | null
  paymentMethodBrand?: string | null
  paymentMethodLast4?: string | null
  receiptSyncedAt?: Date | null
}

export function serializeClientPayment(payment: StaffPaymentSource) {
  return {
    id: payment.id,
    type: payment.type,
    status: payment.status,
    amount: payment.amount.toString(),
    currency: payment.currency,
    description:
      payment.type === 'DEPOSIT'
        ? normalizeDepositPaymentDescription(payment.description)
        : payment.description,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    agreement: payment.agreement,
    payUrl: buildPaymentPayUrl(payment.payToken),
    stripeCustomerId: payment.stripeCustomerId,
    stripeInvoiceId: payment.stripeInvoiceId,
    stripeChargeId: payment.stripeChargeId,
    receiptUrl: normalizeReceiptUrl(payment.stripeReceiptUrl),
    invoicePdfUrl: normalizeReceiptUrl(payment.stripeInvoicePdfUrl),
    hostedInvoiceUrl: normalizeReceiptUrl(payment.stripeHostedInvoiceUrl),
    receiptNumber: payment.stripeReceiptNumber,
    paymentMethodLabel: buildPaymentMethodLabel(
      payment.paymentMethodBrand,
      payment.paymentMethodLast4
    ),
    receiptSyncedAt: payment.receiptSyncedAt,
    receiptStatus: getReceiptStatus(payment),
  }
}

function normalizeReceiptUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') return null
    if (!allowedStripeReceiptHosts.has(parsed.hostname)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

function getReceiptStatus(payment: {
  status: string
  receiptSyncedAt?: Date | null
  stripeHostedInvoiceUrl?: string | null
  stripeInvoicePdfUrl?: string | null
  stripeReceiptUrl?: string | null
}): ReceiptStatus {
  if (payment.status !== 'PAID') return 'not_applicable'
  if (getBestReceiptUrl(payment)) return 'available'
  return payment.receiptSyncedAt ? 'not_applicable' : 'pending'
}

function getBestReceiptUrl(payment: {
  stripeHostedInvoiceUrl?: string | null
  stripeInvoicePdfUrl?: string | null
  stripeReceiptUrl?: string | null
}): string | null {
  return (
    normalizeReceiptUrl(payment.stripeHostedInvoiceUrl) ??
    normalizeReceiptUrl(payment.stripeInvoicePdfUrl) ??
    normalizeReceiptUrl(payment.stripeReceiptUrl) ??
    null
  )
}

function buildPaymentMethodLabel(
  brand: string | null | undefined,
  last4: string | null | undefined
): string | null {
  const normalizedLast4 = last4?.trim()
  if (!normalizedLast4) return null

  const normalizedBrand = brand?.trim()
  if (!normalizedBrand) return `Card •••• ${normalizedLast4}`

  return `${formatCardBrand(normalizedBrand)} •••• ${normalizedLast4}`
}

function formatCardBrand(brand: string): string {
  return brand
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}
