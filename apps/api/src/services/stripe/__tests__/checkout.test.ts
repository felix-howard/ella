import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertStripeCheckoutConfig,
  buildCheckoutSessionParams,
  calculateCheckoutQuote,
  CheckoutQuoteError,
} from '../checkout'
import {
  CALCULATOR_MONTHLY_LABEL,
  CALCULATOR_SETUP_LABEL,
  toCheckoutLineItems,
} from '../checkout-line-items'
import type { CheckoutQuote } from '../quote-calculator'

/** Adapt a CheckoutQuote to the generalized `(lineItems, opts)` builder signature. */
function buildParams(quote: CheckoutQuote) {
  return buildCheckoutSessionParams(toCheckoutLineItems(quote), {
    quoteId: quote.quoteId,
    customerEmail: 'client@example.com',
  })
}
import { calculatePricing, MAX_CHECKOUT_LINE_AMOUNT } from '@ella/shared/pricing'
import type { CheckoutPricingInput } from '../../../routes/billing/schemas'
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
  customItems: [],
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
      businessTaxReturnFederal: 800,
      businessTaxReturnState: 100,
    },
    salesTaxMonitoringMonthly: 25,
  },
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

    const params = buildParams(quote)

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

  it('includes calculator custom items in checkout quote totals', () => {
    const pricingInput = {
      ...basePricingInput,
      customItems: [
        {
          id: 'custom_monthly_1',
          label: 'Advisory add-on',
          amount: 40,
          quantity: 1,
          billingInterval: 'month' as const,
        },
        {
          id: 'custom_once_1',
          label: 'Clean-up project',
          amount: 25,
          quantity: 2,
          billingInterval: 'one_time' as const,
        },
      ],
    }

    const checkoutQuote = calculateCheckoutQuote(pricingInput)
    const sharedQuote = calculatePricing(pricingInput)

    expect(checkoutQuote.monthlyTotal).toBe(sharedQuote.monthlyTotal)
    expect(checkoutQuote.setupTotal).toBe(sharedQuote.setupTotal)
    expect(checkoutQuote.monthlyItems.map((item) => item.label)).toContain('Advisory add-on')
    expect(checkoutQuote.setupItems.map((item) => item.label)).toContain('Clean-up project × 2')
  })

  it('keeps calculator custom labels out of aggregate Stripe lines and metadata', () => {
    const quote = calculateCheckoutQuote({
      ...basePricingInput,
      customItems: [
        {
          id: 'custom_sensitive',
          label: 'Sensitive client cleanup',
          amount: 40,
          quantity: 1,
          billingInterval: 'month',
        },
        {
          id: 'custom_once',
          label: 'Prior-year reconstruction',
          amount: 25,
          quantity: 1,
          billingInterval: 'one_time',
        },
      ],
    })

    const params = buildParams(quote)
    const lineNames = params.line_items?.map((item) => item.price_data?.product_data?.name)

    expect(lineNames).toEqual([CALCULATOR_MONTHLY_LABEL, CALCULATOR_SETUP_LABEL])
    expect(JSON.stringify(params.metadata)).not.toContain('Sensitive client cleanup')
    expect(JSON.stringify(params.metadata)).not.toContain('Prior-year reconstruction')
  })

  it('builds subscription params for monthly-only totals', () => {
    const quote = {
      quoteId: 'quote_monthly',
      monthlyItems: [{ label: 'Monthly', amount: 125, kind: 'monthly' as const }],
      setupItems: [],
      monthlyTotal: 125,
      setupTotal: 0,
    }

    const params = buildParams(quote)

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

    const params = buildParams(quote)

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

    expect(() => buildParams(quote)).toThrow(CheckoutQuoteError)
  })

  it('allows discounted rate overrides below defaults', () => {
    const discounted = {
      ...basePricingInput,
      rates: {
        ...basePricingInput.rates,
        tiers: { ...basePricingInput.rates.tiers, proMonthly: 50 },
      },
    }

    const quote = calculateCheckoutQuote(discounted)

    expect(quote.monthlyTotal).toBe(50)
    expect(quote.monthlyItems).toEqual([
      { label: 'Pro tier', amount: 50, kind: 'monthly' },
    ])
  })

  it('rejects checkout without a billable selection', () => {
    expect(() =>
      calculateCheckoutQuote({
        ...basePricingInput,
        nec1099Count: 0,
      })
    ).toThrow('Select at least one billable service before checkout')
  })

  it('rejects custom-only calculator checkout', () => {
    expect(() =>
      calculateCheckoutQuote({
        ...basePricingInput,
        nec1099Count: 0,
        customItems: [
          {
            id: 'custom_only',
            label: 'Staff-entered add-on',
            amount: 50,
            quantity: 1,
            billingInterval: 'month',
          },
        ],
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

    expect(() => calculateCheckoutQuote(oversized)).toThrow('Quote total is too large for checkout')
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

describe('buildCheckoutSessionParams — generalized line items + coupons', () => {
  beforeEach(() => {
    const mutableConfig = config as { nodeEnv: string; stripe: { isConfigured: boolean } }
    mutableConfig.nodeEnv = 'development'
    mutableConfig.stripe.isConfigured = true
  })

  it('maps custom line items with description, quantity and per-item interval', () => {
    const params = buildCheckoutSessionParams(
      [
        {
          label: 'Annual retainer',
          description: 'Yearly support plan',
          unitAmountCents: 120000,
          quantity: 2,
          interval: 'year',
        },
        { label: 'Onboarding', unitAmountCents: 50000, quantity: 1, interval: 'one_time' },
      ],
      { quoteId: 'quote_custom', metadataSource: 'custom_link' }
    )

    expect(params.mode).toBe('subscription') // any recurring line → subscription
    expect(params.line_items).toHaveLength(2)
    expect(params.line_items?.[0]?.quantity).toBe(2)
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(120000)
    expect(params.line_items?.[0]?.price_data?.recurring).toEqual({ interval: 'year' })
    expect(params.line_items?.[0]?.price_data?.product_data?.description).toBe(
      'Yearly support plan'
    )
    expect(params.line_items?.[1]?.price_data?.recurring).toBeUndefined()
    expect(params.metadata).toMatchObject({ source: 'custom_link', quoteId: 'quote_custom' })
  })

  it('formats multiline product names as comma-separated text for Stripe', () => {
    const params = buildCheckoutSessionParams(
      [
        {
          label: '  Bookkeeping\n\n - Audit tax \n Paperwork cleanup  ',
          unitAmountCents: 100000,
          quantity: 1,
          interval: 'one_time',
        },
      ],
      { quoteId: 'quote_multiline', metadataSource: 'custom_link' }
    )

    expect(params.line_items?.[0]?.price_data?.product_data?.name).toBe(
      'Bookkeeping, Audit tax, Paperwork cleanup'
    )
  })

  it('uses payment mode when every line is one-time', () => {
    const params = buildCheckoutSessionParams(
      [{ label: 'Single fee', unitAmountCents: 9900, quantity: 1, interval: 'one_time' }],
      { quoteId: 'quote_one_time' }
    )
    expect(params.mode).toBe('payment')
  })

  it('attaches a pre-applied coupon as discounts', () => {
    const params = buildCheckoutSessionParams(
      [{ label: 'Item', unitAmountCents: 1000, quantity: 1, interval: 'month' }],
      { quoteId: 'q', stripeCouponId: 'coupon_abc' }
    )
    expect(params.discounts).toEqual([{ coupon: 'coupon_abc' }])
    expect(params.allow_promotion_codes).toBeUndefined()
  })

  it('enables the promo-code field when allowPromotionCodes is set', () => {
    const params = buildCheckoutSessionParams(
      [{ label: 'Item', unitAmountCents: 1000, quantity: 1, interval: 'month' }],
      { quoteId: 'q', allowPromotionCodes: true }
    )
    expect(params.allow_promotion_codes).toBe(true)
    expect(params.discounts).toBeUndefined()
  })

  it('rejects using a coupon and promotion codes together', () => {
    expect(() =>
      buildCheckoutSessionParams(
        [{ label: 'Item', unitAmountCents: 1000, quantity: 1, interval: 'month' }],
        {
          quoteId: 'q',
          stripeCouponId: 'coupon_abc',
          allowPromotionCodes: true,
        }
      )
    ).toThrow(CheckoutQuoteError)
  })

  it('rejects an empty line-item list', () => {
    expect(() => buildCheckoutSessionParams([], { quoteId: 'q' })).toThrow(CheckoutQuoteError)
  })
})
