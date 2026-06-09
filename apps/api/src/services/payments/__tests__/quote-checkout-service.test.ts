/**
 * Tests for the portal sent-quote checkout service: public itemized view,
 * payable-state guards, reuse of an open Checkout Session (no duplicate Stripe
 * sessions per quote), and amount rebuild from the frozen input snapshot.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckoutPricingInput } from '../../../routes/billing/schemas'

const stripeMocks = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
}))

const prismaMocks = vi.hoisted(() => ({
  paymentQuote: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  stripeCheckoutSession: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: stripeMocks.sessionsCreate } }
  },
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../lib/constants', () => ({ PORTAL_URL: 'https://portal.test' }))

vi.mock('../../../lib/config', async (importOriginal) => {
  const actual = (await importOriginal()) as { config: Record<string, unknown> }
  return {
    config: {
      ...actual.config,
      nodeEnv: 'test',
      stripe: {
        ...(actual.config.stripe as Record<string, unknown>),
        secretKey: 'sk_test_mock',
        isConfigured: true,
        currency: 'usd',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
    },
  }
})

import { createQuoteCheckoutSession, getPublicQuoteView } from '../quote-checkout-service'

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

function quoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quote_1',
    organizationId: 'org_1',
    status: 'sent',
    customerEmail: 'client@example.com',
    inputSnapshot: { pricingInput: basePricingInput },
    resultSnapshot: {
      monthlyItems: [{ label: 'Pro plan', amount: 85, kind: 'monthly' }],
      setupItems: [{ label: 'LLC setup', amount: 1500, kind: 'setup' }],
      monthlyTotal: 85,
      setupTotal: 1500,
    },
    monthlyTotalCents: 8500,
    setupTotalCents: 150000,
    lastStripeEventAt: null,
    organization: { name: 'Acme Tax' },
    client: { firstName: 'Anna' },
    lead: null,
    payToken: 'tok_abcdefghij',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMocks.$transaction.mockResolvedValue([])
  prismaMocks.stripeCheckoutSession.findFirst.mockResolvedValue(null)
})

describe('getPublicQuoteView', () => {
  it('flattens snapshot lines and computes dueToday', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view).not.toBeNull()
    expect(view?.orgName).toBe('Acme Tax')
    expect(view?.recipientFirstName).toBe('Anna')
    expect(view?.lineItems).toEqual([
      { label: 'Pro plan', amount: 85, kind: 'monthly' },
      { label: 'LLC setup', amount: 1500, kind: 'setup' },
    ])
    expect(view?.monthlyTotal).toBe(85)
    expect(view?.setupTotal).toBe(1500)
    expect(view?.dueToday).toBe(1585)
    expect(view?.paidAt).toBeNull()
  })

  it('derives paidAt from lastStripeEventAt once settled', async () => {
    const settledAt = new Date('2026-06-08T10:00:00.000Z')
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({ status: 'active', lastStripeEventAt: settledAt }),
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.status).toBe('active')
    expect(view?.paidAt).toBe(settledAt.toISOString())
  })

  it('prefers lead first name over client', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({ lead: { firstName: 'Lead' }, client: { firstName: 'Client' } }),
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.recipientFirstName).toBe('Lead')
  })

  it('returns null for an unknown token', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(null)
    expect(await getPublicQuoteView('nope')).toBeNull()
  })

  it('omits billingInterval (null) for a calculator quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())
    const view = await getPublicQuoteView('tok_abcdefghij')
    expect(view?.billingInterval).toBeNull()
  })

  it('surfaces line descriptions and a monthly interval for a custom quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        source: 'custom',
        billingInterval: 'month',
        resultSnapshot: {
          monthlyItems: [{ label: 'Retainer', description: 'Monthly bookkeeping', amount: 300, kind: 'monthly' }],
          setupItems: [{ label: 'Onboarding', amount: 150, kind: 'setup' }],
          monthlyTotal: 300,
          setupTotal: 150,
        },
        monthlyTotalCents: 30000,
        setupTotalCents: 15000,
      }),
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.billingInterval).toBe('month')
    expect(view?.lineItems).toEqual([
      { label: 'Retainer', description: 'Monthly bookkeeping', amount: 300, kind: 'monthly' },
      { label: 'Onboarding', amount: 150, kind: 'setup' },
    ])
    expect(view?.dueToday).toBe(450)
  })

  it('reports a yearly billing interval', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({ source: 'custom', billingInterval: 'year' }),
    )
    const view = await getPublicQuoteView('tok_abcdefghij')
    expect(view?.billingInterval).toBe('year')
  })

  it('reports a null billing interval for a one-time custom quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        source: 'custom',
        billingInterval: null,
        resultSnapshot: {
          monthlyItems: [],
          setupItems: [{ label: 'Single fee', amount: 500, kind: 'setup' }],
          monthlyTotal: 0,
          setupTotal: 500,
        },
        monthlyTotalCents: 0,
        setupTotalCents: 50000,
      }),
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.billingInterval).toBeNull()
    expect(view?.monthlyTotal).toBe(0)
    expect(view?.dueToday).toBe(500)
  })
})

describe('createQuoteCheckoutSession', () => {
  it('returns null for an unknown token', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(null)
    expect(await createQuoteCheckoutSession('nope')).toBeNull()
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('rejects an already-paid quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow({ status: 'paid' }))
    await expect(createQuoteCheckoutSession('tok_abcdefghij')).rejects.toMatchObject({
      code: 'ALREADY_PAID',
    })
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('rejects a canceled quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow({ status: 'canceled' }))
    await expect(createQuoteCheckoutSession('tok_abcdefghij')).rejects.toMatchObject({
      code: 'NOT_PAYABLE',
    })
  })

  it('reuses an open session instead of minting a new one', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())
    prismaMocks.stripeCheckoutSession.findFirst.mockResolvedValue({
      url: 'https://stripe.test/existing',
      expiresAt: null,
    })

    const result = await createQuoteCheckoutSession('tok_abcdefghij')

    expect(result).toEqual({ checkoutUrl: 'https://stripe.test/existing' })
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('creates a subscription session pinned to the existing quote id', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())
    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_new',
      url: 'https://stripe.test/cs_new',
      status: 'open',
      customer: null,
      subscription: null,
      payment_intent: null,
      expires_at: null,
    })

    const result = await createQuoteCheckoutSession('tok_abcdefghij')

    expect(result).toEqual({ checkoutUrl: 'https://stripe.test/cs_new' })
    const params = stripeMocks.sessionsCreate.mock.calls[0][0]
    expect(params.mode).toBe('subscription')
    // quoteId pinned to existing row so the webhook resolves back to this quote
    expect(params.client_reference_id).toBe('quote_1')
    expect(params.metadata.paymentQuoteId).toBe('quote_1')
    expect(params.metadata.quotePayToken).toBe('tok_abcdefghij')
    expect(params.success_url).toBe('https://portal.test/quote/tok_abcdefghij?status=success')
    expect(params.cancel_url).toBe('https://portal.test/quote/tok_abcdefghij?status=canceled')
    expect(prismaMocks.$transaction).toHaveBeenCalledTimes(1)
  })
})
