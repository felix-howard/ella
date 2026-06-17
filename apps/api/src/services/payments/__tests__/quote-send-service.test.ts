/**
 * Tests for the sendable pricing quote creation service.
 * Covers: PaymentQuote persistence with frozen snapshots, recipient resolution
 * (client/lead), SMS delivery with graceful failure handling, pricing validation,
 * and quote pay URL generation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HTTPException } from 'hono/http-exception'

const prismaMocks = vi.hoisted(() => ({
  paymentQuote: {
    create: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
  },
  lead: {
    findFirst: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
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
vi.mock('../../../lib/constants', () => ({ PORTAL_URL: 'http://portal.test' }))
vi.mock('../../stripe/quote-calculator', () => quoteMocks)
vi.mock('../signer-sms-delivery', () => smsMocks)

import {
  buildQuotePayUrl,
  createSendableQuote,
  type CreateSendableQuoteContext,
} from '../quote-send-service'
import type { SendQuoteInput } from '../../../routes/billing/schemas'

function buildPricingInput(overrides: Record<string, unknown> = {}) {
  return {
    nec1099Count: 10,
    payrollEmployees: 0,
    payrollMode: 'owner-manual' as const,
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
    ...overrides,
  }
}

function buildSendQuoteInput(overrides: Partial<SendQuoteInput> = {}): SendQuoteInput {
  return {
    pricingInput: buildPricingInput(),
    recipient: { type: 'client', id: 'client_1' },
    customerEmail: 'client@example.com',
    customerName: 'John Client',
    businessName: 'Acme Corp',
    ...overrides,
  }
}

function buildQuoteOutput(overrides: Record<string, unknown> = {}) {
  return {
    quoteId: 'quote_abc123',
    monthlyItems: [{ label: '1099 Compliance', amount: 50, kind: 'monthly' as const }],
    setupItems: [],
    monthlyTotal: 50,
    setupTotal: 0,
    ...overrides,
  }
}

const context: CreateSendableQuoteContext = {
  staffId: 'staff_1',
  organizationId: 'org_1',
}

describe('buildQuotePayUrl', () => {
  it('builds the portal quote page URL', () => {
    expect(buildQuotePayUrl('tok_xyz')).toBe('http://portal.test/quote/tok_xyz')
  })

  it('handles various token formats', () => {
    expect(buildQuotePayUrl('tok_1')).toBe('http://portal.test/quote/tok_1')
    expect(buildQuotePayUrl('abc123DEF')).toBe('http://portal.test/quote/abc123DEF')
  })
})

describe('createSendableQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quoteMocks.calculateCheckoutQuote.mockReturnValue(buildQuoteOutput())
    prismaMocks.organization.findUnique.mockResolvedValue({ name: 'Acme Tax' })
    prismaMocks.client.findFirst.mockResolvedValue({
      id: 'client_1',
      firstName: 'John',
      phone: '+14155551234',
    })
    prismaMocks.paymentQuote.create.mockResolvedValue({ id: 'quote_abc123' })
    // signer-sms-delivery reports actual Twilio delivery; default = delivered.
    smsMocks.sendSignerSmsAndPersist.mockResolvedValue({ delivered: true })
  })

  describe('happy path: client recipient with phone', () => {
    it('validates pricing via calculateCheckoutQuote', async () => {
      const input = buildSendQuoteInput()

      await createSendableQuote(input, context)

      expect(quoteMocks.calculateCheckoutQuote).toHaveBeenCalledTimes(1)
      expect(quoteMocks.calculateCheckoutQuote).toHaveBeenCalledWith(input.pricingInput)
    })

    it('persists PaymentQuote with frozen snapshots and sent status', async () => {
      const input = buildSendQuoteInput({
        customerEmail: 'john@acme.com',
        customerName: 'John Smith',
        businessName: 'Acme Corp',
      })
      const quote = buildQuoteOutput()
      quoteMocks.calculateCheckoutQuote.mockReturnValue(quote)

      await createSendableQuote(input, context)

      expect(prismaMocks.paymentQuote.create).toHaveBeenCalledTimes(1)
      const call = prismaMocks.paymentQuote.create.mock.calls[0]
      const payload = call[0].data

      // Check core fields
      expect(payload).toMatchObject({
        id: 'quote_abc123',
        organizationId: 'org_1',
        clientId: 'client_1',
        leadId: null,
        customerEmail: 'john@acme.com',
        customerName: 'John Smith',
        businessName: 'Acme Corp',
        status: 'sent',
        sentByStaffId: 'staff_1',
        sentAt: expect.any(Date),
      })

      // Check amounts are persisted in cents
      expect(payload.monthlyTotalCents).toBe(5000) // 50 * 100
      expect(payload.setupTotalCents).toBe(0)

      // Check snapshots are frozen
      expect(payload.inputSnapshot).toEqual(
        expect.objectContaining({
          pricingInput: input.pricingInput,
          customerEmail: 'john@acme.com',
          customerName: 'John Smith',
          businessName: 'Acme Corp',
        }),
      )
      expect(payload.resultSnapshot).toEqual(quote)

      // Check payToken is generated (32-char alphanumeric)
      expect(payload.payToken).toMatch(/^[0-9a-zA-Z]{32}$/)
    })

    it('returns sendable quote with smsSent: true', async () => {
      const input = buildSendQuoteInput()

      const result = await createSendableQuote(input, context)

      expect(result).toMatchObject({
        quoteId: 'quote_abc123',
        payToken: expect.stringMatching(/^[0-9a-zA-Z]{32}$/),
        payUrl: expect.stringContaining('http://portal.test/quote/'),
        smsSent: true,
      })
      expect(result.smsSkippedReason).toBeUndefined()
    })

    it('sends pay-link SMS via sendSignerSmsAndPersist', async () => {
      const input = buildSendQuoteInput()
      const result = await createSendableQuote(input, context)

      expect(smsMocks.sendSignerSmsAndPersist).toHaveBeenCalledTimes(1)
      const [target, message, template] = smsMocks.sendSignerSmsAndPersist.mock.calls[0]

      expect(target).toEqual({
        signerId: 'client_1',
        signerKind: 'client',
        organizationId: 'org_1',
        sentById: 'staff_1',
      })
      expect(message).toContain('John')
      expect(message).toContain('Acme Tax')
      expect(message).toContain(result.payUrl)
      expect(template).toBe('quote_pay_link')
    })
  })

  describe('lead recipient', () => {
    it('resolves lead and persists with leadId', async () => {
      prismaMocks.lead.findFirst.mockResolvedValue({
        id: 'lead_2',
        firstName: 'Anna',
      })

      const input = buildSendQuoteInput({
        recipient: { type: 'lead', id: 'lead_2' },
      })

      await createSendableQuote(input, context)

      expect(prismaMocks.lead.findFirst).toHaveBeenCalledWith({
        where: { id: 'lead_2', organizationId: 'org_1' },
        select: { id: true, firstName: true },
      })

      const payload = prismaMocks.paymentQuote.create.mock.calls[0][0].data
      expect(payload).toMatchObject({
        leadId: 'lead_2',
        clientId: null,
      })
    })

    it('sends SMS to lead with lead signerKind', async () => {
      prismaMocks.lead.findFirst.mockResolvedValue({
        id: 'lead_2',
        firstName: 'Anna',
      })

      const input = buildSendQuoteInput({
        recipient: { type: 'lead', id: 'lead_2' },
      })

      await createSendableQuote(input, context)

      expect(smsMocks.sendSignerSmsAndPersist).toHaveBeenCalledWith(
        expect.objectContaining({
          signerId: 'lead_2',
          signerKind: 'lead',
        }),
        expect.any(String),
        'quote_pay_link',
      )
    })
  })

  describe('recipient not found', () => {
    it('throws HTTPException 404 for missing client', async () => {
      prismaMocks.client.findFirst.mockResolvedValue(null)

      const input = buildSendQuoteInput({ recipient: { type: 'client', id: 'nonexistent' } })

      await expect(createSendableQuote(input, context)).rejects.toMatchObject(
        new HTTPException(404, { message: 'Client not found' }),
      )

      expect(prismaMocks.paymentQuote.create).not.toHaveBeenCalled()
      expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
    })

    it('throws HTTPException 404 for missing lead', async () => {
      prismaMocks.lead.findFirst.mockResolvedValue(null)

      const input = buildSendQuoteInput({
        recipient: { type: 'lead', id: 'nonexistent' },
      })

      await expect(createSendableQuote(input, context)).rejects.toMatchObject(
        new HTTPException(404, { message: 'Lead not found' }),
      )

      expect(prismaMocks.paymentQuote.create).not.toHaveBeenCalled()
      expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
    })

    it('scopes recipient lookup to the requesting organization', async () => {
      prismaMocks.client.findFirst.mockResolvedValue(null)

      const input = buildSendQuoteInput({ recipient: { type: 'client', id: 'client_1' } })

      await expect(createSendableQuote(input, context)).rejects.toThrow(HTTPException)

      expect(prismaMocks.client.findFirst).toHaveBeenCalledWith({
        where: { id: 'client_1', organizationId: 'org_1', clientType: 'INDIVIDUAL' },
        select: { id: true, firstName: true },
      })
    })

    it('does not resolve business clients as sendable quote recipients', async () => {
      prismaMocks.client.findFirst.mockResolvedValue(null)

      const input = buildSendQuoteInput({ recipient: { type: 'client', id: 'business_1' } })

      await expect(createSendableQuote(input, context)).rejects.toMatchObject(
        new HTTPException(404, { message: 'Client not found' }),
      )

      expect(prismaMocks.client.findFirst).toHaveBeenCalledWith({
        where: { id: 'business_1', organizationId: 'org_1', clientType: 'INDIVIDUAL' },
        select: { id: true, firstName: true },
      })
      expect(prismaMocks.paymentQuote.create).not.toHaveBeenCalled()
      expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
    })
  })

  describe('pricing validation', () => {
    it('propagates CheckoutQuoteError from calculateCheckoutQuote', async () => {
      quoteMocks.calculateCheckoutQuote.mockImplementation(() => {
        throw new quoteMocks.CheckoutQuoteError('Rate overrides below current defaults are not allowed')
      })

      const input = buildSendQuoteInput()

      await expect(createSendableQuote(input, context)).rejects.toThrow(quoteMocks.CheckoutQuoteError)
      expect(prismaMocks.paymentQuote.create).not.toHaveBeenCalled()
    })

    it('does not persist quote when pricing is tampered', async () => {
      quoteMocks.calculateCheckoutQuote.mockImplementation(() => {
        throw new quoteMocks.CheckoutQuoteError('Invalid pricing')
      })

      const input = buildSendQuoteInput()

      try {
        await createSendableQuote(input, context)
      } catch {
        // Expected
      }

      expect(prismaMocks.paymentQuote.create).not.toHaveBeenCalled()
    })
  })

  describe('SMS delivery failures (graceful)', () => {
    it('persists quote and returns smsSent: false when recipient has no phone', async () => {
      // signer-sms-delivery reports a no-phone non-delivery (it owns the phone lookup).
      smsMocks.sendSignerSmsAndPersist.mockResolvedValue({ delivered: false, reason: 'no_phone' })

      const input = buildSendQuoteInput()

      const result = await createSendableQuote(input, context)

      expect(result).toMatchObject({
        quoteId: 'quote_abc123',
        smsSent: false,
        smsSkippedReason: 'no_phone',
      })

      // Quote still persisted; the send was still attempted (delivery fn decides phone).
      expect(prismaMocks.paymentQuote.create).toHaveBeenCalledTimes(1)
      expect(smsMocks.sendSignerSmsAndPersist).toHaveBeenCalledTimes(1)
    })

    it('maps a Twilio non-delivery to send_failed', async () => {
      smsMocks.sendSignerSmsAndPersist.mockResolvedValue({
        delivered: false,
        reason: 'TWILIO_REJECTED',
      })

      const result = await createSendableQuote(buildSendQuoteInput(), context)

      expect(result).toMatchObject({ smsSent: false, smsSkippedReason: 'send_failed' })
      expect(prismaMocks.paymentQuote.create).toHaveBeenCalledTimes(1)
    })

    it('persists quote and returns smsSent: false when SMS persistence throws', async () => {
      smsMocks.sendSignerSmsAndPersist.mockRejectedValue(new Error('DB error'))

      const input = buildSendQuoteInput()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

      const result = await createSendableQuote(input, context)

      expect(result).toMatchObject({
        quoteId: 'quote_abc123',
        smsSent: false,
        smsSkippedReason: 'send_failed',
      })

      // Quote still persisted
      expect(prismaMocks.paymentQuote.create).toHaveBeenCalledTimes(1)

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Quote]'),
        expect.any(Error),
      )
      const errorMsg = errorSpy.mock.calls[0][0]
      expect(errorMsg).toContain('Failed to')

      errorSpy.mockRestore()
    })

    it('does not throw when SMS delivery fails', async () => {
      smsMocks.sendSignerSmsAndPersist.mockRejectedValue(new Error('SMS timeout'))

      const input = buildSendQuoteInput()

      await expect(createSendableQuote(input, context)).resolves.toBeDefined()
    })

    it('returns correct smsSent flags for all failure scenarios', async () => {
      // Scenario 1: No phone (delivery fn reports it)
      smsMocks.sendSignerSmsAndPersist.mockResolvedValueOnce({ delivered: false, reason: 'no_phone' })
      const resultNoPhone = await createSendableQuote(buildSendQuoteInput(), context)
      expect(resultNoPhone.smsSent).toBe(false)
      expect(resultNoPhone.smsSkippedReason).toBe('no_phone')

      // Scenario 2: Send failure (delivery fn throws)
      vi.clearAllMocks()
      quoteMocks.calculateCheckoutQuote.mockReturnValue(buildQuoteOutput())
      prismaMocks.organization.findUnique.mockResolvedValue({ name: 'Acme Tax' })
      prismaMocks.client.findFirst.mockResolvedValue({ id: 'client_1', firstName: 'John' })
      prismaMocks.paymentQuote.create.mockResolvedValue({ id: 'quote_abc123' })
      smsMocks.sendSignerSmsAndPersist.mockRejectedValue(new Error('Twilio error'))

      const resultFailure = await createSendableQuote(buildSendQuoteInput(), context)
      expect(resultFailure.smsSent).toBe(false)
      expect(resultFailure.smsSkippedReason).toBe('send_failed')

      // Scenario 3: Success
      vi.clearAllMocks()
      quoteMocks.calculateCheckoutQuote.mockReturnValue(buildQuoteOutput())
      prismaMocks.organization.findUnique.mockResolvedValue({ name: 'Acme Tax' })
      prismaMocks.client.findFirst.mockResolvedValue({ id: 'client_1', firstName: 'John' })
      prismaMocks.paymentQuote.create.mockResolvedValue({ id: 'quote_abc123' })
      smsMocks.sendSignerSmsAndPersist.mockResolvedValue({ delivered: true })

      const resultSuccess = await createSendableQuote(buildSendQuoteInput(), context)
      expect(resultSuccess.smsSent).toBe(true)
      expect(resultSuccess.smsSkippedReason).toBeUndefined()
    })
  })

  describe('org name resolution', () => {
    it('uses org name in SMS when available', async () => {
      prismaMocks.organization.findUnique.mockResolvedValue({ name: 'Acme Tax Corp' })

      const input = buildSendQuoteInput()
      await createSendableQuote(input, context)

      const [, message] = smsMocks.sendSignerSmsAndPersist.mock.calls[0]
      expect(message).toContain('Acme Tax Corp')
    })

    it('falls back to "us" as org name when org not found', async () => {
      prismaMocks.organization.findUnique.mockResolvedValue(null)

      const input = buildSendQuoteInput()
      await createSendableQuote(input, context)

      const [, message] = smsMocks.sendSignerSmsAndPersist.mock.calls[0]
      expect(message).toContain('us')
    })
  })

  describe('snapshot immutability', () => {
    it('freezes pricingInput in inputSnapshot (query-immune)', async () => {
      const input = buildSendQuoteInput({
        pricingInput: buildPricingInput({ nec1099Count: 42 }),
      })

      await createSendableQuote(input, context)

      const payload = prismaMocks.paymentQuote.create.mock.calls[0][0].data
      expect(payload.inputSnapshot.pricingInput.nec1099Count).toBe(42)
    })

    it('persists resultSnapshot as the quote output (immutable copy)', async () => {
      const quote = buildQuoteOutput({
        quoteId: 'quote_xyz',
        monthlyTotal: 123,
        setupTotal: 456,
      })
      quoteMocks.calculateCheckoutQuote.mockReturnValue(quote)

      const input = buildSendQuoteInput()
      await createSendableQuote(input, context)

      const payload = prismaMocks.paymentQuote.create.mock.calls[0][0].data
      expect(payload.resultSnapshot).toEqual(quote)
    })
  })
})
