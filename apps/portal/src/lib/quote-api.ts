/**
 * Portal quote API — public sent pricing-quote endpoints (payToken-based).
 * Backed by the API's `/public/quote` routes; no auth, the token IS the credential.
 * Kept separate from api-client.ts / payment-api.ts per module-size conventions.
 */
import { request } from './api-client'

export type QuotePublicStatus = string

export interface QuoteLineView {
  label: string
  /** Free-form detail (custom links only); absent on calculator lines. */
  description?: string
  amount: number
  kind: 'monthly' | 'setup'
}

export interface QuoteDiscountView {
  code: string
  name: string | null
  amount: number
  recurringAmount: number
}

/** Recurring cadence of the monthly group; null when the quote is one-time only. */
export type QuoteBillingInterval = 'month' | 'year' | null

/** Mirrors `PublicQuoteView` from the API quote-checkout-service. */
export interface PublicQuoteView {
  orgName: string
  recipientFirstName: string | null
  lineItems: QuoteLineView[]
  monthlyTotal: number
  setupTotal: number
  subtotal: number
  discount: QuoteDiscountView | null
  /** Recurring cadence for the "Then $X/…" row; null = one-time only. */
  billingInterval: QuoteBillingInterval
  /** Charged at checkout after any pre-applied coupon. */
  dueToday: number
  status: QuotePublicStatus
  /** ISO timestamp once settled; null otherwise. */
  paidAt: string | null
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const quoteApi = {
  /** Load the itemized quote for the pay page. Throws ApiError(404) on unknown token. */
  getQuote: async (payToken: string): Promise<PublicQuoteView> => {
    const envelope = await request<ApiEnvelope<PublicQuoteView>>(`/public/quote/${payToken}`)
    return envelope.data
  },

  /**
   * Create a fresh Stripe Checkout Session and return its redirect URL.
   * Throws ApiError with code ALREADY_PAID / NOT_PAYABLE (409) or RATE_LIMITED (429).
   */
  createCheckout: async (payToken: string): Promise<{ checkoutUrl: string }> => {
    const envelope = await request<ApiEnvelope<{ checkoutUrl: string }>>(
      `/public/quote/${payToken}/checkout`,
      { method: 'POST' }
    )
    return envelope.data
  },
}

/** A settled quote is no longer payable — paid one-time or live subscription. */
export function isQuotePaid(status: QuotePublicStatus): boolean {
  return status === 'paid' || status === 'active'
}

/** A canceled quote can never be paid. */
export function isQuoteCanceled(status: QuotePublicStatus): boolean {
  return status === 'canceled'
}

/** Format a USD dollar amount as localized currency, e.g. "$1,500.00". */
export function formatQuoteAmount(value: number, language: string): string {
  if (!Number.isFinite(value)) return String(value)
  return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}
