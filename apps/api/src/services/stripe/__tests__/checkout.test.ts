import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertStripeCheckoutConfig,
  buildCheckoutSessionParams,
  calculateCheckoutQuote,
  CheckoutQuoteError,
} from '../checkout'
import { calculatePricing, MAX_CHECKOUT_LINE_AMOUNT } from '@ella/shared/pricing'
import type {
  CheckoutPricingInput,
  CreateCheckoutSessionInput,
} from '../../../routes/billing/schemas'
import { config } from '../../../lib/config'

vi.mock('../../../lib/config', () => ({
  config: {
    nodeEnv: 'development',
    stripe: {
      isConfigured: true,
      secretKey: 'sk_test_mock',
      successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://example.com/cancel',
      currency: 'usd',
    },
  },
}))

const basePricingInput: CheckoutPricingInput = {
  nec1099Count: 11,
  payrollEmployees: 0,
  payrollMode: 'owner-manual',
  cashPlan: { enabled: false, employees: 0, owners: 0 },
  auditProtection: false,
  oneTime: {
    startLlc: 0,
    holdingLlcNew: 0,
    holdingLlcModify: 0,
    personalTaxReturn: 0,
    businessTaxReturn: 0,
  },
  salesTaxShops: 0,
  rates: {
    tiers: { basicMonthly: 75, proMonthly: 85, vipMonthly: 85 },
    payroll: { baseMonthly: 50 },
    cashPlan: { setup: 1000, perEmployeeMonthly: 5, perOwnerMonthly: 50 },
    auditProtection: { monthly: 300, setup: 1000 },
    oneTime: {
      startLlc: 1500,
      holdingLlcNew: 4000,
      holdingLlcModify: 1000,
      personalTaxReturn: 150,
      businessTaxReturnFederal: 600,
      businessTaxReturnState: 100,
    },
    salesTaxMonitoringMonthly: 25,
  },
}

function checkoutRequest(): CreateCheckoutSessionInput {
  return {
    pricingInput: basePricingInput,
    customerEmail: 'client@example.com',
    customerName: 'Test Client',
    businessName: 'Test Business',
    quoteNotes: 'Internal note omitted from Stripe metadata',
  }
}

describe('Stripe checkout session params', () => {
  beforeEach(() => {
    const mutableConfig = config as {
      nodeEnv: string
      stripe: {
        isConfigured: boolean
        successUrl: string
        cancelUrl: string
      }
    }

    mutableConfig.nodeEnv = 'development'
    mutableConfig.stripe.isConfigured = true
    mutableConfig.stripe.successUrl = 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}'
    mutableConfig.stripe.cancelUrl = 'https://example.com/cancel'
  })

  it('builds subscription params for monthly plus setup totals', () => {
    const quote = calculateCheckoutQuote({
      ...basePricingInput,
      payrollEmployees: 5,
      cashPlan: { enabled: true, employees: 5, owners: 1 },
    })

    const params = buildCheckoutSessionParams(quote, checkoutRequest())

    expect(params.mode).toBe('subscription')
    expect(params.line_items).toHaveLength(2)
    expect(params.line_items?.[0]?.price_data?.recurring).toEqual({ interval: 'month' })
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(24500)
    expect(params.line_items?.[1]?.price_data?.unit_amount).toBe(140000)
    expect(params.customer_email).toBe('client@example.com')
    expect(params.metadata).toMatchObject({ quoteId: quote.quoteId, source: 'pricing_calculator' })
  })

  it('keeps checkout quote totals aligned with the shared pricing calculator', () => {
    const pricingInput = {
      ...basePricingInput,
      payrollEmployees: 5,
      cashPlan: { enabled: true, employees: 5, owners: 1 },
      auditProtection: true,
      oneTime: { ...basePricingInput.oneTime, personalTaxReturn: 2 },
      salesTaxShops: 2,
    }

    const checkoutQuote = calculateCheckoutQuote(pricingInput)
    const sharedQuote = calculatePricing(pricingInput)

    expect(checkoutQuote.monthlyTotal).toBe(sharedQuote.monthlyTotal)
    expect(checkoutQuote.setupTotal).toBe(sharedQuote.setupTotal)
    expect(checkoutQuote.monthlyItems.map((item) => item.label)).toEqual(
      sharedQuote.monthlyItems.map((item) => item.label)
    )
    expect(checkoutQuote.setupItems.map((item) => item.label)).toEqual(
      sharedQuote.setupItems.map((item) => item.label)
    )
  })

  it('builds subscription params for monthly-only totals', () => {
    const quote = {
      quoteId: 'quote_monthly',
      monthlyItems: [{ label: 'Monthly', amount: 125, kind: 'monthly' as const }],
      setupItems: [],
      monthlyTotal: 125,
      setupTotal: 0,
    }

    const params = buildCheckoutSessionParams(quote, checkoutRequest())

    expect(params.mode).toBe('subscription')
    expect(params.line_items).toHaveLength(1)
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(12500)
  })

  it('builds payment params for setup-only totals', () => {
    const quote = {
      quoteId: 'quote_setup',
      monthlyItems: [],
      setupItems: [{ label: 'Setup', amount: 500, kind: 'setup' as const }],
      monthlyTotal: 0,
      setupTotal: 500,
    }

    const params = buildCheckoutSessionParams(quote, checkoutRequest())

    expect(params.mode).toBe('payment')
    expect(params.line_items).toHaveLength(1)
    expect(params.line_items?.[0]?.price_data?.recurring).toBeUndefined()
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(50000)
  })

  it('rejects zero-total sessions', () => {
    const quote = {
      quoteId: 'quote_zero',
      monthlyItems: [],
      setupItems: [],
      monthlyTotal: 0,
      setupTotal: 0,
    }

    expect(() => buildCheckoutSessionParams(quote, checkoutRequest())).toThrow(CheckoutQuoteError)
  })

  it('rejects discounted rate overrides below defaults', () => {
    const discounted = {
      ...basePricingInput,
      rates: {
        ...basePricingInput.rates,
        tiers: { ...basePricingInput.rates.tiers, proMonthly: 50 },
      },
    }

    expect(() => calculateCheckoutQuote(discounted)).toThrow(CheckoutQuoteError)
  })

  it('rejects checkout without a billable selection', () => {
    expect(() =>
      calculateCheckoutQuote({
        ...basePricingInput,
        nec1099Count: 0,
      })
    ).toThrow('Select at least one billable service before checkout')
  })

  it('rejects enterprise-sized payment links', () => {
    expect(() => calculateCheckoutQuote({ ...basePricingInput, nec1099Count: 21 })).toThrow(
      'Enterprise quotes require manual follow-up'
    )
  })

  it('rejects unsafe direct checkout counts above workspace limits', () => {
    expect(() =>
      calculateCheckoutQuote({
        ...basePricingInput,
        nec1099Count: 11,
        payrollEmployees: 201,
      })
    ).toThrow('Quantity limits exceeded')

    expect(() =>
      calculateCheckoutQuote({
        ...basePricingInput,
        cashPlan: { enabled: true, employees: 201, owners: 1 },
      })
    ).toThrow('Quantity limits exceeded')

    expect(() =>
      calculateCheckoutQuote({
        ...basePricingInput,
        cashPlan: { enabled: true, employees: 1, owners: 100 },
      })
    ).toThrow('Quantity limits exceeded')

    expect(() =>
      calculateCheckoutQuote({
        ...basePricingInput,
        oneTime: { ...basePricingInput.oneTime, personalTaxReturn: 100 },
      })
    ).toThrow('Quantity limits exceeded')

    expect(() =>
      calculateCheckoutQuote({
        ...basePricingInput,
        salesTaxShops: 201,
      })
    ).toThrow('Quantity limits exceeded')
  })

  it('rejects oversized checkout totals before Stripe session creation', () => {
    const oversized = {
      ...basePricingInput,
      rates: {
        ...basePricingInput.rates,
        tiers: {
          ...basePricingInput.rates.tiers,
          proMonthly: MAX_CHECKOUT_LINE_AMOUNT + 1,
        },
      },
    }

    expect(() => calculateCheckoutQuote(oversized)).toThrow(
      'Quote total is too large for checkout'
    )
  })

  it('rejects missing Stripe configuration', () => {
    const mutableConfig = config as { stripe: { isConfigured: boolean } }

    mutableConfig.stripe.isConfigured = false

    expect(() => assertStripeCheckoutConfig()).toThrow('Stripe is not configured')
  })

  it('rejects localhost return URLs in production', () => {
    const mutableConfig = config as {
      nodeEnv: string
      stripe: { successUrl: string; cancelUrl: string }
    }

    mutableConfig.nodeEnv = 'production'
    mutableConfig.stripe.successUrl = 'http://localhost:4321/payment/success'
    mutableConfig.stripe.cancelUrl = 'https://example.com/cancel'

    expect(() => assertStripeCheckoutConfig()).toThrow('Stripe production return URLs')
  })

  it('rejects loopback return URLs in production', () => {
    const mutableConfig = config as {
      nodeEnv: string
      stripe: { successUrl: string; cancelUrl: string }
    }

    mutableConfig.nodeEnv = 'production'
    mutableConfig.stripe.successUrl = 'https://127.0.0.1/payment/success'
    mutableConfig.stripe.cancelUrl = 'https://example.com/cancel'

    expect(() => assertStripeCheckoutConfig()).toThrow('Stripe production return URLs')
  })
})
