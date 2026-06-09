/**
 * Portal payment API — public deposit payment endpoints (payToken-based).
 * Backed by the API's `/public/pay` routes; no auth, the token IS the credential.
 * Kept separate from api-client.ts per module-size conventions.
 */
import { request } from './api-client'

export type PaymentPublicStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED'

/** Mirrors `PublicPaymentView` from the API deposit-checkout-service. */
export interface PublicPaymentView {
  /** Decimal string, e.g. "1500" or "1500.5". */
  amount: string
  /** Lowercase ISO currency code, e.g. "usd". */
  currency: string
  /** e.g. "Retainer – Engagement Letter" — null for legacy rows. */
  description: string | null
  status: PaymentPublicStatus
  clientFirstName: string | null
  organizationName: string
  /** ISO timestamp once paid; null otherwise. */
  paidAt: string | null
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const paymentApi = {
  /** Load minimal payment info for the pay page. Throws ApiError(404) on unknown token. */
  getPayment: async (payToken: string): Promise<PublicPaymentView> => {
    const envelope = await request<ApiEnvelope<PublicPaymentView>>(`/public/pay/${payToken}`)
    return envelope.data
  },

  /**
   * Create a fresh Stripe Checkout Session and return its redirect URL.
   * Throws ApiError with code ALREADY_PAID / NOT_PAYABLE (409) or RATE_LIMITED (429).
   */
  createCheckout: async (payToken: string): Promise<{ checkoutUrl: string }> => {
    const envelope = await request<ApiEnvelope<{ checkoutUrl: string }>>(
      `/public/pay/${payToken}/checkout`,
      { method: 'POST' }
    )
    return envelope.data
  },
}

/** Format a decimal-string amount as localized currency, e.g. "$1,500.00". */
export function formatPaymentAmount(amount: string, currency: string, language: string): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) return amount
  return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
  }).format(value)
}
