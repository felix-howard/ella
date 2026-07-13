/**
 * Portal quote API — public sent pricing-quote endpoints (payToken-based).
 * Backed by the API's `/public/quote` routes; no auth, the token IS the credential.
 * Kept separate from api-client.ts / payment-api.ts per module-size conventions.
 */
import { ApiError, request } from './api-client'

export type QuotePublicStatus = string
export type PublicQuotePaymentStateValue =
  | 'payable'
  | 'redirecting'
  | 'processing_bank_payment'
  | 'paid'
  | 'payment_failed'
  | 'canceled_before_payment'
  | 'subscription_canceled_after_payment'
export type PublicQuotePaymentMethodFamily = 'card' | 'bank' | 'unknown'
export type PublicQuoteProcessingExplanationKey = 'ach_bank_payment_settlement'

export interface PublicQuotePaymentState {
  state: PublicQuotePaymentStateValue
  paymentMethodFamily: PublicQuotePaymentMethodFamily
  processingExplanationKey: PublicQuoteProcessingExplanationKey | null
  mayStartCheckout: boolean
  timestamps: {
    latestCheckoutSessionCreatedAt: string | null
    latestCheckoutSessionUpdatedAt: string | null
    latestCheckoutSessionExpiresAt: string | null
    latestStripeEventAt: string | null
    paidAt: string | null
  }
}

export interface QuoteLineView {
  label: string
  /** Free-form detail (custom links only); absent on calculator lines. */
  description?: string
  amount: number
  kind: 'monthly' | 'yearly' | 'setup'
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
  publicPaymentState?: PublicQuotePaymentState | null
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
  error?: string
  message?: string
}

export const quoteApi = {
  /** Load the itemized quote for the pay page. Throws ApiError(404) on unknown token. */
  getQuote: async (payToken: string): Promise<PublicQuoteView> => {
    const envelope = await request<ApiEnvelope<PublicQuoteView>>(`/public/quote/${payToken}`)
    return envelope.data
  },

  /**
   * Create a fresh Stripe Checkout Session and return its redirect URL.
   * Throws ApiError with code ALREADY_PAID / NOT_PAYABLE / PAYMENT_PROCESSING (409)
   * or RATE_LIMITED (429).
   */
  createCheckout: async (payToken: string): Promise<{ checkoutUrl: string }> => {
    const envelope = await request<
      ApiEnvelope<{ checkoutUrl: string } | { publicPaymentState: PublicQuotePaymentState | null }>
    >(
      `/public/quote/${payToken}/checkout`,
      { method: 'POST' }
    )
    if (!envelope.success || !envelope.data || !('checkoutUrl' in envelope.data)) {
      throw new ApiError(
        202,
        envelope.error ?? 'PAYMENT_PROCESSING',
        envelope.message ?? 'Payment is still processing',
        undefined,
        envelope.data
      )
    }
    return envelope.data
  },
}

export function isQuotePaymentProcessingError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === 202 || error.code === 'PAYMENT_PROCESSING')
  )
}

export function getQuotePaymentStateFromError(error: unknown): PublicQuotePaymentState | null {
  if (!(error instanceof ApiError)) return null
  const details = error.details
  if (!details || typeof details !== 'object' || !('publicPaymentState' in details)) return null

  const publicPaymentState = (details as { publicPaymentState?: unknown }).publicPaymentState
  return publicPaymentState && typeof publicPaymentState === 'object'
    ? (publicPaymentState as PublicQuotePaymentState)
    : null
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
