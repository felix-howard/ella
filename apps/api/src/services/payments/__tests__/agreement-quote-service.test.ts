/**
 * Tests for calculator quotes linked to Engagement Letters.
 * Covers frozen draft quotes, activation idempotency, SMS failure tolerance,
 * and staff-review status transitions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  agreement: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  paymentQuote: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
  },
  lead: {
    findFirst: vi.fn(),
  },
}))

const quoteMocks = vi.hoisted(() => ({
  calculateCheckoutQuote: vi.fn(),
  CheckoutQuoteError: class CheckoutQuoteError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'CheckoutQuoteError'
    }
  },
}))

const smsMocks = vi.hoisted(() => ({
  sendSignerSmsAndPersist: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../lib/constants', () => ({ PORTAL_URL: 'https://portal.test' }))
vi.mock('../../stripe/quote-calculator', () => quoteMocks)
vi.mock('../signer-sms-delivery', () => smsMocks)

import type { CheckoutPricingInput } from '../../../routes/billing/schemas'
import {
  activateAgreementQuotePaymentPortal,
  createFrozenCalculatorAgreementQuote,
  markAgreementQuotePendingSignature,
  markAgreementQuoteSignedForReview,
  saveFrozenCalculatorAgreementQuoteForAgreement,
} from '../agreement-quote-service'

const pricingInput: CheckoutPricingInput = {
  nec1099Count: 10,
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
    tiers: { basicMonthly: 50000, proMonthly: 75000, vipMonthly: 100000 },
    payroll: { baseMonthly: 15000 },
    cashPlan: { setup: 50000, perEmployeeMonthly: 10000, perOwnerMonthly: 5000 },
    auditProtection: { monthly: 10000, setup: 5000 },
    oneTime: {
      startLlc: 50000,
      holdingLlcNew: 75000,
      holdingLlcModify: 50000,
      personalTaxReturn: 25000,
      businessTaxReturnFederal: 35000,
      businessTaxReturnState: 20000,
    },
    salesTaxMonitoringMonthly: 5000,
  },
}

function quoteOutput(overrides: Record<string, unknown> = {}) {
  return {
    quoteId: 'quote_frozen_1',
    monthlyItems: [{ label: '1099 Compliance', amount: 50, kind: 'monthly' }],
    setupItems: [{ label: 'Setup', amount: 250, kind: 'setup' }],
    monthlyTotal: 50,
    setupTotal: 250,
    ...overrides,
  }
}

function draftAgreement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agreement_1',
    type: 'ENGAGEMENT_LETTER',
    source: 'CALCULATOR',
    status: 'DRAFT',
    paymentQuoteId: null,
    paymentPortalMode: 'NONE',
    ...overrides,
  }
}

function signedPaymentQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quote_frozen_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    leadId: null,
    status: 'agreement_pending_signature',
    payToken: null,
    sentAt: null,
    client: { id: 'client_1', firstName: 'Jane' },
    lead: null,
    ...overrides,
  }
}

function signedAgreement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agreement_1',
    type: 'ENGAGEMENT_LETTER',
    paymentPortalMode: 'AUTO_SEND',
    paymentQuote: signedPaymentQuote(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  quoteMocks.calculateCheckoutQuote.mockReturnValue(quoteOutput())
  prismaMocks.organization.findUnique.mockResolvedValue({
    name: 'Acme Tax',
    calculatorAgreementPaymentMode: 'AUTO_SEND',
  })
  prismaMocks.agreement.updateMany.mockResolvedValue({ count: 1 })
  prismaMocks.paymentQuote.create.mockResolvedValue({ id: 'quote_frozen_1' })
  prismaMocks.paymentQuote.updateMany.mockResolvedValue({ count: 1 })
  prismaMocks.client.findFirst.mockResolvedValue({ id: 'client_1' })
  prismaMocks.lead.findFirst.mockResolvedValue({ id: 'lead_1' })
  smsMocks.sendSignerSmsAndPersist.mockResolvedValue({ delivered: true })
})

describe('createFrozenCalculatorAgreementQuote', () => {
  it('verifies a raw client recipient belongs to the organization before create', async () => {
    prismaMocks.client.findFirst.mockResolvedValueOnce(null)

    await expect(
      createFrozenCalculatorAgreementQuote(
        {
          pricingInput,
          recipient: { type: 'client', id: 'client_other_org' },
        },
        { organizationId: 'org_1', staffId: 'staff_1' },
      ),
    ).rejects.toMatchObject({ status: 404 })

    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'client_other_org', organizationId: 'org_1' },
      select: { id: true },
    })
    expect(prismaMocks.paymentQuote.create).not.toHaveBeenCalled()
  })
})

describe('saveFrozenCalculatorAgreementQuoteForAgreement', () => {
  it('creates an agreement_draft PaymentQuote and links it to the draft agreement', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(draftAgreement())

    const result = await saveFrozenCalculatorAgreementQuoteForAgreement(
      {
        agreementId: 'agreement_1',
        recipient: { type: 'client', id: 'client_1' },
        quote: { pricingInput, customerEmail: 'jane@example.com', customerName: 'Jane Doe' },
      },
      { organizationId: 'org_1', staffId: 'staff_1' },
    )

    expect(result).toEqual({ quoteId: 'quote_frozen_1', paymentPortalMode: 'AUTO_SEND' })
    const createData = prismaMocks.paymentQuote.create.mock.calls[0][0].data
    expect(createData).toMatchObject({
      id: 'quote_frozen_1',
      organization: { connect: { id: 'org_1' } },
      client: { connect: { id: 'client_1' } },
      customerEmail: 'jane@example.com',
      customerName: 'Jane Doe',
      status: 'agreement_draft',
      source: 'calculator',
    })
    expect(createData).not.toHaveProperty('payToken')
    expect(createData).not.toHaveProperty('sentAt')
    expect(createData.inputSnapshot.pricingInput).toEqual(pricingInput)
    expect(createData.resultSnapshot).toEqual(quoteOutput())
    expect(createData.monthlyTotalCents).toBe(5000)
    expect(createData.setupTotalCents).toBe(25000)
    expect(prismaMocks.agreement.updateMany).toHaveBeenCalledWith({
      where: { id: 'agreement_1', organizationId: 'org_1', status: 'DRAFT' },
      data: { paymentQuoteId: 'quote_frozen_1', paymentPortalMode: 'AUTO_SEND' },
    })
  })

  it('updates the existing draft quote instead of creating duplicates', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(
      draftAgreement({ paymentQuoteId: 'quote_existing' }),
    )

    const result = await saveFrozenCalculatorAgreementQuoteForAgreement(
      {
        agreementId: 'agreement_1',
        recipient: { type: 'lead', id: 'lead_1' },
        quote: { pricingInput, paymentPortalMode: 'STAFF_REVIEW' },
      },
      { organizationId: 'org_1', staffId: 'staff_1' },
    )

    expect(result).toEqual({ quoteId: 'quote_existing', paymentPortalMode: 'STAFF_REVIEW' })
    expect(prismaMocks.paymentQuote.create).not.toHaveBeenCalled()
    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'quote_existing',
          organizationId: 'org_1',
          status: 'agreement_draft',
        },
      }),
    )
  })

  it('rejects calculator business tax yearly pre-pay', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(draftAgreement())

    await expect(
      saveFrozenCalculatorAgreementQuoteForAgreement(
        {
          agreementId: 'agreement_1',
          recipient: { type: 'client', id: 'client_1' },
          quote: {
            pricingInput: {
              ...pricingInput,
              oneTime: { ...pricingInput.oneTime, businessTaxReturn: 1 },
            },
          },
        },
        { organizationId: 'org_1', staffId: 'staff_1' },
      ),
    ).rejects.toThrow(quoteMocks.CheckoutQuoteError)
    expect(prismaMocks.paymentQuote.create).not.toHaveBeenCalled()
  })
})

describe('agreement quote status transitions', () => {
  it('marks a linked draft quote pending signature', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(
      draftAgreement({ paymentQuoteId: 'quote_frozen_1', paymentPortalMode: 'AUTO_SEND' }),
    )

    await markAgreementQuotePendingSignature({
      agreementId: 'agreement_1',
      organizationId: 'org_1',
    })

    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'quote_frozen_1',
        organizationId: 'org_1',
        status: 'agreement_draft',
      },
      data: { status: 'agreement_pending_signature' },
    })
  })

  it('marks signed review-mode quotes for staff review', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(
      draftAgreement({ status: 'SIGNED', paymentQuoteId: 'quote_frozen_1' }),
    )

    await markAgreementQuoteSignedForReview({
      agreementId: 'agreement_1',
      organizationId: 'org_1',
    })

    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'quote_frozen_1',
        organizationId: 'org_1',
        status: { in: ['agreement_draft', 'agreement_pending_signature'] },
      },
      data: { status: 'agreement_signed_review' },
    })
  })
})

describe('activateAgreementQuotePaymentPortal', () => {
  it('activates a signed linked quote, returns the pay URL, and sends SMS', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(signedAgreement())

    const result = await activateAgreementQuotePaymentPortal({
      agreementId: 'agreement_1',
      orgId: 'org_1',
      staffId: 'staff_1',
    })

    expect(result).toMatchObject({
      quoteId: 'quote_frozen_1',
      payToken: expect.stringMatching(/^[0-9a-zA-Z]{32}$/),
      payUrl: expect.stringContaining('https://portal.test/quote/'),
      smsSent: true,
    })
    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'quote_frozen_1',
          organizationId: 'org_1',
          payToken: null,
          status: { notIn: ['paid', 'active', 'canceled'] },
        },
        data: expect.objectContaining({
          status: 'sent',
          sentAt: expect.any(Date),
          sentByStaffId: 'staff_1',
        }),
      }),
    )
    expect(smsMocks.sendSignerSmsAndPersist).toHaveBeenCalledWith(
      expect.objectContaining({
        signerId: 'client_1',
        signerKind: 'client',
        organizationId: 'org_1',
        sentById: 'staff_1',
      }),
      expect.stringContaining(result.payUrl),
      'quote_pay_link',
    )
  })

  it('returns an existing pay link without resending SMS', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(
      signedAgreement({
        paymentQuote: signedPaymentQuote({
          status: 'sent',
          payToken: 'tok_existing',
          sentAt: new Date('2026-06-29T10:00:00.000Z'),
        }),
      }),
    )

    const result = await activateAgreementQuotePaymentPortal({
      agreementId: 'agreement_1',
      orgId: 'org_1',
      staffId: 'staff_1',
    })

    expect(result).toEqual({
      quoteId: 'quote_frozen_1',
      payToken: 'tok_existing',
      payUrl: 'https://portal.test/quote/tok_existing',
      smsSent: false,
      smsSkippedReason: 'already_sent',
    })
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })

  it('does not return an already-sent pay link when the linked quote scope is inconsistent', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(
      signedAgreement({
        paymentPortalMode: 'STAFF_REVIEW',
        paymentQuote: signedPaymentQuote({
          status: 'sent',
          payToken: 'tok_wrong_client',
          sentAt: new Date('2026-06-29T10:00:00.000Z'),
          clientId: 'client_other',
        }),
      }),
    )

    await expect(
      activateAgreementQuotePaymentPortal({
        agreementId: 'agreement_1',
        orgId: 'org_1',
        staffId: 'staff_1',
        entityType: 'client',
        entityId: 'client_1',
        requireStaffReviewMode: true,
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })

  it('returns the existing pay link when a concurrent activation wins the race', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(signedAgreement())
    prismaMocks.paymentQuote.updateMany.mockResolvedValueOnce({ count: 0 })
    prismaMocks.paymentQuote.findFirst.mockResolvedValueOnce({
      payToken: 'tok_race_winner',
      sentAt: new Date('2026-06-29T10:00:00.000Z'),
    })

    const result = await activateAgreementQuotePaymentPortal({
      agreementId: 'agreement_1',
      orgId: 'org_1',
      staffId: 'staff_1',
    })

    expect(result).toEqual({
      quoteId: 'quote_frozen_1',
      payToken: 'tok_race_winner',
      payUrl: 'https://portal.test/quote/tok_race_winner',
      smsSent: false,
      smsSkippedReason: 'already_sent',
    })
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })

  it('scopes manual staff-review activation to the requested recipient entity', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(
      signedAgreement({ paymentPortalMode: 'STAFF_REVIEW' }),
    )

    const result = await activateAgreementQuotePaymentPortal({
      agreementId: 'agreement_1',
      orgId: 'org_1',
      staffId: 'staff_1',
      entityType: 'client',
      entityId: 'client_1',
      requireStaffReviewMode: true,
    })

    expect(result.payUrl).toContain('https://portal.test/quote/')
    expect(prismaMocks.agreement.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'agreement_1',
        organizationId: 'org_1',
        clientId: 'client_1',
        status: 'SIGNED',
        source: 'CALCULATOR',
      }),
    }))
  })

  it('rejects manual activation unless the agreement is pending staff review', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(
      signedAgreement({ paymentPortalMode: 'AUTO_SEND' }),
    )

    await expect(
      activateAgreementQuotePaymentPortal({
        agreementId: 'agreement_1',
        orgId: 'org_1',
        staffId: 'staff_1',
        entityType: 'client',
        entityId: 'client_1',
        requireStaffReviewMode: true,
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
  })

  it.each(['paid', 'active', 'canceled'] as const)(
    'rejects manual activation for terminal quote status %s',
    async (status) => {
      prismaMocks.agreement.findFirst.mockResolvedValueOnce(
        signedAgreement({
          paymentPortalMode: 'STAFF_REVIEW',
          paymentQuote: signedPaymentQuote({ status }),
        }),
      )

      await expect(
        activateAgreementQuotePaymentPortal({
          agreementId: 'agreement_1',
          orgId: 'org_1',
          staffId: 'staff_1',
          entityType: 'client',
          entityId: 'client_1',
          requireStaffReviewMode: true,
        }),
      ).rejects.toMatchObject({ status: 409 })
      expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
      expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
    },
  )

  it('keeps the quote sent when SMS persistence fails', async () => {
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(signedAgreement())
    smsMocks.sendSignerSmsAndPersist.mockRejectedValue(new Error('DB down'))

    const result = await activateAgreementQuotePaymentPortal({
      agreementId: 'agreement_1',
      orgId: 'org_1',
      staffId: 'staff_1',
    })

    expect(result.smsSent).toBe(false)
    expect(result.smsSkippedReason).toBe('send_failed')
    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledTimes(1)
  })

  it('returns the pay link when SMS delivery hangs past the timeout', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    prismaMocks.agreement.findFirst.mockResolvedValueOnce(signedAgreement())
    smsMocks.sendSignerSmsAndPersist.mockImplementation(() => new Promise(() => undefined))

    const activation = activateAgreementQuotePaymentPortal({
      agreementId: 'agreement_1',
      orgId: 'org_1',
      staffId: 'staff_1',
    })

    await vi.waitFor(() => expect(smsMocks.sendSignerSmsAndPersist).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(2500)

    await expect(activation).resolves.toMatchObject({
      quoteId: 'quote_frozen_1',
      payUrl: expect.stringContaining('https://portal.test/quote/'),
      smsSent: false,
      smsSkippedReason: 'send_failed',
    })
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Timed out sending quote SMS'),
    )

    errorSpy.mockRestore()
    vi.useRealTimers()
  })
})
